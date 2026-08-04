/**
 * Folds a span of months into the single set of totals the Sankey draws.
 *
 * Everything needed is already on the client from the cash-flow fetch, so a
 * range needs no extra request — and summing the same rows the table shows
 * guarantees the chart and the table can't disagree.
 */

export type Named = { name: string; total: number };

export type CashFlowMonth = {
  month: string;
  grossIncome: number;
  otherIncome: number;
  taxes: number;
  retirement401k: number;
  hsa: number;
  medical: number;
  dentalVision: number;
  expenses: number;
  savings: number;
  netIncome: number;
  categories: Named[];
  incomeByCompany: (Named & { personId: string })[];
};

/** Sums like-named entries, keeping the first row's extra fields. */
function mergeNamed<T extends Named>(groups: T[][]): T[] {
  const merged = new Map<string, T>();

  for (const group of groups) {
    for (const entry of group) {
      const running = merged.get(entry.name);
      merged.set(
        entry.name,
        running
          ? { ...running, total: running.total + entry.total }
          : { ...entry },
      );
    }
  }

  return [...merged.values()].sort((a, b) => b.total - a.total);
}

export function aggregateMonths(months: CashFlowMonth[]) {
  const sum = (pick: (month: CashFlowMonth) => number) =>
    months.reduce((total, month) => total + pick(month), 0);

  return {
    months: months.length,
    grossIncome: sum((month) => month.grossIncome),
    otherIncome: sum((month) => month.otherIncome),
    taxes: sum((month) => month.taxes),
    retirement401k: sum((month) => month.retirement401k),
    hsa: sum((month) => month.hsa),
    medical: sum((month) => month.medical),
    dentalVision: sum((month) => month.dentalVision),
    expenses: sum((month) => month.expenses),
    savings: sum((month) => month.savings),
    netIncome: sum((month) => month.netIncome),
    categories: mergeNamed(months.map((month) => month.categories)),
    incomeByCompany: mergeNamed(months.map((month) => month.incomeByCompany)),
  };
}
