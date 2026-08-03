import { requireAuth, jsonOk } from "@/lib/api";
import { BUILD_SHA, BUILD_TIME, shortSha } from "@/lib/version";

/**
 * Behind auth like every other route: the exact commit a public deployment is
 * running is a hint worth not handing out. Signed in, it's a one-request answer
 * to "did my push land?".
 */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return jsonOk({
    sha: BUILD_SHA,
    shortSha: shortSha(),
    builtAt: BUILD_TIME,
  });
}
