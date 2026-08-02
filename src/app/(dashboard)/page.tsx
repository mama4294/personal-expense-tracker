"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, SlidersHorizontal, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SimpleBarChart,
  SimpleLineChart,
  SimplePieChart,
  StatCard,
} from "@/components/charts/dashboard-charts";
import { PersonToggle } from "@/components/filters/person-toggle";
import { DateRangePicker, type DateRange } from "@/components/filters/date-range";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { ImportDialog } from "@/components/expenses/import-dialog";
import {
  TransactionsTable,
  type Transaction,
} from "@/components/expenses/transactions-table";
import type { Person } from "@/components/people/split-editor";
import { personColor } from "@/lib/colors";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatMonthLabel,
  formatPercent,
} from "@/lib/utils";

type SpendingData = {
  totalSpending: number;
  monthlySpending: { month: string; total: number }[];
  spendingByCategory: { name: string; total: number }[];
  spendingByAccount: { name: string; total: number }[];
  spendingByPerson: { name: string; total: number }[];
  yearOverYear: { year: string; total: number }[];
};

type Option = { id: string; name: string };

type Filters = {
  person: string;
  startDate: string;
  endDate: string;
  categoryId: string;
  accountId: string;
  tag: string;
  minAmount: string;
  maxAmount: string;
  search: string;
};

const emptyFilters: Filters = {
  person: "COMBINED",
  startDate: "",
  endDate: "",
  categoryId: "",
  accountId: "",
  tag: "",
  minAmount: "",
  maxAmount: "",
  search: "",
};

