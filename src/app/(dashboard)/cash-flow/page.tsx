"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { StatCard } from "@/components/charts/dashboard-charts";
import { CashFlowSankey } from "@/components/charts/sankey-chart";
import { PersonToggle } from "@/components/filters/person-toggle";
import { savingsRate } from "@/lib/income";
import { aggregateMonths } from "@/lib/cash-flow-range";
import { personColor } from "@/lib/colors";
import {
  cn,
  formatCurrency,
  formatCurrencyPrecise,
  formatMonthLabel,
  formatPercent,
} from "@/lib/utils";

type Person = { id: string; name: string; isActive: boolean; color: string };

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
  incomeByCompany: { name: string; total: number; personId: string }[];
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
  // Month keys rather than slider indices: the row set changes when the person
  // filter changes, and indices would silently point at a different month.
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activePeople = people.filter((entry) => entry.isActive);
  const activeColor = personColor(
    activePeople.find((entry) => entry.id === person)?.color,
  );

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

    // Keep the chosen span if both ends survive; otherwise fall back to the
    // newest single month.
    setRange((current) => {
      const has = (month: string) =>
        cashFlow.rows.some((row) => row.month === month);
      if (current && has(current.start) && has(current.end)) return current;
      const newest = cashFlow.rows[0]?.month;
      return newest ? { start: newest, end: newest } : null;
    });
  }, [person]);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  // The table reads newest-first; the slider has to read left-to-right in time.
  const chronological = useMemo(() => [...rows].reverse(), [rows]);

  const startIndex = chronological.findIndex((row) => row.month === range?.start);
  const endIndex = chronological.findIndex((row) => row.month === range?.end);
  const inRange =
    startIndex < 0 || endIndex < 0
      ? []
      : chronological.slice(startIndex, endIndex + 1);

  const selected = inRange.length > 0 ? aggregateMonths(inRange) : null;
  const selectedRate = selected
    ? savingsRate(selected.savings, selected.netIncome)
    : null;

  const monthsInRange = new Set(inRange.map((row) => row.month));

  /** Moves the span without changing its length where the data allows. */
  function setSpan(length: number) {
    if (chronological.length === 0) return;
    const end = Math.max(endIndex, 0);
    const size = Math.min(length, chronological.length);
    const start = Math.max(0, end - size + 1);
    setRange({
      start: chronological[start].month,
      end: chronological[end].month,
    });
  }

  // On Combined each employer keeps its earner's colour, which is the only way
  // to tell whose pay is whose once several jobs feed the same pool.
  const employers = (selected?.incomeByCompany ?? []).map((entry) => ({
    ...entry,
    color: personColor(
      people.find((who) => who.id === entry.personId)?.color,
    ),
  }));

  const rangeLabel = selected
    ? inRange.length === 1
      ? formatMonthLabel(inRange[0].month)
      : `${formatMonthLabel(inRange[0].month)} – ${formatMonthLabel(inRange[inRange.length - 1].month)}`
    : "";

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
                  onClick={() => setRange({ start: row.month, end: row.month })}
                  className={cn(
                    "cursor-pointer",
                    monthsInRange.has(row.month) && "bg-primary/5",
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
                  {rangeLabel} ·{" "}
                  {formatCurrency(selected.grossIncome + selected.otherIncome)}{" "}
                  in, {formatCurrency(selected.expenses)} spent
                  {selectedRate != null
                    ? ` · ${formatPercent(selectedRate)} saved`
                    : ""}
                </p>
              ) : null}
            </div>
            {chronological.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {[1, 3, 6, 12].map((length) => (
                  <Button
                    key={length}
                    variant={inRange.length === length ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSpan(length)}
                    disabled={length > chronological.length}
                  >
                    {length}M
                  </Button>
                ))}
                <Button
                  variant={
                    inRange.length === chronological.length ? "secondary" : "ghost"
                  }
                  size="sm"
                  onClick={() =>
                    setRange({
                      start: chronological[0].month,
                      end: chronological[chronological.length - 1].month,
                    })
                  }
                >
                  All
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {chronological.length > 1 ? (
            <div className="space-y-2 px-1">
              <Slider
                min={0}
                max={chronological.length - 1}
                step={1}
                minStepsBetweenThumbs={0}
                thumbLabels={["Range start", "Range end"]}
                value={[Math.max(startIndex, 0), Math.max(endIndex, 0)]}
                onValueChange={([start, end]) =>
                  setRange({
                    start: chronological[Math.min(start, end)].month,
                    end: chronological[Math.max(start, end)].month,
                  })
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatMonthLabel(chronological[0].month)}</span>
                <span className="font-medium text-foreground">
                  {rangeLabel}
                  {inRange.length > 1 ? ` · ${inRange.length} months` : ""}
                </span>
                <span>
                  {formatMonthLabel(
                    chronological[chronological.length - 1].month,
                  )}
                </span>
              </div>
            </div>
          ) : null}

          {selected ? (
            <CashFlowSankey
              incomeColor={activeColor}
              data={{
                grossIncome: selected.grossIncome,
                incomeByCompany: employers,
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
              Pick a month in the table above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
