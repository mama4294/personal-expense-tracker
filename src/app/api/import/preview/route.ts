import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { parseCsvContent } from "@/lib/import";

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await request.json();
  const content = body.content as string | undefined;

  if (!content) {
    return jsonError("CSV content is required");
  }

  try {
    const rows = parseCsvContent(content);
    const accountNames = [...new Set(rows.map((row) => row.account))];
    const accounts = await db.account.findMany({
      where: { name: { in: accountNames } },
    });
    const accountMap = new Map(accounts.map((account) => [account.name, account]));

    const hashes = rows.map((row) => row.importHash);
    const existing = await db.transaction.findMany({
      where: { importHash: { in: hashes } },
      select: { importHash: true },
    });
    const existingHashes = new Set(existing.map((item) => item.importHash));

    const categories = await db.category.findMany();
    const categoryMap = new Map(
      categories.map((category) => [category.name.toLowerCase(), category]),
    );

    // Rows repeated inside the upload are duplicates too — only the first one
    // will be created on confirm.
    const seenHashes = new Set<string>();
    const preview = rows.map((row) => {
      const duplicate =
        existingHashes.has(row.importHash) || seenHashes.has(row.importHash);
      seenHashes.add(row.importHash);

      return {
        ...row,
        status: duplicate ? "duplicate" : "new",
        accountKnown: accountMap.has(row.account),
        matchedCategory: row.category
          ? categoryMap.get(row.category.toLowerCase())?.name ?? null
          : null,
      };
    });

    const unknownAccounts = accountNames.filter((name) => !accountMap.has(name));

    return jsonOk({
      preview,
      summary: {
        total: preview.length,
        new: preview.filter((row) => row.status === "new").length,
        duplicates: preview.filter((row) => row.status === "duplicate").length,
        unknownAccounts,
      },
    });
  } catch (previewError) {
    return jsonError(
      previewError instanceof Error ? previewError.message : "Failed to preview import",
    );
  }
}
