import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { parseCsvContent, parseDateString } from "@/lib/import";
import { upsertTags } from "@/lib/analytics";

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
    const accounts = await db.account.findMany();
    const accountMap = new Map(accounts.map((account) => [account.name, account]));
    const categories = await db.category.findMany();
    const categoryMap = new Map(
      categories.map((category) => [category.name.toLowerCase(), category]),
    );

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const existing = await db.transaction.findUnique({
        where: { importHash: row.importHash },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const account = accountMap.get(row.account);
      let categoryId: string | undefined;

      if (row.category) {
        const matched = categoryMap.get(row.category.toLowerCase());
        if (matched) {
          categoryId = matched.id;
        } else {
          const createdCategory = await db.category.create({
            data: { name: row.category },
          });
          categoryMap.set(row.category.toLowerCase(), createdCategory);
          categoryId = createdCategory.id;
        }
      }

      const tags = row.tags.length > 0 ? await upsertTags(row.tags) : [];

      // No split rows are written: imported rows inherit their account's
      // default split, so changing an account's ownership later re-attributes
      // its history automatically.
      const transaction = await db.transaction.create({
        data: {
          date: parseDateString(row.date),
          amount: row.amount,
          description: row.description,
          accountId: account?.id,
          categoryId,
          importHash: row.importHash,
          isManual: false,
        },
      });

      if (tags.length > 0) {
        await db.transactionTag.createMany({
          data: tags.map((tag) => ({
            transactionId: transaction.id,
            tagId: tag.id,
          })),
        });
      }

      created += 1;
    }

    return jsonOk({ created, skipped });
  } catch (confirmError) {
    return jsonError(
      confirmError instanceof Error ? confirmError.message : "Failed to import CSV",
    );
  }
}
