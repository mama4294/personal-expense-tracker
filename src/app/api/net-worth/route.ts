import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";
import { accountInclude, netWorthOwner } from "@/lib/account-company";

const balanceSchema = z.object({
  accountId: z.string().min(1),
  amount: z.number(),
});

const snapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must look like 2026-07."),
  notes: z.string().optional(),
  balances: z.array(balanceSchema).min(1).refine(
    (balances) => new Set(balances.map((balance) => balance.accountId)).size === balances.length,
    { message: "Each configured account can only appear once." },
  ),
});

/** One cell of the History grid. A null amount clears that account's balance. */
const balanceUpdateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must look like 2026-07."),
  accountId: z.string().min(1),
  amount: z.number().finite().nullable(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const snapshots = await db.netWorthSnapshot.findMany({
    include: {
      balances: {
        include: {
          person: { select: { id: true, name: true } },
          account: { include: { company: { select: { name: true, logo: true } } } },
        },
      },
    },
    orderBy: { month: "desc" },
  });

  return jsonOk(snapshots);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = snapshotSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid net worth snapshot");
  }

  const month = new Date(`${parsed.data.month}-01T00:00:00.000Z`);
  const accountIds = parsed.data.balances.map((balance) => balance.accountId);
  const accounts = await db.account.findMany({
    where: { id: { in: accountIds } },
    include: accountInclude,
  });
  if (accounts.length !== accountIds.length) {
    return jsonError("One or more configured accounts no longer exist.");
  }
  if (accounts.some((account) => !account.assetType && !account.liabilityType)) {
    return jsonError("Give every account a net worth category before entering its balance.");
  }
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const balances = parsed.data.balances.map((balance) => {
    const account = accountById.get(balance.accountId)!;
    return {
      accountId: account.id,
      assetType: account.assetType,
      liabilityType: account.liabilityType,
      amount: balance.amount,
      accountName: account.name,
      personId: netWorthOwner(account.splits)?.id ?? null,
    };
  });

  try {
    const snapshot = await db.netWorthSnapshot.upsert({
      where: { month },
      update: {
        notes: parsed.data.notes,
        balances: { deleteMany: {}, create: balances },
      },
      create: {
        month,
        notes: parsed.data.notes,
        balances: { create: balances },
      },
      include: {
        balances: {
          include: {
            person: { select: { id: true, name: true } },
            account: { include: { company: { select: { name: true, logo: true } } } },
          },
        },
      },
    });

    return jsonOk(snapshot, 201);
  } catch (saveError) {
    return jsonDbError(saveError, "Could not save the snapshot.");
  }
}

/**
 * Sets a single account's balance for a month, leaving the month's other
 * balances alone. POST replaces the whole month, which would drop balances
 * the editor never saw (such as rows that predate configured accounts).
 */
export async function PATCH(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = balanceUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid balance");
  }

  const { accountId, amount } = parsed.data;
  const month = new Date(`${parsed.data.month}-01T00:00:00.000Z`);
  const account = await db.account.findUnique({
    where: { id: accountId },
    include: accountInclude,
  });
  if (!account) return jsonError("That account no longer exists.");
  if (!account.assetType && !account.liabilityType) {
    return jsonError("Give this account a net worth category before entering its balance.");
  }

  try {
    await db.$transaction(async (tx) => {
      const snapshot = await tx.netWorthSnapshot.findUnique({ where: { month } });

      if (amount === null) {
        if (!snapshot) return;
        await tx.netWorthBalance.deleteMany({ where: { snapshotId: snapshot.id, accountId } });
        // A month with nothing left in it would be an empty column.
        const remaining = await tx.netWorthBalance.count({ where: { snapshotId: snapshot.id } });
        if (remaining === 0) await tx.netWorthSnapshot.delete({ where: { id: snapshot.id } });
        return;
      }

      const target = snapshot ?? (await tx.netWorthSnapshot.create({ data: { month } }));
      const updated = await tx.netWorthBalance.updateMany({
        where: { snapshotId: target.id, accountId },
        data: { amount },
      });
      if (updated.count === 0) {
        await tx.netWorthBalance.create({
          data: {
            snapshotId: target.id,
            accountId,
            amount,
            assetType: account.assetType,
            liabilityType: account.liabilityType,
            accountName: account.name,
            personId: netWorthOwner(account.splits)?.id ?? null,
          },
        });
      }
    });

    return jsonOk({ success: true });
  } catch (saveError) {
    return jsonDbError(saveError, "Could not save the balance.");
  }
}
