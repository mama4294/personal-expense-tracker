export type SplitRow = { personId: string; percent: number };

/** Amount attributed to each person, keyed by person id. */
export type SplitAmounts = Record<string, number>;

export type PersonFilter = string | "COMBINED";

/**
 * Resolves which percentages apply to a transaction, in priority order:
 * its own override, then the account's default, then an even split across the
 * people supplied (used for cash and other account-less entries).
 */
export function resolveSplitPercents(
  transactionSplits: SplitRow[],
  accountSplits: SplitRow[] | null | undefined,
  fallbackPersonIds: string[],
): SplitRow[] {
  if (transactionSplits.length > 0) return transactionSplits;
  if (accountSplits && accountSplits.length > 0) return accountSplits;

  if (fallbackPersonIds.length === 0) return [];

  // Even split, with the remainder going to the first person so the parts
  // always add back to 100.
  const base = Math.floor(100 / fallbackPersonIds.length);
  const remainder = 100 - base * fallbackPersonIds.length;

  return fallbackPersonIds.map((personId, index) => ({
    personId,
    percent: index === 0 ? base + remainder : base,
  }));
}

export function splitAmounts(amount: number, splits: SplitRow[]): SplitAmounts {
  const result: SplitAmounts = {};
  for (const split of splits) {
    result[split.personId] =
      (result[split.personId] ?? 0) + (amount * split.percent) / 100;
  }
  return result;
}

/** The slice of an amount belonging to the filtered person. */
export function personFilteredAmount(
  person: PersonFilter,
  amount: number,
  amounts: SplitAmounts,
): number {
  if (person === "COMBINED") return amount;
  return amounts[person] ?? 0;
}

export function matchesPersonFilter(
  person: PersonFilter,
  amounts: SplitAmounts,
): boolean {
  if (person === "COMBINED") return true;
  return (amounts[person] ?? 0) !== 0;
}

/**
 * How an account or transaction reads in a list: one person at 100% is theirs,
 * anything spread across several is shared.
 */
export function describeSplit(
  splits: SplitRow[],
  personNames: Map<string, string>,
): string {
  const owning = splits.filter((split) => split.percent > 0);

  if (owning.length === 0) return "Unassigned";
  if (owning.length === 1) {
    return personNames.get(owning[0].personId) ?? "Unknown";
  }
  return "Shared";
}

/** Rejects split sets that don't add to 100 or name the same person twice. */
export function validateSplits(splits: SplitRow[]): string | null {
  if (splits.length === 0) return null;

  const seen = new Set<string>();
  for (const split of splits) {
    if (seen.has(split.personId)) {
      return "A person can only appear once in a split.";
    }
    seen.add(split.personId);

    if (!Number.isInteger(split.percent) || split.percent < 0 || split.percent > 100) {
      return "Each share must be a whole number between 0 and 100.";
    }
  }

  const total = splits.reduce((sum, split) => sum + split.percent, 0);
  if (total !== 100) {
    return `Shares must add up to 100% (currently ${total}%).`;
  }

  return null;
}
