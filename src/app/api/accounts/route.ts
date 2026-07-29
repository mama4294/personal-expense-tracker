import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { validateSplits } from "@/lib/splits";
import { z } from "zod";

const accountSchema = z.object({
  name: z.string().min(1),
  splits: z
    .array(
      z.object({
        personId: z.string().min(1),
        percent: z.number().int().min(0).max(100),
      }),
    )
    .default([]),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const accounts = await db.account.findMany({
    include: { splits: true },
    orderBy: { name: "asc" },
  });

  return jsonOk(accounts);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = accountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid account");
  }

  // Drop zero shares so an account owned outright records one row, not several.
  const splits = parsed.data.splits.filter((split) => split.percent > 0);
  const invalid = validateSplits(splits);
  if (invalid) return jsonError(invalid);

  try {
    const account = await db.account.create({
      data: {
        name: parsed.data.name.trim(),
        splits: { create: splits },
      },
      include: { splits: true },
    });

    return jsonOk(account, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not create the account.");
  }
}
