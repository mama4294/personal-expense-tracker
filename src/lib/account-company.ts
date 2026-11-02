import { z } from "zod";
import { db } from "@/lib/db";
import { logoSchema } from "@/lib/logo";

/**
 * Accounts name their company rather than pick it from a list, so typing
 * "Vanguard" on a new account joins the existing one. Null clears it; a logo
 * here replaces the company's logo for all of its accounts.
 */
export const companyInputSchema = z
  .object({
    name: z.string().trim().min(1),
    logo: logoSchema.nullable().optional(),
  })
  .nullable()
  .optional();

export const accountInclude = {
  splits: { include: { person: { select: { id: true, name: true } } } },
  company: { select: { id: true, name: true, logo: true } },
} as const;

type SplitWithPerson = {
  personId: string;
  percent: number;
  person: { id: string; name: string };
};

/**
 * Net worth has one owner per account: whoever holds all of it. Any shared
 * split, or none at all, counts as the household's (null).
 */
export function netWorthOwner(splits: SplitWithPerson[]) {
  const owned = splits.filter((split) => split.percent > 0);
  return owned.length === 1 && owned[0].percent === 100 ? owned[0].person : null;
}

/** Adds the derived net worth owner the dashboards key balances on. */
export function withOwner<T extends { splits: SplitWithPerson[] }>(account: T) {
  const person = netWorthOwner(account.splits);
  return { ...account, personId: person?.id ?? null, person };
}

/** Undefined leaves the account's company alone; null unlinks it. */
export async function resolveCompanyId(
  input: z.infer<typeof companyInputSchema>,
): Promise<string | null | undefined> {
  if (input === undefined) return undefined;
  if (input === null) return null;

  // Case-insensitive, so "vanguard" doesn't spawn a second Vanguard.
  const existing = await db.institution.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });
  if (existing) {
    if (input.logo !== undefined && input.logo !== existing.logo) {
      await db.institution.update({
        where: { id: existing.id },
        data: { logo: input.logo },
      });
    }
    return existing.id;
  }

  const created = await db.institution.create({
    data: { name: input.name, logo: input.logo ?? null },
  });
  return created.id;
}

/** Companies only exist through their accounts, so drop any left without one. */
export async function pruneCompanies() {
  await db.institution.deleteMany({ where: { accounts: { none: {} } } });
}
