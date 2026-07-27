import { requireAuth, jsonOk } from "@/lib/api";
import { filtersFromSearchParams, getIncomeDashboard } from "@/lib/analytics";

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const data = await getIncomeDashboard(filtersFromSearchParams(searchParams));

  return jsonOk(data);
}
