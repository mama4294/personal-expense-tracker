import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import {
  filtersFromSearchParams,
  getTransactionList,
  upsertTags,
} from "@/lib/analytics";
import { db } from "@/lib/db";
import { z } from "zod";

const transactionSchema = z.object({
  date: z.string(),
  amount: z.number().positive(),
  description: z.string().min(1),
  notes: z.string().optional(),
  owner: z.enum(["MATTHEW", "GENEVIEVE", "SHARED"]),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  matthewSplitPercent: z.number().int().min(0).max(100).optional(),
  genevieveSplitPercent: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const transactions = await getTransactionList(
    filtersFromSearchParams(searchParams),
  );

  return jsonOk(transactions);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = transactionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid transaction");
  }

  const transaction = await db.transaction.create({
    data: {
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
      amount: parsed.data.amount,
      description: parsed.data.description,
      notes: parsed.data.notes,
      owner: parsed.data.owner,
      categoryId: parsed.data.categoryId,
      accountId: parsed.data.accountId,
      matthewSplitPercent: parsed.data.matthewSplitPercent,
      genevieveSplitPercent: parsed.data.genevieveSplitPercent,
      isManual: true,
    },
  });

  if (parsed.data.tags?.length) {
    const tags = await upsertTags(parsed.data.tags);
    await db.transactionTag.createMany({
      data: tags.map((tag) => ({
        transactionId: transaction.id,
        tagId: tag.id,
      })),
    });
  }

  return jsonOk(transaction, 201);
}
