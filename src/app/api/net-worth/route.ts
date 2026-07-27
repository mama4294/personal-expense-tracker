import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const balanceSchema = z.object({
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
  liabilityType: z.enum(["MORTGAGE", "CAR_LOAN"]).optional(),
  amount: z.number(),
  owner: z.enum(["MATTHEW", "GENEVIEVE", "SHARED"]).default("SHARED"),
});

const snapshotSchema = z.object({
  month: z.string(),
  notes: z.string().optional(),
  balances: z.array(balanceSchema).min(1),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const snapshots = await db.netWorthSnapshot.findMany({
    include: { balances: true },
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

  const snapshot = await db.netWorthSnapshot.upsert({
    where: { month },
    update: {
      notes: parsed.data.notes,
      balances: {
        deleteMany: {},
        create: parsed.data.balances,
      },
    },
    create: {
      month,
      notes: parsed.data.notes,
      balances: {
        create: parsed.data.balances,
      },
    },
    include: { balances: true },
  });

  return jsonOk(snapshot, 201);
}
