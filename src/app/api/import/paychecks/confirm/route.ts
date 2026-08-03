import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
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
    const bad = rows.find((row) => row.error);
    if (bad) {
      return jsonError(`Row ${bad.line}: ${bad.error}`);
    }

    const people = await db.person.findMany({ select: { id: true, name: true } });
    const peopleByName = new Map(
      people.map((person) => [person.name.toLowerCase(), person]),
    );

    let created = 0;
    let updated = 0;

    // One transaction: a half-applied set of paychecks would quietly skew every
    // cash-flow figure, and the user has no way to tell which rows landed.
    await db.$transaction(async (tx) => {
      const companies = await tx.company.findMany({
        select: { id: true, name: true, personId: true },
      });
      const key = (personId: string, name: string) =>
        `${personId}|${name.toLowerCase()}`;
      const companiesByKey = new Map(
        companies.map((company) => [key(company.personId, company.name), company]),
      );

      for (const row of rows) {
        const person = peopleByName.get(row.person.toLowerCase());
        if (!person) {
          throw new Error(`Row ${row.line}: no person named "${row.person}"`);
        }

        let companyId: string | null = null;
        if (row.company) {
          const found = companiesByKey.get(key(person.id, row.company));
          if (found) {
            companyId = found.id;
          } else {
            const madeCompany = await tx.company.create({
              data: { name: row.company, personId: person.id },
            });
            companiesByKey.set(key(person.id, row.company), madeCompany);
            companyId = madeCompany.id;
          }
        }

        const data = {
          annualSalary: row.annualSalary,
          grossIncome: row.grossIncome,
          medical: row.medical,
          dentalVision: row.dentalVision,
          retirement401k: row.retirement401k,
          hsa: row.hsa,
          taxes: row.taxes,
          notes: row.notes || null,
        };

        // Postgres treats NULLs as distinct in a unique index, so the
        // (month, personId, companyId) key can't be upserted when there is no
        // company. Look it up first instead of relying on the constraint.
        const month = parseMonth(row.month).date;
        const existing = await tx.monthlyIncome.findFirst({
          where: { month, personId: person.id, companyId },
          select: { id: true },
        });

        if (existing) {
          await tx.monthlyIncome.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await tx.monthlyIncome.create({
            data: { ...data, month, personId: person.id, companyId },
          });
          created += 1;
        }
      }
    });

    return jsonOk({ created, updated });
  } catch (confirmError) {
    if (confirmError instanceof Error && confirmError.message.startsWith("Row ")) {
      return jsonError(confirmError.message);
    }
    return jsonDbError(confirmError, "Failed to import paychecks.");
  }
}
