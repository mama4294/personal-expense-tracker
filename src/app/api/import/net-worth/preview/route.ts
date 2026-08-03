import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { knownAccountLabels, parseNetWorthCsv } from "@/lib/import-financials";

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  const content = body.content as string | undefined;
  if (!content) return jsonError("CSV content is required");

  try {
    const rows = parseNetWorthCsv(content);

    const [people, snapshots] = await Promise.all([
      db.person.findMany({ select: { id: true, name: true } }),
      db.netWorthSnapshot.findMany({
        select: { month: true, _count: { select: { balances: true } } },
      }),
    ]);

    const peopleByName = new Map(
      people.map((person) => [person.name.toLowerCase(), person]),
    );
    const existingByMonth = new Map(
      snapshots.map((snapshot) => [
        snapshot.month.toISOString().slice(0, 7),
        snapshot._count.balances,
      ]),
    );

    const warnings: string[] = [];
    const monthsInFile = new Set<string>();
    const seen = new Set<string>();

    const preview = rows.map((row) => {
      if (row.error) {
        return { ...row, status: "error" as const, personKnown: false };
      }

      // Blank, "combined", "joint" and "household" all mean the household.
      const jointWords = ["", "combined", "joint", "household", "shared"];
      const isJoint = jointWords.includes(row.person.toLowerCase());
      const person = isJoint
        ? null
        : peopleByName.get(row.person.toLowerCase());

      if (!isJoint && !person) {
        return {
          ...row,
          status: "error" as const,
          error: `No person named "${row.person}". Use Combined for jointly held accounts.`,
          personKnown: false,
        };
      }

      const key = `${row.month}|${row.type}|${person?.id ?? ""}`;
      if (seen.has(key)) {
        return {
          ...row,
          status: "error" as const,
          error: "Another row in this file already covers that account and holder.",
          personKnown: true,
        };
      }
      seen.add(key);
      monthsInFile.add(row.month);

      return {
        ...row,
        person: isJoint ? "Combined" : (person?.name ?? row.person),
        status: (existingByMonth.has(row.month) ? "update" : "new") as
          | "update"
          | "new",
        personKnown: true,
      };
    });

    // Replacing whole months is what makes a re-import idempotent, but it also
    // means a partial file silently drops accounts. Say so before they confirm.
    const replacing = [...monthsInFile]
      .filter((month) => existingByMonth.has(month))
      .sort();

    if (replacing.length > 0) {
      const dropped = replacing.reduce(
        (sum, month) => sum + (existingByMonth.get(month) ?? 0),
        0,
      );
      warnings.push(
        `${replacing.join(", ")} already ${replacing.length === 1 ? "has" : "have"} balances. Importing replaces ${dropped} existing row${dropped === 1 ? "" : "s"} with the ${preview.filter((r) => !r.error && replacing.includes(r.month)).length} in this file — any account missing here is removed from those months.`,
      );
    }

    if (rows.some((row) => row.error?.startsWith("Unknown account type"))) {
      warnings.push(`Known accounts: ${knownAccountLabels().join(", ")}.`);
    }

    return jsonOk({
      preview,
      summary: {
        total: preview.length,
        create: preview.filter((row) => row.status === "new").length,
        update: preview.filter((row) => row.status === "update").length,
        errors: preview.filter((row) => row.status === "error").length,
        warnings,
      },
    });
  } catch (previewError) {
    return jsonError(
      previewError instanceof Error
        ? previewError.message
        : "Failed to preview the net worth import",
    );
  }
}
