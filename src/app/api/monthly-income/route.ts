import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const paycheckSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must look like 2026-07."),
  personId: z.string().min(1),
  /// Omitted or null for households that haven't set up companies yet.
  companyId: z.string().nullish(),
  annualSalary: z.number().min(0).default(0),
  grossIncome: z.number().min(0).default(0),
  medical: z.number().min(0).default(0),
  dentalVision: z.number().min(0).default(0),
  retirement401k: z.number().min(0).default(0),
  hsa: z.number().min(0).default(0),
  taxes: z.number().min(0).default(0),
  notes: z.string().optional(),
});

const include = {
  person: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const entries = await db.monthlyIncome.findMany({
    include,
    orderBy: [{ month: "desc" }, { personId: "asc" }],
  });

  return jsonOk(entries);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = paycheckSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid paycheck");
  }

  const { month, personId, companyId, notes, ...amounts } = parsed.data;

  const deductions =
    amounts.medical +
    amounts.dentalVision +
    amounts.retirement401k +
    amounts.hsa +
    amounts.taxes;

  if (deductions > amounts.grossIncome) {
    return jsonError(
      "Deductions add up to more than gross income, which would make net income negative.",
    );
  }

  if (companyId) {
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) return jsonError("That company no longer exists.", 404);
    if (company.personId !== personId) {
      return jsonError("That company belongs to a different person.");
    }
  }

  const monthDate = new Date(`${month}-01T00:00:00.000Z`);
  const data = { ...amounts, notes };

  try {
    // Matched by hand rather than upsert: the unique key includes a nullable
    // companyId, and SQL treats NULLs as distinct, so an upsert would happily
    // insert a second company-less paycheck for the same month.
    const existing = await db.monthlyIncome.findFirst({
      where: { month: monthDate, personId, companyId: companyId ?? null },
    });

    const entry = existing
      ? await db.monthlyIncome.update({
          where: { id: existing.id },
          data,
          include,
        })
      : await db.monthlyIncome.create({
          data: { month: monthDate, personId, companyId: companyId ?? null, ...data },
          include,
        });

    return jsonOk(entry, 201);
  } catch (saveError) {
    return jsonDbError(saveError, "Could not save the paycheck.");
  }
}
