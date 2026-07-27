import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Turns database failures into messages the dashboard can show, so a duplicate
 * name or a still-referenced row doesn't surface as an unhandled 500.
 */
export function jsonDbError(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return jsonError("That name is already in use.", 409);
    }
    if (error.code === "P2003") {
      return jsonError(
        "This record is still referenced by transactions and cannot be removed.",
        409,
      );
    }
    if (error.code === "P2025") {
      return jsonError("Record not found.", 404);
    }
  }

  console.error(fallback, error);
  return jsonError(fallback, 500);
}
