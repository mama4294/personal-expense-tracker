import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const personSchema = z.object({
  name: z.string().min(1).max(60),
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
    const count = await db.person.count();
    const person = await db.person.create({
      data: { name: parsed.data.name.trim(), sortOrder: count },
    });
    return jsonOk(person, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not add the person.");
  }
}
