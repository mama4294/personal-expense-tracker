import { INVESTMENT_ASSETS } from "@/lib/utils";
import type { NetWorthBalance } from "@/generated/prisma/client";

export type FiMetrics = {
  annualSpending: number;
  fiNumber: number;
  currentInvestments: number;
  monthlyWithdrawal: number;
  annualWithdrawal: number;
  remaining: number;
  progressPercent: number;
  withdrawalRate: number;
};

export type FiTransaction = {
  date: Date;
  amount: number;
  categoryId: string | null;
};

/**
 * Trailing twelve months of spending as of `asOf`: everything from the start of
 * the month eleven months back through the end of the `asOf` month. Categories
 * flagged as excluded from FI are left out.
 */
export function trailingTwelveMonthSpending(
  transactions: FiTransaction[],
  excludedCategoryIds: Set<string>,
  asOf: Date,
): number {
  const start = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 11, 1);
  const end = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1);

  return transactions
    .filter((transaction) => {
      const time = transaction.date.getTime();
      if (time < start || time >= end) return false;
      return !transaction.categoryId || !excludedCategoryIds.has(transaction.categoryId);
    })
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function sumInvestments(balances: NetWorthBalance[]): number {
  return balances
    .filter(
      (balance) =>
        balance.assetType &&
        INVESTMENT_ASSETS.includes(
          balance.assetType as (typeof INVESTMENT_ASSETS)[number],
        ),
    )
    .reduce((sum, balance) => sum + Number(balance.amount), 0);
}

export function calculateFiMetrics(
  annualSpending: number,
  currentInvestments: number,
  withdrawalRate: number,
): FiMetrics {
  const fiNumber = withdrawalRate > 0 ? annualSpending / withdrawalRate : 0;
  const annualWithdrawal = currentInvestments * withdrawalRate;
  const monthlyWithdrawal = annualWithdrawal / 12;
  const remaining = Math.max(fiNumber - currentInvestments, 0);
  const progressPercent =
    fiNumber > 0 ? Math.min(currentInvestments / fiNumber, 1) : 0;

  return {
    annualSpending,
    fiNumber,
    currentInvestments,
    monthlyWithdrawal,
    annualWithdrawal,
    remaining,
    progressPercent,
    withdrawalRate,
  };
}

export function groupByMonth<T extends { date: Date; amount: number }>(
  items: T[],
): { month: string; total: number }[] {
  const map = new Map<string, number>();

  for (const item of items) {
    const key = `${item.date.getUTCFullYear()}-${String(item.date.getUTCMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + item.amount);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}
