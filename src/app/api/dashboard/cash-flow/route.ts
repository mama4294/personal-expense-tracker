import { requireAuth, jsonOk } from "@/lib/api";
import { getCashFlow } from "@/lib/analytics";

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");

  const data = await getCashFlow(person && person !== "COMBINED" ? person : "COMBINED");

  return jsonOk(data);
}
