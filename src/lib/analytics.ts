import { db } from "@/lib/db";
import {
  calculateFiMetrics,
  sumInvestments,
  trailingTwelveMonthSpending,
  type FiTransaction,
} from "@/lib/fi";
import {
  matchesPersonFilter,
  personFilteredAmount,
  resolveSplitPercents,
  splitAmounts,
  type PersonFilter,
  type SplitRow,
} from "@/lib/splits";
import type { Prisma } from "@/generated/prisma/client";

export type { PersonFilter };

export type DashboardFilters = {
  person?: PersonFilter;
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  accountId?: string;
  tag?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
};

/** Reads the filter set shared by the dashboards and the transaction list. */
export function filtersFromSearchParams(
  searchParams: URLSearchParams,
): DashboardFilters {
  const number = (key: string) => {
    const raw = searchParams.get(key);
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const date = (key: string) => {
    const raw = searchParams.get(key);
    return raw ? new Date(`${raw}T00:00:00.000Z`) : undefined;
  };

  const person = searchParams.get("person");

  return {
    person: person && person !== "COMBINED" ? person : "COMBINED",
    startDate: date("startDate"),
    endDate: date("endDate"),
    categoryId: searchParams.get("categoryId") ?? undefined,
    accountId: searchParams.get("accountId") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    minAmount: number("minAmount"),
    maxAmount: number("maxAmount"),
    search: searchParams.get("search") ?? undefined,
  };
}

function buildTransactionWhere(filters: DashboardFilters): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {};

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = filters.startDate;
    if (filters.endDate) where.date.lte = filters.endDate;
  }

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.accountId) where.accountId = filters.accountId;

  if (filters.tag) {
    where.tags = {
      some: {
        tag: {
          name: { equals: filters.tag, mode: "insensitive" },
        },
      },
    };
  }

  if (filters.minAmount != null || filters.maxAmount != null) {
    where.amount = {};
    if (filters.minAmount != null) where.amount.gte = filters.minAmount;
    if (filters.maxAmount != null) where.amount.lte = filters.maxAmount;
  }

  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { notes: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function getActivePeople() {
  return db.person.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getTransactionsWithDetails(filters: DashboardFilters = {}) {
  return db.transaction.findMany({
    where: buildTransactionWhere(filters),
    include: {
      account: { include: { splits: true } },
      category: true,
      splits: true,
      tags: { include: { tag: true } },
    },
    orderBy: { date: "desc" },
  });
}

type DetailedTransaction = Awaited<
  ReturnType<typeof getTransactionsWithDetails>
>[number];

function toSplitRows(rows: { personId: string; percent: number }[]): SplitRow[] {
  return rows.map((row) => ({ personId: row.personId, percent: row.percent }));
}

export function mapTransactionAmounts(
  transactions: DetailedTransaction[],
  activePersonIds: string[],
  person: PersonFilter = "COMBINED",
) {
  return transactions.map((transaction) => {
    const amount = Number(transaction.amount);
    const splits = resolveSplitPercents(
      toSplitRows(transaction.splits),
      transaction.account ? toSplitRows(transaction.account.splits) : null,
      activePersonIds,
    );
    const amounts = splitAmounts(amount, splits);

    return {
      ...transaction,
      amount,
      splits,
      amounts,
      hasOverride: transaction.splits.length > 0,
      filteredAmount: personFilteredAmount(person, amount, amounts),
    };
  });
}

/**
 * Transaction list for the expenses table: resolved per-person amounts, and
 * when a person filter is active, only rows that person has a share of.
 */
export async function getTransactionList(filters: DashboardFilters = {}) {
  const person = filters.person ?? "COMBINED";
  const [transactions, people] = await Promise.all([
    getTransactionsWithDetails(filters),
    getActivePeople(),
  ]);

  const activePersonIds = people.map((entry) => entry.id);

  return mapTransactionAmounts(transactions, activePersonIds, person)
    .filter((transaction) => matchesPersonFilter(person, transaction.amounts))
    .map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      notes: transaction.notes,
      amount: transaction.amount,
      isManual: transaction.isManual,
      hasOverride: transaction.hasOverride,
      account: transaction.account
        ? { id: transaction.account.id, name: transaction.account.name }
        : null,
      category: transaction.category
        ? { id: transaction.category.id, name: transaction.category.name }
        : null,
      tags: transaction.tags.map((link) => link.tag.name),
      splits: transaction.splits,
      amounts: transaction.amounts,
      filteredAmount: transaction.filteredAmount,
    }));
}

