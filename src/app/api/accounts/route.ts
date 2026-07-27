import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const accountSchema = z.object({
  name: z.string().min(1),
  owner: z.enum(["MATTHEW", "GENEVIEVE", "SHARED"]),
  matthewSplitPercent: z.number().int().min(0).max(100).optional(),
  genevieveSplitPercent: z.number().int().min(0).max(100).optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const accounts = await db.account.findMany({ orderBy: { name: "asc" } });
  return jsonOk(accounts);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid account");
  }

  const matthew = parsed.data.matthewSplitPercent ?? (parsed.data.owner === "MATTHEW" ? 100 : parsed.data.owner === "GENEVIEVE" ? 0 : 50);
  const genevieve = parsed.data.genevieveSplitPercent ?? 100 - matthew;

  try {
    const account = await db.account.create({
      data: {
        name: parsed.data.name,
        owner: parsed.data.owner,
        matthewSplitPercent: matthew,
        genevieveSplitPercent: genevieve,
      },
    });

    return jsonOk(account, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not create the account.");
  }
}
