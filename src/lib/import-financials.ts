import Papa from "papaparse";
import { ASSET_LABELS, LIABILITY_LABELS } from "@/lib/utils";

/**
 * Shared shape for the preview/confirm pair. Unlike the transaction import,
 * re-importing a paycheck or a month's balances is an update rather than a
 * duplicate to skip: these are one-per-month records the user is correcting.
 */
export type RowStatus = "new" | "update" | "error";

export type ImportSummary = {
  total: number;
  create: number;
  update: number;
  errors: number;
  /** Things worth reading before confirming, not reasons to block. */
  warnings: string[];
};

/** Reads a CSV into loosely typed rows, with trimmed, case-folded headers. */
export function parseRows(content: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? "Failed to parse CSV");
  }

  return result.data;
}

/** First non-empty value among the accepted spellings of a column. */
export function field(
  row: Record<string, string>,
  ...names: string[]
): string {
  for (const name of names) {
    const value = row[name];
    if (value != null && value.trim() !== "") return value.trim();
  }
  return "";
}

/**
 * Money as typed by a human: "$1,234.56", "(50)" for negative, or blank. Blank
 * is zero rather than an error, so a CSV can omit deductions it doesn't have.
 */
export function parseMoney(raw: string, label: string): number {
  if (raw === "") return 0;

  const negative = /^\(.*\)$/.test(raw.trim());
  const cleaned = raw.replace(/[()$,\s]/g, "");
  const value = Number.parseFloat(cleaned);

  if (Number.isNaN(value)) {
    throw new Error(`${label} is not a number: "${raw}"`);
  }

  return negative ? -value : value;
}

/**
 * Accepts "2026-08" or any date in that month, and returns the first of the
 * month in UTC — the same normalisation the paycheck and snapshot forms use.
 */
export function parseMonth(raw: string): { key: string; date: Date } {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})/.exec(trimmed);

  if (!match) {
    throw new Error(`Month must look like 2026-08, got "${raw}"`);
  }

  const [, year, month] = match;
  const date = new Date(`${year}-${month}-01T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || Number(month) < 1 || Number(month) > 12) {
    throw new Error(`Invalid month: "${raw}"`);
  }

  return { key: `${year}-${month}`, date };
}

// --- net worth account matching ------------------------------------------

/**
 * Maps a spreadsheet label onto an asset or liability type. Accepts the label
 * shown in the app ("Roth IRA"), the enum name ("ROTH_IRA"), and sloppy
 * spacing or punctuation, so a hand-built CSV doesn't have to know the schema.
 */
function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ACCOUNT_LOOKUP = new Map<string, { kind: "asset" | "liability"; type: string }>();

for (const [type, label] of Object.entries(ASSET_LABELS)) {
  ACCOUNT_LOOKUP.set(normalizeKey(label), { kind: "asset", type });
  ACCOUNT_LOOKUP.set(normalizeKey(type), { kind: "asset", type });
}
for (const [type, label] of Object.entries(LIABILITY_LABELS)) {
  ACCOUNT_LOOKUP.set(normalizeKey(label), { kind: "liability", type });
  ACCOUNT_LOOKUP.set(normalizeKey(type), { kind: "liability", type });
}
// "401k" normalises to "401k" already, but people also write "401(k)".
ACCOUNT_LOOKUP.set("401k", { kind: "asset", type: "FOUR_O_ONE_K" });

export function matchAccountType(raw: string) {
  return ACCOUNT_LOOKUP.get(normalizeKey(raw)) ?? null;
}

export function knownAccountLabels(): string[] {
  return [...Object.values(ASSET_LABELS), ...Object.values(LIABILITY_LABELS)];
}

// --- parsed row shapes ----------------------------------------------------

export type PaycheckRow = {
  line: number;
  month: string;
  person: string;
  company: string;
  annualSalary: number;
  grossIncome: number;
  medical: number;
  dentalVision: number;
  retirement401k: number;
  hsa: number;
  taxes: number;
  notes: string;
  error: string | null;
};

export function parsePaycheckCsv(content: string): PaycheckRow[] {
  return parseRows(content).map((row, index) => {
    const line = index + 2;
    const base = {
      line,
      month: field(row, "month", "date"),
      person: field(row, "person", "name"),
      company: field(row, "company", "employer"),
      annualSalary: 0,
      grossIncome: 0,
      medical: 0,
      dentalVision: 0,
      retirement401k: 0,
      hsa: 0,
      taxes: 0,
      notes: field(row, "notes", "note"),
      error: null as string | null,
    };

    try {
      if (!base.month) throw new Error("Month is required");
      if (!base.person) throw new Error("Person is required");

      const { key } = parseMonth(base.month);

      return {
        ...base,
        month: key,
        annualSalary: parseMoney(
          field(row, "annual salary", "annualsalary", "salary"),
          "Annual Salary",
        ),
        grossIncome: parseMoney(
          field(row, "gross", "gross income", "grossincome"),
          "Gross",
        ),
        medical: parseMoney(field(row, "medical"), "Medical"),
        dentalVision: parseMoney(
          field(row, "dental & vision", "dental and vision", "dental", "dentalvision"),
          "Dental & Vision",
        ),
        retirement401k: parseMoney(
          field(row, "401k", "401(k)", "retirement401k", "retirement"),
          "401k",
        ),
        hsa: parseMoney(field(row, "hsa"), "HSA"),
        taxes: parseMoney(field(row, "taxes", "tax"), "Taxes"),
      };
    } catch (rowError) {
      return {
        ...base,
        error: rowError instanceof Error ? rowError.message : "Invalid row",
      };
    }
  });
}

export type NetWorthRow = {
  line: number;
  month: string;
  account: string;
  /** Resolved enum name, or null when the label didn't match anything. */
  type: string | null;
  kind: "asset" | "liability" | null;
  person: string;
  amount: number;
  error: string | null;
};

export function parseNetWorthCsv(content: string): NetWorthRow[] {
  return parseRows(content).map((row, index) => {
    const line = index + 2;
    const account = field(row, "account", "type", "asset", "liability");
    const base = {
      line,
      month: field(row, "month", "date"),
      account,
      type: null as string | null,
      kind: null as "asset" | "liability" | null,
      person: field(row, "person", "owner", "holder"),
      amount: 0,
      error: null as string | null,
    };

    try {
      if (!base.month) throw new Error("Month is required");
      if (!account) throw new Error("Account is required");

      const { key } = parseMonth(base.month);
      const matched = matchAccountType(account);
      if (!matched) throw new Error(`Unknown account type "${account}"`);

      return {
        ...base,
        month: key,
        type: matched.type,
        kind: matched.kind,
        // Liabilities are stored positive; a CSV exported with them negative
        // means the same thing, so take the magnitude rather than rejecting it.
        amount: Math.abs(parseMoney(field(row, "amount", "value", "balance"), "Amount")),
      };
    } catch (rowError) {
      return {
        ...base,
        error: rowError instanceof Error ? rowError.message : "Invalid row",
      };
    }
  });
}
