"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/charts/dashboard-charts";
import { CashFlowSankey } from "@/components/charts/sankey-chart";
import { PersonToggle } from "@/components/filters/person-toggle";
import { savingsRate } from "@/lib/income";
import {
  cn,
  formatCurrency,
  formatCurrencyPrecise,
  formatMonthLabel,
  formatPercent,
} from "@/lib/utils";

type Person = { id: string; name: string; isActive: boolean };

type CashFlowRow = {
  month: string;
  grossIncome: number;
  otherIncome: number;
  netIncome: number;
  expenses: number;
  retirement401k: number;
  hsa: number;
  taxes: number;
  medical: number;
  dentalVision: number;
  savings: number;
  categories: { name: string; total: number }[];
  hasPaycheck: boolean;
};

type CashFlowData = {
  rows: CashFlowRow[];
  totals: { netIncome: number; expenses: number; savings: number };
};

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState("COMBINED");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const activePeople = people.filter((entry) => entry.isActive);

  const load = useCallback(async () => {
    const [cashFlowResponse, peopleResponse] = await Promise.all([
      fetch(`/api/dashboard/cash-flow?person=${person}`),
      fetch("/api/people"),
    ]);

    if (!cashFlowResponse.ok || !peopleResponse.ok) {
      setError("Could not load cash flow data.");
      return;
    }

    const cashFlow: CashFlowData = await cashFlowResponse.json();
    setData(cashFlow);
    setPeople(await peopleResponse.json());

    // Keep the chosen month if it still exists; otherwise show the newest.
    setSelectedMonth((current) =>
      current && cashFlow.rows.some((row) => row.month === current)
        ? current
        : (cashFlow.rows[0]?.month ?? ""),
    );
  }, [person]);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  const rows = data?.rows ?? [];
  const selected = rows.find((row) => row.month === selectedMonth) ?? null;
  const selectedRate = selected
    ? savingsRate(selected.savings, selected.netIncome)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Cash Flow</h2>
          <p className="text-sm text-muted-foreground">
            What came in, what went out, and what was saved
          </p>
        </div>
        <PersonToggle
          people={activePeople}
          value={person}
          onChange={setPerson}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Net Income (all months)"
          value={formatCurrency(data?.totals.netIncome ?? 0)}
        />
        <StatCard
          label="Expenses (all months)"
          value={formatCurrency(data?.totals.expenses ?? 0)}
        />
        <StatCard
          label="Saved (all months)"
          value={formatCurrency(data?.totals.savings ?? 0)}
          hint="Net income + 401k + HSA − expenses"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Cash Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Other</TableHead>
                <TableHead className="text-right">Net Income</TableHead>
                <TableHead className="text-right">401k</TableHead>
                <TableHead className="text-right">HSA</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Savings</TableHead>
                <TableHead className="text-right">Savings Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.month}
                  onClick={() => setSelectedMonth(row.month)}
                  className={cn(
                    "cursor-pointer",
                    row.month === selectedMonth && "bg-primary/5",
                  )}
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {formatMonthLabel(row.month)}
                    {row.hasPaycheck ? null : (
                      <Badge variant="outline" className="ml-2">
                        no paycheck
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(row.grossIncome)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.otherIncome > 0
                      ? formatCurrencyPrecise(row.otherIncome)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(row.netIncome)}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(row.retirement401k)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(row.hsa)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(row.expenses)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      row.savings < 0 && "text-destructive",
                    )}
                  >
                    {formatCurrencyPrecise(row.savings)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      row.savings < 0 && "text-destructive",
                    )}
                  >
                    {(() => {
                      const rate = savingsRate(row.savings, row.netIncome);
                      return rate == null ? "—" : formatPercent(rate);
                    })()}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    Nothing to show yet. Add paychecks on the Income page and
                    import some expenses.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle>Where the Money Went</CardTitle>
              {selected ? (
                <p className="text-sm text-muted-foreground">
                  {formatMonthLabel(selected.month)} ·{" "}
                  {formatCurrency(selected.grossIncome + selected.otherIncome)}{" "}
                  in, {formatCurrency(selected.expenses)} spent
                  {selectedRate != null
                    ? ` · ${formatPercent(selectedRate)} saved`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sankey-month" className="text-xs">
                Month
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="sankey-month" className="w-[160px]">
                  <SelectValue placeholder="Select a month" />
                </SelectTrigger>
                <SelectContent>
                  {rows.map((row) => (
                    <SelectItem key={row.month} value={row.month}>
                      {formatMonthLabel(row.month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selected ? (
            <CashFlowSankey
              data={{
                grossIncome: selected.grossIncome,
                otherIncome: selected.otherIncome,
                taxes: selected.taxes,
                retirement401k: selected.retirement401k,
                hsa: selected.hsa,
                medical: selected.medical,
                dentalVision: selected.dentalVision,
                expenses: selected.expenses,
                savings: selected.savings,
                categories: selected.categories,
              }}
            />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Select a month above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
