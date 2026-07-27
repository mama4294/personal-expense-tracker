import type { Account, AccountOwner, Owner, Transaction } from "@/generated/prisma/client";

export type SplitAmounts = {
  matthew: number;
  genevieve: number;
};

export function getSplitPercents(
  transaction: Pick<
    Transaction,
    "matthewSplitPercent" | "genevieveSplitPercent" | "owner"
  >,
  account?: Pick<
    Account,
    "owner" | "matthewSplitPercent" | "genevieveSplitPercent"
  > | null,
): { matthew: number; genevieve: number } {
  if (transaction.matthewSplitPercent != null) {
    return {
      matthew: transaction.matthewSplitPercent,
      genevieve:
        transaction.genevieveSplitPercent ??
        100 - transaction.matthewSplitPercent,
    };
  }

  if (account) {
    if (account.owner === "MATTHEW") {
      return { matthew: 100, genevieve: 0 };
    }
    if (account.owner === "GENEVIEVE") {
      return { matthew: 0, genevieve: 100 };
    }
    return {
      matthew: account.matthewSplitPercent,
      genevieve: account.genevieveSplitPercent,
    };
  }

  if (transaction.owner === "MATTHEW") {
    return { matthew: 100, genevieve: 0 };
  }
  if (transaction.owner === "GENEVIEVE") {
    return { matthew: 0, genevieve: 100 };
  }

  return { matthew: 50, genevieve: 50 };
}

export function getPersonAmounts(
  amount: number,
  transaction: Pick<
    Transaction,
    "matthewSplitPercent" | "genevieveSplitPercent" | "owner"
  >,
  account?: Pick<
    Account,
    "owner" | "matthewSplitPercent" | "genevieveSplitPercent"
  > | null,
): SplitAmounts {
  const split = getSplitPercents(transaction, account);
  return {
    matthew: (amount * split.matthew) / 100,
    genevieve: (amount * split.genevieve) / 100,
  };
}

export function resolveOwnerFromAccount(accountOwner: AccountOwner): Owner {
  if (accountOwner === "MATTHEW") return "MATTHEW";
  if (accountOwner === "GENEVIEVE") return "GENEVIEVE";
  return "SHARED";
}

export function matchesPersonFilter(
  person: "MATTHEW" | "GENEVIEVE" | "COMBINED",
  split: SplitAmounts,
): boolean {
  if (person === "COMBINED") return true;
  if (person === "MATTHEW") return split.matthew > 0;
  return split.genevieve > 0;
}

export function personFilteredAmount(
  person: "MATTHEW" | "GENEVIEVE" | "COMBINED",
  amount: number,
  split: SplitAmounts,
): number {
  if (person === "COMBINED") return amount;
  if (person === "MATTHEW") return split.matthew;
  return split.genevieve;
}
