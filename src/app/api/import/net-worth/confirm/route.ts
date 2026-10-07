import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { parseMonth, parseNetWorthCsv } from "@/lib/import-financials";
import type { AssetType, LiabilityType } from "@/generated/prisma/client";

const JOINT_WORDS = ["", "combined", "joint", "household", "shared"];

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  const content = body.content as string | undefined;
  if (!content) return jsonError("CSV content is required");

  try {
    const rows = parseNetWorthCsv(content);
    const bad = rows.find((row) => row.error);
    if (bad) {
      return jsonError(`Row ${bad.line}: ${bad.error}`);
    }
    if (rows.length === 0) {
      return jsonError("No rows to import.");
    }

    const people = await db.person.findMany({ select: { id: true, name: true } });
    const peopleByName = new Map(
      people.map((person) => [person.name.toLowerCase(), person]),
    );

    // Group first: each month is written as a whole, so importing the same file
    // twice leaves the same balances rather than doubling them up.
    const byMonth = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byMonth.get(row.month) ?? [];
      list.push(row);
      byMonth.set(row.month, list);
    }

    let months = 0;
    let balances = 0;

    await db.$transaction(async (tx) => {
      for (const [month, monthRows] of byMonth) {
        const data = await Promise.all(monthRows.map(async (row) => {
          const joint = JOINT_WORDS.includes(row.person.toLowerCase());
          const person = joint
            ? null
            : peopleByName.get(row.person.toLowerCase());

          if (!joint && !person) {
            throw new Error(`Row ${row.line}: no person named "${row.person}"`);
          }

          let accountName = row.accountName;
          const assetType = row.kind === "asset" ? (row.type as AssetType) : null;
          const liabilityType = row.kind === "liability" ? (row.type as LiabilityType) : null;
          let existing = await tx.netWorthAccount.findUnique({ where: { name: accountName } });
          if (!existing && person) {
            accountName = `${row.accountName} (${person.name})`;
            existing = await tx.netWorthAccount.findUnique({ where: { name: accountName } });
          }
          if (existing && (existing.assetType !== assetType || existing.liabilityType !== liabilityType || existing.personId !== (person?.id ?? null))) {
            throw new Error(`Row ${row.line}: account "${accountName}" is configured with a different category or owner in Settings.`);
          }
          const configured = existing ?? await tx.netWorthAccount.create({
            data: { name: accountName, assetType, liabilityType, personId: person?.id ?? null },
          });

          return {
            accountId: configured.id,
            accountName: configured.name,
            assetType,
            liabilityType,
            amount: row.amount,
            personId: person?.id ?? null,
          };
        }));

        const date = parseMonth(month).date;
        const snapshot = await tx.netWorthSnapshot.upsert({
          where: { month: date },
          update: {},
          create: { month: date },
        });

        await tx.netWorthBalance.deleteMany({ where: { snapshotId: snapshot.id } });
        await tx.netWorthBalance.createMany({
          data: data.map((entry) => ({ ...entry, snapshotId: snapshot.id })),
        });

        months += 1;
        balances += data.length;
      }
    });

    return jsonOk({ months, balances });
  } catch (confirmError) {
    if (confirmError instanceof Error && confirmError.message.startsWith("Row ")) {
      return jsonError(confirmError.message);
    }
    return jsonDbError(confirmError, "Failed to import net worth balances.");
  }
}
