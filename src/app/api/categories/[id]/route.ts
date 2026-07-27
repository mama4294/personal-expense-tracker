import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  excludedFromFi: z.boolean().optional(),
});

const mergeSchema = z.object({
  action: z.literal("merge"),
  targetCategoryId: z.string(),
});

const splitSchema = z.object({
  action: z.literal("split"),
  newCategoryName: z.string().min(1),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  if (body.action === "merge") {
    const parsed = mergeSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid merge request");
    if (parsed.data.targetCategoryId === id) {
      return jsonError("Cannot merge a category into itself.");
    }

    try {
      const target = await db.category.findUnique({
        where: { id: parsed.data.targetCategoryId },
      });
      if (!target) return jsonError("Target category not found.", 404);

      // Move the transactions first, then retire the emptied category.
      const moved = await db.$transaction(async (tx) => {
        const result = await tx.transaction.updateMany({
          where: { categoryId: id },
          data: { categoryId: parsed.data.targetCategoryId },
        });
        await tx.category.delete({ where: { id } });
        return result.count;
      });

      return jsonOk({ success: true, moved, targetName: target.name });
    } catch (mergeError) {
      return jsonDbError(mergeError, "Could not merge the categories.");
    }
  }

  if (body.action === "split") {
    const parsed = splitSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid split request");

    try {
      const newCategory = await db.category.create({
        data: { name: parsed.data.newCategoryName },
      });
      return jsonOk(newCategory, 201);
    } catch (splitError) {
      return jsonDbError(splitError, "Could not create the category.");
    }
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid category update");
  }

  try {
    const category = await db.category.update({
      where: { id },
      data: parsed.data,
    });
    return jsonOk(category);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the category.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  try {
    // Deleting a category leaves its transactions uncategorized rather than
    // deleting spending history along with it.
    const orphaned = await db.$transaction(async (tx) => {
      const result = await tx.transaction.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });
      await tx.category.delete({ where: { id } });
      return result.count;
    });

    return jsonOk({ success: true, uncategorized: orphaned });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the category.");
  }
}
