import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import {
  filtersFromSearchParams,
  getTransactionList,
  upsertTags,
} from "@/lib/analytics";
import { db } from "@/lib/db";
import { validateSplits } from "@/lib/splits";
import { z } from "zod";

const transactionSchema = z.object({
  date: z.string(),
  amount: z.number().positive(),
  description: z.string().min(1),
  notes: z.string().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  /// Omit to inherit the account's default split.
  splits: z
    .array(
      z.object({
        personId: z.string().min(1),
        percent: z.number().int().min(0).max(100),
      }),
    )
    .optional(),
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

  const splits = parsed.data.splits?.filter((split) => split.percent > 0) ?? [];
  const invalid = validateSplits(splits);
  if (invalid) return jsonError(invalid);

  if (splits.length === 0 && !parsed.data.accountId) {
    const activePeople = await db.person.count({ where: { isActive: true } });
    if (activePeople === 0) {
      return jsonError(
        "Add at least one person in Settings before recording an expense.",
      );
    }
  }

  try {
    const transaction = await db.transaction.create({
      data: {
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        amount: parsed.data.amount,
        description: parsed.data.description,
        notes: parsed.data.notes,
        categoryId: parsed.data.categoryId,
        accountId: parsed.data.accountId,
        isManual: true,
        splits: { create: splits },
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
  } catch (createError) {
    return jsonDbError(createError, "Could not save the expense.");
  }
}
