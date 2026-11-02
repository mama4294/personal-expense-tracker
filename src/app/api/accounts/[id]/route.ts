import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { validateSplits } from "@/lib/splits";
import {
  accountInclude,
  companyInputSchema,
  pruneCompanies,
  resolveCompanyId,
  withOwner,
} from "@/lib/account-company";
import { ASSET_TYPES, LIABILITY_TYPES } from "@/lib/account-types";
import { z } from "zod";

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    nickname: z.string().nullish(),
    company: companyInputSchema,
    assetType: z.enum(ASSET_TYPES).nullable().optional(),
    liabilityType: z.enum(LIABILITY_TYPES).nullable().optional(),
    splits: z
      .array(
        z.object({
          personId: z.string().min(1),
          percent: z.number().int().min(0).max(100),
        }),
      )
      .optional(),
  })
  .refine((value) => !(value.assetType && value.liabilityType), {
    message: "Choose an asset or a liability category, not both.",
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

  const splits = parsed.data.splits?.filter((split) => split.percent > 0);
  if (splits) {
    const invalid = validateSplits(splits);
    if (invalid) return jsonError(invalid);
  }

  const { assetType, liabilityType } = parsed.data;
  // Balances are what net worth charts read, so an account with history can't
  // quietly drop out of it.
  if (assetType === null && liabilityType === null) {
    const balanceCount = await db.netWorthBalance.count({ where: { accountId: id } });
    if (balanceCount > 0) {
      return jsonError(
        "This account has net worth history, so it needs an asset or liability category.",
        409,
      );
    }
  }

  try {
    const companyId = await resolveCompanyId(parsed.data.company);
    const account = await db.account.update({
      where: { id },
      data: {
        name: parsed.data.name?.trim(),
        // Undefined leaves it alone; an empty string clears it back to name.
        ...(parsed.data.nickname === undefined
          ? {}
          : { nickname: parsed.data.nickname?.trim() || null }),
        ...(companyId === undefined ? {} : { companyId }),
        ...(assetType === undefined ? {} : { assetType }),
        ...(liabilityType === undefined ? {} : { liabilityType }),
        ...(splits
          ? { splits: { deleteMany: {}, create: splits } }
          : {}),
      },
      include: accountInclude,
    });
    // Moving the last account off a company leaves nothing to show it on.
    await pruneCompanies();

    return jsonOk(withOwner(account));
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

  // Transactions and balances keep a reference to their account, so refuse
  // rather than silently detaching a card's history.
  const [transactionCount, balanceCount] = await Promise.all([
    db.transaction.count({ where: { accountId: id } }),
    db.netWorthBalance.count({ where: { accountId: id } }),
  ]);
  if (transactionCount > 0) {
    return jsonError(
      `This account still has ${transactionCount} transaction${transactionCount === 1 ? "" : "s"}. Reassign or delete them before removing the account.`,
      409,
    );
  }
  if (balanceCount > 0) {
    return jsonError("This account has net worth history and cannot be deleted.", 409);
  }

  try {
    await db.account.delete({ where: { id } });
    await pruneCompanies();
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the account.");
  }
}
