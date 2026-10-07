import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const accountSchema = z.object({
  name: z.string().trim().min(1).optional(),
  assetType: z.enum(["CHECKING", "SAVINGS", "BROKERAGE", "RSU", "FOUR_O_ONE_K", "ROTH_IRA", "HSA", "CRYPTO", "HOME_VALUE"]).nullable().optional(),
  liabilityType: z.enum(["MORTGAGE", "CAR_LOAN", "CREDIT_CARD"]).nullable().optional(),
  personId: z.string().nullable().optional(),
}).refine((value) => {
  if (value.assetType === undefined && value.liabilityType === undefined) return true;
  return Boolean(value.assetType) !== Boolean(value.liabilityType);
}, { message: "Choose one asset or liability category." });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid account");
  try {
    const account = await db.netWorthAccount.update({
      where: { id }, data: parsed.data,
      include: { person: { select: { id: true, name: true } } },
    });
    return jsonOk(account);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the net worth account.");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  const { id } = await params;
  const count = await db.netWorthBalance.count({ where: { accountId: id } });
  if (count) return jsonError("This account has balance history and cannot be deleted.", 409);
  try {
    await db.netWorthAccount.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the net worth account.");
  }
}
