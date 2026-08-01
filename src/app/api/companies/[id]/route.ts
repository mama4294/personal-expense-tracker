import { requireAuth, jsonOk, jsonError, jsonDbError } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
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
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid company update");
  }

  try {
    const company = await db.company.update({
      where: { id },
      data: { ...parsed.data, name: parsed.data.name?.trim() },
      include: { person: { select: { id: true, name: true } } },
    });

    return jsonOk(company);
  } catch (updateError) {
    return jsonDbError(updateError, "Could not update the company.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Paychecks point at the company, so removing one would orphan pay history.
  const paychecks = await db.monthlyIncome.count({ where: { companyId: id } });
  if (paychecks > 0) {
    return jsonError(
      `This company has ${paychecks} paycheck${paychecks === 1 ? "" : "s"} recorded against it. Deactivate it instead to keep the history.`,
      409,
    );
  }

  try {
    await db.company.delete({ where: { id } });
    return jsonOk({ success: true });
  } catch (deleteError) {
    return jsonDbError(deleteError, "Could not delete the company.");
  }
}
