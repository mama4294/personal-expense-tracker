import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  isActive: z.boolean().optional(),
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
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid person update");
  }

  // Deactivating the last active person would leave account-less expenses with
  // nobody to attribute them to.
  if (parsed.data.isActive === false) {
    const remaining = await db.person.count({
      where: { isActive: true, id: { not: id } },
    });
    if (remaining === 0) {
      return jsonError("At least one person must stay active.");
    }
  }

  try {
    const person = await db.person.update({
      where: { id },
      data: {
        ...parsed.data,
        name: parsed.data.name?.trim(),
      },
    });
    return jsonOk(person);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the person.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Removing a person who owns history would silently rewrite past splits, so
  // deletion is only offered while they are unreferenced.
  const [transactionSplits, accountSplits, income] = await Promise.all([
    db.transactionSplit.count({ where: { personId: id } }),
    db.accountSplit.count({ where: { personId: id } }),
    db.income.count({ where: { personId: id } }),
  ]);

  const references = transactionSplits + accountSplits + income;
  if (references > 0) {
    return jsonError(
      "This person is referenced by existing accounts, transactions, or income. Deactivate them instead to keep the history intact.",
      409,
    );
  }

  try {
    await db.person.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the person.");
  }
}
