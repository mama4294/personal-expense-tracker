import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { upsertTags } from "@/lib/analytics";
import { validateSplits } from "@/lib/splits";
import { z } from "zod";

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  notes: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  /// An empty array clears the override and falls back to the account default.
  splits: z
    .array(
      z.object({
        personId: z.string().min(1),
        percent: z.number().int().min(0).max(100),
      }),
    )
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid transaction update");
  }

  const { tags, splits, ...data } = parsed.data;

  const cleanedSplits = splits?.filter((split) => split.percent > 0);
  if (cleanedSplits) {
    const invalid = validateSplits(cleanedSplits);
    if (invalid) return jsonError(invalid);
  }

  try {
    const transaction = await db.transaction.update({
      where: { id },
      data: {
        ...data,
        ...(cleanedSplits
          ? { splits: { deleteMany: {}, create: cleanedSplits } }
          : {}),
      },
    });

    if (tags) {
      await db.transactionTag.deleteMany({ where: { transactionId: id } });
      const tagRecords = await upsertTags(tags);
      if (tagRecords.length > 0) {
        await db.transactionTag.createMany({
          data: tagRecords.map((tag) => ({
            transactionId: id,
            tagId: tag.id,
          })),
        });
      }
    }

    return jsonOk(transaction);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the transaction.");
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
    await db.transaction.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the transaction.");
  }
}
