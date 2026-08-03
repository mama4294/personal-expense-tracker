/**
 * What commit this container was built from.
 *
 * A green GitHub Action only means the image was published — the server still
 * has to pull it, and a stale image looks identical to a fresh one. Reading this
 * in the running app is the only way to answer "is my push actually live?"
 * without comparing registry digests by hand.
 *
 * Set as build args in the Dockerfile's runner stage, so it reflects the image
 * rather than anything the container is configured with at runtime.
 */
export const BUILD_SHA = process.env.BUILD_SHA ?? "unknown";
export const BUILD_TIME = process.env.BUILD_TIME ?? "unknown";

/** Short form, as GitHub displays it. */
export function shortSha(sha: string = BUILD_SHA): string {
  return sha === "unknown" ? "dev" : sha.slice(0, 7);
}
