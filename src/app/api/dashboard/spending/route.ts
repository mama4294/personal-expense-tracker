import { requireAuth, jsonOk, jsonError } from "@/lib/api";
import { filtersFromSearchParams, getSpendingDashboard } from "@/lib/analytics";

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const data = await getSpendingDashboard(filtersFromSearchParams(searchParams));

  return jsonOk(data);
}

export async function POST() {
  return jsonError("Method not allowed", 405);
}
