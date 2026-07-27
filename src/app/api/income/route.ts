import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const incomeSchema = z.object({
  date: z.string(),
  source: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  owner: z.enum(["MATTHEW", "GENEVIEVE"]),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const income = await db.income.findMany({ orderBy: { date: "desc" } });
  return jsonOk(income);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = incomeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid income entry");
  }

  const entry = await db.income.create({
    data: {
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
      source: parsed.data.source,
      description: parsed.data.description,
      amount: parsed.data.amount,
      owner: parsed.data.owner,
    },
  });

  return jsonOk(entry, 201);
}
