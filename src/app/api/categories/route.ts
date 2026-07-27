import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1),
  excludedFromFi: z.boolean().optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return jsonOk(await db.category.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid category");
  }

  try {
    const category = await db.category.create({ data: parsed.data });
    return jsonOk(category, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not create the category.");
  }
}
