import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  owner: z.enum(["MATTHEW", "GENEVIEVE", "SHARED"]).optional(),
  matthewSplitPercent: z.number().int().min(0).max(100).optional(),
  genevieveSplitPercent: z.number().int().min(0).max(100).optional(),
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
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid account update");
  }

  const { matthewSplitPercent, genevieveSplitPercent } = parsed.data;
  if (
    matthewSplitPercent != null &&
    genevieveSplitPercent != null &&
    matthewSplitPercent + genevieveSplitPercent !== 100
  ) {
    return jsonError("Split percentages must add up to 100.");
  }

  try {
    const account = await db.account.update({
      where: { id },
      data: parsed.data,
    });
    return jsonOk(account);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the account.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Transactions keep a reference to their account, so refuse rather than
  // silently detaching a card's spending history.
  const transactionCount = await db.transaction.count({
    where: { accountId: id },
  });
  if (transactionCount > 0) {
    return jsonError(
      `This account still has ${transactionCount} transaction${transactionCount === 1 ? "" : "s"}. Reassign or delete them before removing the account.`,
      409,
    );
  }

  try {
    await db.account.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the account.");
  }
}
