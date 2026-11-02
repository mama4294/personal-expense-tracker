/** Net worth categories an account can be tracked under; mirrors the Prisma enums. */
export const ASSET_TYPES = [
  "CHECKING",
  "SAVINGS",
  "BROKERAGE",
  "RSU",
  "FOUR_O_ONE_K",
  "ROTH_IRA",
  "HSA",
  "CRYPTO",
  "HOME_VALUE",
] as const;

export const LIABILITY_TYPES = ["MORTGAGE", "CAR_LOAN", "CREDIT_CARD"] as const;
