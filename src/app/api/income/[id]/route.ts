import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const incomeSchema = z.object({
  date: z.string().optional(),
  source: z.string().min(1).optional(),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  personId: z.string().min(1).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const parsed = incomeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid income update");
  }

  try {
    const entry = await db.income.update({
      where: { id },
      data: {
        ...parsed.data,
        date: parsed.data.date
          ? new Date(`${parsed.data.date}T00:00:00.000Z`)
          : undefined,
      },
      include: { person: { select: { id: true, name: true } } },
    });

    return jsonOk(entry);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the income entry.");
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
    await db.income.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the income entry.");
  }
}
