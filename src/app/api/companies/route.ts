import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().min(1).max(80),
  personId: z.string().min(1),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const companies = await db.company.findMany({
    include: { person: { select: { id: true, name: true } } },
    orderBy: [{ personId: "asc" }, { name: "asc" }],
  });

  return jsonOk(companies);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = companySchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid company");
  }

  try {
    const company = await db.company.create({
      data: {
        name: parsed.data.name.trim(),
        personId: parsed.data.personId,
      },
      include: { person: { select: { id: true, name: true } } },
    });

    return jsonOk(company, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not add the company.");
  }
}
