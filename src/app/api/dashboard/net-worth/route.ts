import { requireAuth, jsonOk } from "@/lib/api";
import { getNetWorthDashboard } from "@/lib/analytics";

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const person = new URL(request.url).searchParams.get("person");

  return jsonOk(
    await getNetWorthDashboard(person && person !== "COMBINED" ? person : "COMBINED"),
  );
}
