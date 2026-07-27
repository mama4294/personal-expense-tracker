import { createHash } from "crypto";
import Papa from "papaparse";
import { z } from "zod";

export const csvRowSchema = z.object({
  Date: z.string().min(1),
  Account: z.string().min(1),
  Description: z.string().min(1),
  Category: z.string().optional(),
  Tags: z.string().optional(),
  Amount: z.string().min(1),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

export type ParsedImportRow = {
  date: string;
  account: string;
  description: string;
  category: string | null;
  tags: string[];
  amount: number;
  importHash: string;
};

export function createImportHash(
  date: string,
  account: string,
  description: string,
  amount: number,
): string {
  const normalized = [
    date.trim(),
    account.trim().toLowerCase(),
    description.trim().toLowerCase(),
    amount.toFixed(2),
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex");
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return Math.abs(value);
}

export function parseCsvContent(content: string): ParsedImportRow[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? "Failed to parse CSV");
  }

  const rows: ParsedImportRow[] = [];

  for (const [index, row] of result.data.entries()) {
    const parsed = csvRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new Error(`Row ${index + 2}: ${parsed.error.issues[0]?.message}`);
    }

    const amount = parseAmount(parsed.data.Amount);
    const date = parsed.data.Date.trim();
    const account = parsed.data.Account.trim();
    const description = parsed.data.Description.trim();
    const tags = parsed.data.Tags
      ? parsed.data.Tags.split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    rows.push({
      date,
      account,
      description,
      category: parsed.data.Category?.trim() || null,
      tags,
      amount,
      importHash: createImportHash(date, account, description, amount),
    });
  }

  return rows;
}

export function parseDateString(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}
