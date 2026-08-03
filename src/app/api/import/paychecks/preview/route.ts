import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { parseMonth, parsePaycheckCsv } from "@/lib/import-financials";

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  const content = body.content as string | undefined;
  if (!content) return jsonError("CSV content is required");

  try {
    const rows = parsePaycheckCsv(content);

    const [people, companies, existing] = await Promise.all([
      db.person.findMany({ select: { id: true, name: true, isActive: true } }),
      db.company.findMany({ select: { id: true, name: true, personId: true } }),
      db.monthlyIncome.findMany({
        select: { month: true, personId: true, companyId: true },
      }),
    ]);

    const peopleByName = new Map(
      people.map((person) => [person.name.toLowerCase(), person]),
    );
    const companyKey = (personId: string, name: string) =>
      `${personId}|${name.toLowerCase()}`;
    const companiesByKey = new Map(
      companies.map((company) => [
        companyKey(company.personId, company.name),
        company,
      ]),
    );
    const existingKeys = new Set(
      existing.map(
        (entry) =>
          `${entry.month.toISOString().slice(0, 7)}|${entry.personId}|${entry.companyId ?? ""}`,
      ),
    );

    const warnings: string[] = [];
    const newCompanies = new Set<string>();
    // A file that lists the same person, company and month twice would upsert
    // over itself; flag it rather than silently keeping the last one.
    const seen = new Set<string>();

    const preview = rows.map((row) => {
      if (row.error) {
        return { ...row, status: "error" as const, personKnown: false, companyNew: false };
      }

      const person = peopleByName.get(row.person.toLowerCase());
      if (!person) {
        return {
          ...row,
          status: "error" as const,
          error: `No person named "${row.person}". Add them in Settings first.`,
          personKnown: false,
          companyNew: false,
        };
      }

      if (!person.isActive) {
        warnings.push(`${person.name} is inactive but appears in this file.`);
      }

      const company = row.company
        ? companiesByKey.get(companyKey(person.id, row.company))
        : undefined;
      const companyNew = Boolean(row.company) && !company;
      if (companyNew) newCompanies.add(`${row.company} (${person.name})`);

      const key = `${row.month}|${person.id}|${company?.id ?? ""}`;
      const duplicateInFile = seen.has(key);
      seen.add(key);

      if (duplicateInFile) {
        return {
          ...row,
          status: "error" as const,
          error: "Another row in this file already covers that month and company.",
          personKnown: true,
          companyNew,
        };
      }

      return {
        ...row,
        // A company that doesn't exist yet can't have an existing paycheck.
        status: (existingKeys.has(key) ? "update" : "new") as "update" | "new",
        personKnown: true,
        companyNew,
      };
    });

    if (newCompanies.size > 0) {
      warnings.push(
        `Will create ${newCompanies.size} new compan${newCompanies.size === 1 ? "y" : "ies"}: ${[...newCompanies].join(", ")}.`,
      );
    }

    const months = [...new Set(preview.filter((r) => !r.error).map((r) => r.month))];
    if (months.length > 0) {
      // Parsing again is cheap and keeps the sort honest about real dates.
      months.sort((a, b) => parseMonth(a).key.localeCompare(parseMonth(b).key));
      warnings.push(
        `Covers ${months.length} month${months.length === 1 ? "" : "s"}: ${months[0]} to ${months[months.length - 1]}.`,
      );
    }

    return jsonOk({
      preview,
      summary: {
        total: preview.length,
        create: preview.filter((row) => row.status === "new").length,
        update: preview.filter((row) => row.status === "update").length,
        errors: preview.filter((row) => row.status === "error").length,
        warnings: [...new Set(warnings)],
      },
    });
  } catch (previewError) {
    return jsonError(
      previewError instanceof Error
        ? previewError.message
        : "Failed to preview the paycheck import",
    );
  }
}
