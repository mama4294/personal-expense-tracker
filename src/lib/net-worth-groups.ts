/**
 * Coarse buckets for the home page: categories roll up into a handful of
 * groups so the breakdown chart and summary stay readable.
 */
export const NET_WORTH_GROUPS = [
  { key: "cash", label: "Cash", kind: "asset", types: ["CHECKING", "SAVINGS"] },
  {
    key: "investments",
    label: "Investments",
    kind: "asset",
    types: ["BROKERAGE", "RSU", "FOUR_O_ONE_K", "ROTH_IRA", "HSA", "CRYPTO"],
  },
  { key: "property", label: "Property", kind: "asset", types: ["HOME_VALUE"] },
  { key: "creditCards", label: "Credit Cards", kind: "liability", types: ["CREDIT_CARD"] },
  { key: "loans", label: "Loans", kind: "liability", types: ["MORTGAGE", "CAR_LOAN"] },
] as const;

export type NetWorthGroupKey = (typeof NET_WORTH_GROUPS)[number]["key"];

export function groupForType(type: string | null | undefined): NetWorthGroupKey | null {
  if (!type) return null;
  return NET_WORTH_GROUPS.find((group) => (group.types as readonly string[]).includes(type))?.key ?? null;
}
