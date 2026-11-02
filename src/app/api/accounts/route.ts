import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { validateSplits } from "@/lib/splits";
import {
  accountInclude,
  companyInputSchema,
  resolveCompanyId,
  withOwner,
} from "@/lib/account-company";
import { ASSET_TYPES, LIABILITY_TYPES } from "@/lib/account-types";
import { z } from "zod";

const accountSchema = z
  .object({
    name: z.string().min(1),
    nickname: z.string().nullish(),
    company: companyInputSchema,
    assetType: z.enum(ASSET_TYPES).nullish(),
    liabilityType: z.enum(LIABILITY_TYPES).nullish(),
    splits: z
      .array(
        z.object({
          personId: z.string().min(1),
          percent: z.number().int().min(0).max(100),
        }),
      )
      .default([]),
  })
  .refine((value) => !(value.assetType && value.liabilityType), {
    message: "Choose an asset or a liability category, not both.",
  });

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const accounts = await db.account.findMany({
    include: accountInclude,
    orderBy: { name: "asc" },
  });

  return jsonOk(accounts.map(withOwner));
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
    const companyId = await resolveCompanyId(parsed.data.company);
    const account = await db.account.create({
      data: {
        name: parsed.data.name.trim(),
        nickname: parsed.data.nickname?.trim() || null,
        companyId: companyId ?? null,
        assetType: parsed.data.assetType ?? null,
        liabilityType: parsed.data.liabilityType ?? null,
        splits: { create: splits },
      },
      include: accountInclude,
    });

    return jsonOk(withOwner(account), 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not create the account.");
  }
}