export async function getSpendingDashboard(filters: DashboardFilters = {}) {
  const person = filters.person ?? "COMBINED";
  const [transactions, people] = await Promise.all([
    getTransactionsWithDetails(filters),
    getActivePeople(),
  ]);

  const activePersonIds = people.map((entry) => entry.id);
  const mapped = mapTransactionAmounts(transactions, activePersonIds, person);

  const monthlyMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const accountMap = new Map<string, number>();
  const personTotals = new Map<string, number>(
    people.map((entry) => [entry.id, 0]),
  );

  for (const transaction of mapped) {
    const monthKey = `${transaction.date.getUTCFullYear()}-${String(transaction.date.getUTCMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(
      monthKey,
      (monthlyMap.get(monthKey) ?? 0) + transaction.filteredAmount,
    );

    const categoryName = transaction.category?.name ?? "Uncategorized";
    categoryMap.set(
      categoryName,
      (categoryMap.get(categoryName) ?? 0) + transaction.filteredAmount,
    );

    const accountName = transaction.account?.name ?? "Manual";
    accountMap.set(
      accountName,
      (accountMap.get(accountName) ?? 0) + transaction.filteredAmount,
    );

    for (const [personId, personAmount] of Object.entries(transaction.amounts)) {
      personTotals.set(personId, (personTotals.get(personId) ?? 0) + personAmount);
    }
  }

  const monthlySpending = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  const yoyMap = new Map<number, number>();
  for (const item of monthlySpending) {
    const year = Number(item.month.slice(0, 4));
    yoyMap.set(year, (yoyMap.get(year) ?? 0) + item.total);
  }

  const personNames = new Map(people.map((entry) => [entry.id, entry.name]));

  return {
    totalSpending: mapped.reduce((sum, tx) => sum + tx.filteredAmount, 0),
    monthlySpending,
    spendingByCategory: Array.from(categoryMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total),
    spendingByAccount: Array.from(accountMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total),
    spendingByPerson: Array.from(personTotals.entries())
      .map(([personId, total]) => ({
        name: personNames.get(personId) ?? "Unknown",
        total,
      }))
      .filter((entry) => entry.total !== 0),
    yearOverYear: Array.from(yoyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, total]) => ({ year: String(year), total })),
  };
}

export async function getIncomeDashboard(filters: DashboardFilters = {}) {
  const where: Prisma.IncomeWhereInput = {};

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = filters.startDate;
    if (filters.endDate) where.date.lte = filters.endDate;
  }

  if (filters.person && filters.person !== "COMBINED") {
    where.personId = filters.person;
  }

  const [income, spending] = await Promise.all([
    db.income.findMany({
      where,
      include: { person: true },
      orderBy: { date: "desc" },
    }),
    getSpendingDashboard(filters),
  ]);

  const monthlyMap = new Map<string, number>();
  const personMap = new Map<string, number>();

  for (const entry of income) {
    const amount = Number(entry.amount);
    const monthKey = `${entry.date.getUTCFullYear()}-${String(entry.date.getUTCMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + amount);
    personMap.set(entry.person.name, (personMap.get(entry.person.name) ?? 0) + amount);
  }

  const monthlyIncome = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  const annualMap = new Map<string, number>();
  for (const item of monthlyIncome) {
    const year = item.month.slice(0, 4);
    annualMap.set(year, (annualMap.get(year) ?? 0) + item.total);
  }

  const totalIncome = income.reduce((sum, entry) => sum + Number(entry.amount), 0);

  // Compare across every month that has either income or spending, so a month
  // with expenses and no income still shows up.
  const spendingByMonth = new Map(
    spending.monthlySpending.map((item) => [item.month, item.total]),
  );
  const allMonths = Array.from(
    new Set([...monthlyMap.keys(), ...spendingByMonth.keys()]),
  ).sort((a, b) => a.localeCompare(b));

  return {
    totalIncome,
    monthlyIncome,
    annualIncome: Array.from(annualMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, total]) => ({ year, total })),
    incomeByPerson: Array.from(personMap.entries()).map(([name, total]) => ({
      name,
      total,
    })),
    incomeVsExpenses: allMonths.map((month) => ({
      month,
      income: monthlyMap.get(month) ?? 0,
      expenses: spendingByMonth.get(month) ?? 0,
    })),
  };
}

