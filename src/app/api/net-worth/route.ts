import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const balanceSchema = z
  .object({
    assetType: z
      .enum([
        "CHECKING",
        "SAVINGS",
        "BROKERAGE",
        "FOUR_O_ONE_K",
        "ROTH_IRA",
        "HSA",
        "CRYPTO",
        "HOME_VALUE",
      ])
      .optional(),
    liabilityType: z.enum(["MORTGAGE", "CAR_LOAN", "CREDIT_CARD"]).optional(),
    amount: z.number(),
    /// Null or omitted means the account is held jointly.
    personId: z.string().nullish(),
  })
  .refine(
    (balance) => Boolean(balance.assetType) !== Boolean(balance.liabilityType),
    { message: "Each balance must be either an asset or a liability." },
  );

const snapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must look like 2026-07."),
  notes: z.string().optional(),
  balances: z.array(balanceSchema).min(1),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const snapshots = await db.netWorthSnapshot.findMany({
    include: {
      balances: {
        include: { person: { select: { id: true, name: true } } },
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
  const balances = parsed.data.balances.map((balance) => ({
    assetType: balance.assetType,
    liabilityType: balance.liabilityType,
    amount: balance.amount,
    personId: balance.personId ?? null,
  }));

  try {
    // Saving a month replaces it wholesale, so the form is the source of truth
    // for that snapshot rather than merging into whatever was there.
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
          include: { person: { select: { id: true, name: true } } },
        },
      },
    });

    return jsonOk(snapshot, 201);
  } catch (saveError) {
    return jsonDbError(saveError, "Could not save the net worth snapshot.");
  }
}
