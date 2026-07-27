import { requireAuth, jsonOk } from "@/lib/api";
import { getFiDashboard } from "@/lib/analytics";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return jsonOk(await getFiDashboard());
}