export async function getNetWorthDashboard() {
  const snapshots = await db.netWorthSnapshot.findMany({
    include: { balances: true },
    orderBy: { month: "asc" },
  });

  const timeline = snapshots.map((snapshot) => {
    const assets = snapshot.balances
      .filter((balance) => balance.assetType)
      .reduce((sum, balance) => sum + Number(balance.amount), 0);
    const liabilities = snapshot.balances
      .filter((balance) => balance.liabilityType)
      .reduce((sum, balance) => sum + Number(balance.amount), 0);

    return {
      month: snapshot.month.toISOString().slice(0, 7),
      netWorth: assets - liabilities,
      assets,
      liabilities,
    };
  });

  const latest = snapshots.at(-1);
  const allocationMap = new Map<string, number>();

  if (latest) {
    for (const balance of latest.balances) {
      if (!balance.assetType) continue;
      allocationMap.set(
        balance.assetType,
        (allocationMap.get(balance.assetType) ?? 0) + Number(balance.amount),
      );
    }
  }

  return {
    timeline,
    allocation: Array.from(allocationMap.entries()).map(([name, total]) => ({
      name,
      total,
    })),
    latestNetWorth: timeline.at(-1)?.netWorth ?? 0,
  };
}

export async function getFiDashboard() {
  const [settings, excludedCategories, transactionRows, snapshots] =
    await Promise.all([
      db.appSettings.findUnique({ where: { id: "default" } }),
      db.category.findMany({ where: { excludedFromFi: true }, select: { id: true } }),
      db.transaction.findMany({
        select: { date: true, amount: true, categoryId: true },
      }),
      db.netWorthSnapshot.findMany({
        include: { balances: true },
        orderBy: { month: "asc" },
      }),
    ]);

  const excludedIds = new Set(excludedCategories.map((category) => category.id));
  const transactions: FiTransaction[] = transactionRows.map((transaction) => ({
    date: transaction.date,
    amount: Number(transaction.amount),
    categoryId: transaction.categoryId,
  }));

  const withdrawalRate = Number(settings?.withdrawalRate ?? 0.04);
  const annualSpending = trailingTwelveMonthSpending(
    transactions,
    excludedIds,
    new Date(),
  );

  const latestSnapshot = snapshots.at(-1);
  const currentInvestments = latestSnapshot
    ? sumInvestments(latestSnapshot.balances)
    : 0;

  const metrics = calculateFiMetrics(
    annualSpending,
    currentInvestments,
    withdrawalRate,
  );

  // Each historical point is measured against the spending that was actually
  // trailing that month, not against today's spending.
  const history = snapshots.map((snapshot) => {
    const investments = sumInvestments(snapshot.balances);
    const spending = trailingTwelveMonthSpending(
      transactions,
      excludedIds,
      snapshot.month,
    );
    const fiNumber = withdrawalRate > 0 ? spending / withdrawalRate : 0;

    return {
      month: snapshot.month.toISOString().slice(0, 7),
      investments,
      annualSpending: spending,
      fiNumber,
      progress: fiNumber > 0 ? investments / fiNumber : 0,
    };
  });

  return {
    ...metrics,
    history,
    excludedCategories: excludedCategories.length,
  };
}

export async function upsertTags(tagNames: string[]) {
  const tags = [];
  for (const name of tagNames) {
    const tag = await db.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    tags.push(tag);
  }
  return tags;
}
