import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const [settings, categories, user] = await Promise.all([
    db.appSettings.findUnique({ where: { id: "default" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.user.findUnique({ where: { id: session!.user.id } }),
  ]);

  return jsonOk({
    settings,
    categories,
    user: user ? { id: user.id, name: user.name, username: user.username } : null,
  });
}

const settingsSchema = z.object({
  withdrawalRate: z.number().min(0.01).max(0.2).optional(),
  categoryFiExclusions: z
    .array(z.object({ id: z.string(), excludedFromFi: z.boolean() }))
    .optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await request.json();

  if (body.action === "change-password") {
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid password update");

    const user = await db.user.findUnique({ where: { id: session!.user.id } });
    if (!user) return jsonError("User not found", 404);

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!valid) return jsonError("Current password is incorrect", 403);

    await db.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(parsed.data.newPassword, 12) },
    });

    return jsonOk({ success: true });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid settings update");
  }

  if (parsed.data.withdrawalRate != null) {
    await db.appSettings.upsert({
      where: { id: "default" },
      update: { withdrawalRate: parsed.data.withdrawalRate },
      create: { withdrawalRate: parsed.data.withdrawalRate },
    });
  }

  if (parsed.data.categoryFiExclusions) {
    for (const category of parsed.data.categoryFiExclusions) {
      await db.category.update({
        where: { id: category.id },
        data: { excludedFromFi: category.excludedFromFi },
      });
    }
  }

  return jsonOk({ success: true });
}
