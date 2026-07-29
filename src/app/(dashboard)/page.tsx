"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DashboardFilters,
  emptyFilters,
  FilterState,
  filtersToQuery,
} from "@/components/filters/dashboard-filters";
import {
  SERIES_COLORS,
  SimpleBarChart,
  SimpleLineChart,
  SimplePieChart,
  StatCard,
} from "@/components/charts/dashboard-charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatCurrencyPrecise, formatPercent } from "@/lib/utils";

type SpendingData = {
  totalSpending: number;
  monthlySpending: { month: string; total: number }[];
  spendingByCategory: { name: string; total: number }[];
  spendingByAccount: { name: string; total: number }[];
  spendingByPerson: { name: string; total: number }[];
  yearOverYear: { year: string; total: number }[];
};

export default function SpendingDashboardPage() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [data, setData] = useState<SpendingData | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((response) => response.json()),
      fetch("/api/accounts").then((response) => response.json()),
      fetch("/api/people").then((response) => response.json()),
    ]).then(([categoryData, accountData, peopleData]) => {
      setCategories(categoryData);
      setAccounts(accountData);
      setPeople(peopleData);
    });
  }, []);

  useEffect(() => {
    fetch(`/api/dashboard/spending?${filtersToQuery(filters)}`)
      .then((response) => response.json())
      .then(setData);
  }, [filters]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Spending Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Monthly spending, category breakdowns, and person-level views.
        </p>
      </div>

      <DashboardFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        accounts={accounts}
        people={people}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Spending"
          value={formatCurrency(data?.totalSpending ?? 0)}
        />
        <StatCard
          label="Categories"
          value={String(data?.spendingByCategory.length ?? 0)}
        />
        <StatCard
          label="Accounts"
          value={String(data?.spendingByAccount.length ?? 0)}
        />
        <StatCard
          label="Months Tracked"
          value={String(data?.monthlySpending.length ?? 0)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={data?.monthlySpending ?? []} xKey="month" yKey="total" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart data={data?.spendingByCategory.slice(0, 8) ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Account</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={data?.spendingByAccount ?? []} xKey="name" yKey="total" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Person</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={data?.spendingByPerson ?? []} xKey="name" yKey="total" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Year-over-Year Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleLineChart
            data={data?.yearOverYear ?? []}
            xKey="year"
            lines={[{ key: "total", color: SERIES_COLORS[0], name: "Total" }]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
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
                <TableRow key={category.name}>
                  <TableCell>{category.name}</TableCell>
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
                    No spending matches these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
