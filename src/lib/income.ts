/**
 * Paycheck maths, in one place so the API, the dashboards, and the forms can't
 * drift apart on what "net" and "savings" mean.
 */
export type Paycheck = {
  grossIncome: number;
  medical: number;
  dentalVision: number;
  retirement401k: number;
  hsa: number;
  taxes: number;
};

export const DEDUCTION_FIELDS = [
  { key: "taxes", label: "Taxes" },
  { key: "retirement401k", label: "401k" },
  { key: "hsa", label: "HSA" },
  { key: "medical", label: "Medical" },
  { key: "dentalVision", label: "Dental & Vision" },
] as const;

export type DeductionKey = (typeof DEDUCTION_FIELDS)[number]["key"];

export function totalDeductions(paycheck: Paycheck): number {
  return (
    paycheck.medical +
    paycheck.dentalVision +
    paycheck.retirement401k +
    paycheck.hsa +
    paycheck.taxes
  );
}

/** What actually lands in the bank: gross less every deduction. */
export function netIncome(paycheck: Paycheck): number {
  return paycheck.grossIncome - totalDeductions(paycheck);
}

/**
 * Money saved before it was ever spendable. It never appears in net income, so
 * cash-flow savings adds it back rather than treating it as money gone.
 */
export function preTaxSavings(paycheck: Paycheck): number {
  return paycheck.retirement401k + paycheck.hsa;
}

export function emptyPaycheck(): Paycheck {
  return {
    grossIncome: 0,
    medical: 0,
    dentalVision: 0,
    retirement401k: 0,
    hsa: 0,
    taxes: 0,
  };
}

export function addPaychecks(a: Paycheck, b: Paycheck): Paycheck {
  return {
    grossIncome: a.grossIncome + b.grossIncome,
    medical: a.medical + b.medical,
    dentalVision: a.dentalVision + b.dentalVision,
    retirement401k: a.retirement401k + b.retirement401k,
    hsa: a.hsa + b.hsa,
    taxes: a.taxes + b.taxes,
  };
}

/** Savings = what reached the bank, plus what was diverted, less what was spent. */
export function monthlySavings(
  paycheck: Paycheck,
  otherIncome: number,
  expenses: number,
): number {
  return netIncome(paycheck) + otherIncome + preTaxSavings(paycheck) - expenses;
}

/**
 * Savings as a share of net income. Null when there's no net income to divide
 * by — a rate against zero or negative income would be noise, not information.
 */
export function savingsRate(savings: number, net: number): number | null {
  if (net <= 0) return null;
  return savings / net;
}
