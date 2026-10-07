import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const accountSchema = z.object({
  name: z.string().trim().min(1),
  assetType: z.enum(["CHECKING", "SAVINGS", "BROKERAGE", "RSU", "FOUR_O_ONE_K", "ROTH_IRA", "HSA", "CRYPTO", "HOME_VALUE"]).nullable().optional(),
  liabilityType: z.enum(["MORTGAGE", "CAR_LOAN", "CREDIT_CARD"]).nullable().optional(),
  personId: z.string().nullish(),
}).refine((value) => Boolean(value.assetType) !== Boolean(value.liabilityType), {
  message: "Choose one asset or liability category.",
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  return jsonOk(await db.netWorthAccount.findMany({
    include: { person: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  }));
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;
  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid account");
  try {
    const account = await db.netWorthAccount.create({ data: parsed.data, include: { person: { select: { id: true, name: true } } } });
    return jsonOk(account, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not create the net worth account.");
  }
}
