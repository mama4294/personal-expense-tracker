import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseMonthInput(value: string): Date {
  return new Date(`${value}-01T00:00:00.000Z`);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function monthsAgo(months: number, from = new Date()): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - months, 1),
  );
}

export const DEFAULT_CATEGORIES = [
  "Rent",
  "Internet",
  "Cell Phone",
  "Utilities",
  "Groceries",
  "Car Insurance/Payment",
  "Home Insurance",
  "Property Tax",
  "Gasoline",
  "Car Maintenance",
  "House Maintenance",
  "Insurance/Med",
  "Misc",
  "Restaurants",
  "Alcohol",
  "Entertainment",
  "Shopping",
  "Travel",
  "Personal",
  "Dog",
  "Gym",
];

export const ASSET_LABELS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  BROKERAGE: "Brokerage",
  FOUR_O_ONE_K: "401k",
  ROTH_IRA: "Roth IRA",
  HSA: "HSA",
  CRYPTO: "Crypto",
  HOME_VALUE: "Home Value",
};

export const LIABILITY_LABELS: Record<string, string> = {
  MORTGAGE: "Mortgage",
  CAR_LOAN: "Car Loan",
};

export const INVESTMENT_ASSETS = [
  "BROKERAGE",
  "FOUR_O_ONE_K",
  "ROTH_IRA",
  "HSA",
] as const;
