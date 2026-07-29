import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Usernames can contain letters, numbers, dots, underscores, and hyphens.",
    ),
  name: z.string().min(1).max(60),
  password: z.string().min(8, "Passwords must be at least 8 characters."),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const users = await db.user.findMany({
    select: { id: true, username: true, name: true, createdAt: true },
    orderBy: { username: "asc" },
  });

  return jsonOk(users);
}

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid login");
  }

  try {
    const user = await db.user.create({
      data: {
        username: parsed.data.username.trim().toLowerCase(),
        name: parsed.data.name.trim(),
        password: await bcrypt.hash(parsed.data.password, 12),
      },
      select: { id: true, username: true, name: true, createdAt: true },
    });

    return jsonOk(user, 201);
  } catch (createError) {
    return jsonDbError(createError, "Could not create the login.");
  }
}
