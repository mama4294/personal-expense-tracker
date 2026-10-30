import { requireAuth, jsonOk } from "@/lib/api";
import { filtersFromSearchParams, getSpendingByCategoryMonth } from "@/lib/analytics";

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const data = await getSpendingByCategoryMonth(
    filtersFromSearchParams(searchParams).person,
  );

  return jsonOk(data);
}
