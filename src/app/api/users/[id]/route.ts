import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  password: z.string().min(8, "Passwords must be at least 8 characters.").optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid login update");
  }

  try {
    const user = await db.user.update({
      where: { id },
      data: {
        name: parsed.data.name?.trim(),
        password: parsed.data.password
          ? await bcrypt.hash(parsed.data.password, 12)
          : undefined,
      },
      select: { id: true, username: true, name: true, createdAt: true },
    });

    return jsonOk(user);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the login.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  if (session!.user.id === id) {
    return jsonError("You cannot delete the login you are signed in with.");
  }

  // Never leave the app with no way in.
  const total = await db.user.count();
  if (total <= 1) {
    return jsonError("At least one login must remain.");
  }

  try {
    await db.user.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the login.");
  }
}
