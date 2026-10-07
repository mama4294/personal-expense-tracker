import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

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

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const snapshots = await db.netWorthSnapshot.findMany({
    include: {
      balances: {
        include: {
          person: { select: { id: true, name: true } },
          account: true,
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
  const accounts = await db.netWorthAccount.findMany({ where: { id: { in: accountIds } } });
  if (accounts.length !== accountIds.length) {
    return jsonError("One or more configured accounts no longer exist.");
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
      personId: account.personId,
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
            account: true,
          },
        },
      },
    });

    return jsonOk(snapshot, 201);
  } catch (saveError) {
    return jsonDbError(saveError, "Could not save the snapshot.");
  }
}
