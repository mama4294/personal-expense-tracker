import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const incomeSchema = z.object({
  date: z.string(),
  source: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  personId: z.string().min(1),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const income = await db.income.findMany({
    include: { person: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });

  return jsonOk(income);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = incomeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid income entry");
  }

  try {
    const entry = await db.income.create({
      data: {
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        source: parsed.data.source,
        description: parsed.data.description,
        amount: parsed.data.amount,
        personId: parsed.data.personId,
      },
      include: { person: { select: { id: true, name: true } } },
    });

    return jsonOk(entry, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not save the income entry.");
  }
}