function toQuery(filters: Partial<Filters>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export default function SpendingPage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [data, setData] = useState<SpendingData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePeople = useMemo(
    () => people.filter((person) => person.isActive),
    [people],
  );

  const selectedCategory = categories.find(
    (category) => category.id === filters.categoryId,
  );

  /** Charts follow whoever is selected; Combined keeps the default blue. */
  const activeColor = personColor(
    activePeople.find((entry) => entry.id === filters.person)?.color,
  );
  const colorByPerson = Object.fromEntries(
    activePeople.map((entry) => [entry.name, personColor(entry.color)]),
  );

  /**
   * The charts deliberately ignore the category filter. Drilling into a
   * category should filter the list below without collapsing the chart you
   * clicked to a single slice.
   */
  const scopeFilters = useMemo(
    () => ({ ...filters, categoryId: "" }),
    [filters],
  );

  const loadReference = useCallback(async () => {
    const [categoryData, accountData, peopleData] = await Promise.all([
      fetch("/api/categories").then((response) => response.json()),
      fetch("/api/accounts").then((response) => response.json()),
      fetch("/api/people").then((response) => response.json()),
    ]);
    setCategories(categoryData);
    setAccounts(accountData);
    setPeople(peopleData);
  }, []);

  const loadDashboard = useCallback(async () => {
    const [spendingResponse, transactionResponse] = await Promise.all([
      fetch(`/api/dashboard/spending?${toQuery(scopeFilters)}`),
      fetch(`/api/transactions?${toQuery(filters)}`),
    ]);

    if (!spendingResponse.ok || !transactionResponse.ok) {
      setError("Could not load spending data.");
      return;
    }

    setData(await spendingResponse.json());
    setTransactions(await transactionResponse.json());
  }, [filters, scopeFilters]);

  useEffect(() => {
    async function run() {
      await loadReference();
    }
    run();
  }, [loadReference]);

  useEffect(() => {
    async function run() {
      await loadDashboard();
    }
    run();
  }, [loadDashboard]);

  /** Clicking a category toggles the drill-down. */
  function selectCategory(name: string) {
    const category = categories.find((item) => item.name === name);
    if (!category) return;

    setFilters((current) => ({
      ...current,
      categoryId: current.categoryId === category.id ? "" : category.id,
    }));
  }

  function selectAccount(name: string) {
    const account = accounts.find((item) => item.name === name);
    if (!account) return;

    setFilters((current) => ({
      ...current,
      accountId: current.accountId === account.id ? "" : account.id,
    }));
  }

  // Sum the filtered share, so the header agrees with the charts when a single
  // person is selected rather than totalling everyone's amounts.
  const listedTotal = transactions.reduce(
    (sum, transaction) => sum + transaction.filteredAmount,
    0,
  );

  const categoryShare =
    selectedCategory && data
      ? (data.spendingByCategory.find((item) => item.name === selectedCategory.name)
          ?.total ?? 0)
      : 0;

  const chips: { label: string; clear: () => void }[] = [];
  if (selectedCategory) {
    chips.push({
      label: `Category: ${selectedCategory.name}`,
      clear: () => setFilters({ ...filters, categoryId: "" }),
    });
  }
  if (filters.accountId) {
    chips.push({
      label: `Account: ${accounts.find((a) => a.id === filters.accountId)?.name ?? ""}`,
      clear: () => setFilters({ ...filters, accountId: "" }),
    });
  }
  if (filters.tag) {
    chips.push({
      label: `Tag: ${filters.tag}`,
      clear: () => setFilters({ ...filters, tag: "" }),
    });
  }
  if (filters.search) {
    chips.push({
      label: `Search: ${filters.search}`,
      clear: () => setFilters({ ...filters, search: "" }),
    });
  }
  if (filters.minAmount || filters.maxAmount) {
    chips.push({
      label: `Amount: ${filters.minAmount || "0"}–${filters.maxAmount || "∞"}`,
      clear: () => setFilters({ ...filters, minAmount: "", maxAmount: "" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Spending</h2>
          <p className="text-sm text-muted-foreground">
            Import, review, and drill into every expense.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setExpenseOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <PersonToggle
              people={activePeople}
              value={filters.person}
              onChange={(person) => setFilters({ ...filters, person })}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreFilters((open) => !open)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showMoreFilters ? "Fewer filters" : "More filters"}
            </Button>
          </div>

          <DateRangePicker
            range={{ startDate: filters.startDate, endDate: filters.endDate }}
            onChange={(range: DateRange) => setFilters({ ...filters, ...range })}
          />

          {showMoreFilters ? (
            <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={filters.accountId || "all"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      accountId: value === "all" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="All accounts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tag</Label>
                <Input
                  placeholder="e.g. Vacation"
                  value={filters.tag}
                  onChange={(event) =>
                    setFilters({ ...filters, tag: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Min Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={filters.minAmount}
                  onChange={(event) =>
                    setFilters({ ...filters, minAmount: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="No limit"
                  value={filters.maxAmount}
                  onChange={(event) =>
                    setFilters({ ...filters, maxAmount: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Search</Label>
                <Input
                  placeholder="Description or notes"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters({ ...filters, search: event.target.value })
                  }
                />
              </div>
              <div className="flex items-end md:col-span-2">
                <Button variant="outline" onClick={() => setFilters(emptyFilters)}>
                  Reset all filters
                </Button>
              </div>
            </div>
          ) : null}

          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {chip.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Spending"
          value={formatCurrency(data?.totalSpending ?? 0)}
          hint={filters.person === "COMBINED" ? "Household" : "Selected person"}
        />
        <StatCard
          label="Months Tracked"
          value={String(data?.monthlySpending.length ?? 0)}
        />
        <StatCard
          label="Categories"
          value={String(data?.spendingByCategory.length ?? 0)}
        />
        <StatCard
          label="Accounts"
          value={String(data?.spendingByAccount.length ?? 0)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={data?.monthlySpending ?? []}
              xKey="month"
              yKey="total"
              name="Spending"
              color={activeColor}
              xTickFormatter={formatMonthLabel}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <p className="text-sm text-muted-foreground">
              Click a slice to filter the transactions below.
            </p>
          </CardHeader>
          <CardContent>
            <SimplePieChart
              data={data?.spendingByCategory ?? []}
              onSelect={selectCategory}
              selected={selectedCategory?.name ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Account</CardTitle>
            <p className="text-sm text-muted-foreground">
              Click a bar to filter the transactions below.
            </p>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={data?.spendingByAccount ?? []}
              xKey="name"
              yKey="total"
              name="Spending"
              color={activeColor}
              onSelect={selectAccount}
              selected={
                accounts.find((account) => account.id === filters.accountId)?.name ??
                null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Person</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={data?.spendingByPerson ?? []}
              xKey="name"
              yKey="total"
              name="Spending"
              colorByLabel={colorByPerson}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Year over Year</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              data={data?.yearOverYear ?? []}
              xKey="year"
              lines={[{ key: "total", color: activeColor, name: "Total" }]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[320px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.spendingByCategory ?? []).map((category) => (
                  <TableRow
                    key={category.name}
                    onClick={() => selectCategory(category.name)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      {category.name}
                      {selectedCategory?.name === category.name ? (
                        <Badge variant="default" className="ml-2">
                          filtered
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(category.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(
                        data && data.totalSpending > 0
                          ? category.total / data.totalSpending
                          : 0,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.spendingByCategory.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No spending in this range.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedCategory ? `${selectedCategory.name} — ` : ""}Transactions (
            {transactions.length}) · {formatCurrencyPrecise(listedTotal)}
          </CardTitle>
          {selectedCategory && data && data.totalSpending > 0 ? (
            <p className="text-sm text-muted-foreground">
              {formatPercent(categoryShare / data.totalSpending)} of{" "}
              {formatCurrency(data.totalSpending)} in this range.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <TransactionsTable
            transactions={transactions}
            people={people}
            categories={categories}
            onChanged={loadDashboard}
            onError={setError}
          />
        </CardContent>
      </Card>

      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        people={activePeople}
        categories={categories}
        accounts={accounts}
        onSaved={async () => {
          await loadReference();
          await loadDashboard();
        }}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={async () => {
          await loadReference();
          await loadDashboard();
        }}
      />
    </div>
  );
}
