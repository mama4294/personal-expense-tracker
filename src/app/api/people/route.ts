import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";
import { isPersonColor, nextPersonColor } from "@/lib/colors";

const personSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().refine(isPersonColor, "Pick a colour from the palette.").optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const people = await db.person.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return jsonOk(people);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = personSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid person");
  }

  try {
    const existing = await db.person.findMany({ select: { color: true } });
    const person = await db.person.create({
      data: {
        name: parsed.data.name.trim(),
        sortOrder: existing.length,
        // Default to a palette colour nobody is using yet.
        color:
          parsed.data.color ?? nextPersonColor(existing.map((entry) => entry.color)),
      },
    });
    return jsonOk(person, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not add the person.");
  }
}
