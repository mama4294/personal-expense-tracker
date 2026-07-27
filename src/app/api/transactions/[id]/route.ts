import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { upsertTags } from "@/lib/analytics";
import { z } from "zod";

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  notes: z.string().optional(),
  owner: z.enum(["MATTHEW", "GENEVIEVE", "SHARED"]).optional(),
  categoryId: z.string().nullable().optional(),
  matthewSplitPercent: z.number().int().min(0).max(100).nullable().optional(),
  genevieveSplitPercent: z.number().int().min(0).max(100).nullable().optional(),
  tags: z.array(z.string()).optional(),
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

  const { tags, ...data } = parsed.data;

  const transaction = await db.transaction.update({
    where: { id },
    data,
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
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await db.transaction.delete({ where: { id } });
  return jsonOk({ success: true });
}
