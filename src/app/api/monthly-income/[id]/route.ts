import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const paycheckUpdateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must look like 2026-07-15.")
    .optional(),
  personId: z.string().min(1).optional(),
  companyId: z.string().nullish(),
  annualSalary: z.number().min(0).optional(),
  grossIncome: z.number().min(0).optional(),
  medical: z.number().min(0).optional(),
  dentalVision: z.number().min(0).optional(),
  retirement401k: z.number().min(0).optional(),
  hsa: z.number().min(0).optional(),
  taxes: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const include = {
  person: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const parsed = paycheckUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid paycheck update");
  }

  const { date, personId, companyId, ...amounts } = parsed.data;

  const existing = await db.monthlyIncome.findUnique({ where: { id } });
  if (!existing) {
    return jsonError("That paycheck no longer exists.", 404);
  }

  const nextPersonId = personId ?? existing.personId;
  const nextCompanyId =
    companyId !== undefined ? (companyId ?? null) : existing.companyId;

  if (nextCompanyId) {
    const company = await db.company.findUnique({ where: { id: nextCompanyId } });
    if (!company) return jsonError("That company no longer exists.", 404);
    if (company.personId !== nextPersonId) {
      return jsonError("That company belongs to a different person.");
    }
  }

  const merged = {
    grossIncome: Number(
      amounts.grossIncome ?? existing.grossIncome,
    ),
    medical: Number(amounts.medical ?? existing.medical),
    dentalVision: Number(amounts.dentalVision ?? existing.dentalVision),
    retirement401k: Number(amounts.retirement401k ?? existing.retirement401k),
    hsa: Number(amounts.hsa ?? existing.hsa),
    taxes: Number(amounts.taxes ?? existing.taxes),
  };

  const deductions =
    merged.medical +
    merged.dentalVision +
    merged.retirement401k +
    merged.hsa +
    merged.taxes;

  if (deductions > merged.grossIncome) {
    return jsonError(
      "Deductions add up to more than gross income, which would make net income negative.",
    );
  }

  try {
    const entry = await db.monthlyIncome.update({
      where: { id },
      data: {
        ...amounts,
        personId: personId ?? undefined,
        companyId: companyId !== undefined ? (companyId ?? null) : undefined,
        date: date ? new Date(`${date}T00:00:00.000Z`) : undefined,
      },
      include,
    });

    return jsonOk(entry);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the paycheck.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await db.monthlyIncome.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the paycheck.");
  }
}
