import { requireAuth, jsonOk, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";

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
