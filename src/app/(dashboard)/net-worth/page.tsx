"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  SERIES_COLORS,
  SimpleLineChart,
  SimplePieChart,
  StatCard,
} from "@/components/charts/dashboard-charts";
import {
  balanceKey,
  COMBINED,
  DEFAULT_ACCOUNTS,
  defaultRows,
  newRow,
  NetWorthDialog,
  rowsFromSnapshot,
  type BalanceRow,
} from "@/components/net-worth/net-worth-dialog";
import {
  ASSET_LABELS,
  formatCurrency,
  formatCurrencyPrecise,
  formatMonthLabel,
  LIABILITY_LABELS,
} from "@/lib/utils";

type Person = { id: string; name: string; isActive: boolean };

type Balance = {
  id: string;
  assetType: string | null;
  liabilityType: string | null;
  amount: string;
  personId: string | null;
  person: { id: string; name: string } | null;
};

type Snapshot = {
  id: string;
  month: string;
  notes: string | null;
  balances: Balance[];
};

type NetWorthData = {
  timeline: { month: string; netWorth: number; assets: number; liabilities: number }[];
  allocation: { name: string; total: number }[];
  latestNetWorth: number;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function sumBalances(balances: Balance[], kind: "asset" | "liability") {
  return balances
    .filter((balance) => (kind === "asset" ? balance.assetType : balance.liabilityType))
    .reduce((sum, balance) => sum + Number(balance.amount), 0);
}

export default function NetWorthPage() {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [notes, setNotes] = useState("");
  const [previousBalances, setPreviousBalances] = useState<Record<string, number>>(
    {},
  );
  const [previousMonth, setPreviousMonth] = useState<string | null>(null);

  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(
    null,
  );

  const activePeople = people.filter((person) => person.isActive);

  const load = useCallback(async () => {
    const [dashboardResponse, snapshotResponse, peopleResponse] = await Promise.all([
      fetch("/api/dashboard/net-worth"),
      fetch("/api/net-worth"),
      fetch("/api/people"),
    ]);

    if (!dashboardResponse.ok || !snapshotResponse.ok || !peopleResponse.ok) {
      setMessage({ tone: "error", text: "Could not load net worth data." });
      return;
    }

    setData(await dashboardResponse.json());
    setSnapshots(await snapshotResponse.json());
    setPeople(await peopleResponse.json());
  }, []);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  const isExisting = snapshots.some(
    (snapshot) => snapshot.month.slice(0, 7) === month,
  );

  /** Guarantees the everyday accounts are present, without duplicating them. */
  function withDefaultAccounts(existingRows: BalanceRow[]): BalanceRow[] {
    const present = new Set(
      existingRows
        .filter((row) => row.kind === "asset")
        .map((row) => row.type),
    );

    const missing = DEFAULT_ACCOUNTS.filter((type) => !present.has(type)).map(
      (type) => newRow("asset", type),
    );

    return [...existingRows, ...missing];
  }

  function openFor(targetMonth: string) {
    const existing = snapshots.find(
      (snapshot) => snapshot.month.slice(0, 7) === targetMonth,
    );

    // "Previous" is always the closest earlier month, even when editing an
    // existing snapshot — that's the value worth comparing against.
    const previous = snapshots
      .filter((snapshot) => snapshot.month.slice(0, 7) < targetMonth)
      .sort((a, b) => b.month.localeCompare(a.month))[0];

    setPreviousMonth(previous ? previous.month.slice(0, 7) : null);
    setPreviousBalances(
      previous
        ? Object.fromEntries(
            previous.balances.map((balance) => [
              balanceKey(
                (balance.assetType ?? balance.liabilityType) as string,
                balance.personId ?? COMBINED,
              ),
              Number(balance.amount),
            ]),
          )
        : {},
    );

    setMonth(targetMonth);

    if (existing) {
      setRows(withDefaultAccounts(rowsFromSnapshot(existing.balances)));
      setNotes(existing.notes ?? "");
    } else if (previous) {
      // Carry last month's accounts forward with blank amounts — the same
      // accounts, held by the same people, get re-entered every month.
      setRows(
        withDefaultAccounts(
          rowsFromSnapshot(previous.balances).map((row) => ({ ...row, amount: "" })),
        ),
      );
      setNotes("");
    } else {
      setRows(defaultRows());
      setNotes("");
    }

    setDialogOpen(true);
  }

  const allocation = (data?.allocation ?? []).map((item) => ({
    name: ASSET_LABELS[item.name] ?? item.name,
    total: item.total,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Net Worth</h2>
          <p className="text-sm text-muted-foreground">
            Enter balances once a month, then track assets, liabilities, and net
            worth over time.
          </p>
        </div>
        <Button onClick={() => openFor(currentMonth())}>
          <Plus className="h-4 w-4" />
          Add Balances
        </Button>
      </div>

      {message ? (
        <p
          className={
            message.tone === "error"
              ? "text-sm text-destructive"
              : "text-sm text-primary"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Latest Net Worth"
          value={formatCurrency(data?.latestNetWorth ?? 0)}
        />
        <StatCard
          label="Months Recorded"
          value={String(data?.timeline.length ?? 0)}
        />
        <StatCard
          label="Latest Assets"
          value={formatCurrency(data?.timeline.at(-1)?.assets ?? 0)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net Worth Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              data={data?.timeline ?? []}
              xKey="month"
              lines={[
                { key: "netWorth", color: SERIES_COLORS[0], name: "Net Worth" },
              ]}
              xTickFormatter={formatMonthLabel}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <SimplePieChart data={allocation} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              data={data?.timeline ?? []}
              xKey="month"
              lines={[{ key: "assets", color: SERIES_COLORS[0], name: "Assets" }]}
              xTickFormatter={formatMonthLabel}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liabilities Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              data={data?.timeline ?? []}
              xKey="month"
              lines={[
                { key: "liabilities", color: SERIES_COLORS[1], name: "Liabilities" },
              ]}
              xTickFormatter={formatMonthLabel}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Snapshot History ({snapshots.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a month to see the accounts behind it.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Accounts</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Liabilities</TableHead>
                <TableHead className="text-right">Net Worth</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((snapshot) => {
                const assets = sumBalances(snapshot.balances, "asset");
                const liabilities = sumBalances(snapshot.balances, "liability");
                const key = snapshot.month.slice(0, 7);
                const open = expanded === key;

                return (
                  <>
                    <TableRow key={snapshot.id}>
                      <TableCell className="whitespace-nowrap">
                        <button
                          type="button"
                          className="font-medium underline-offset-2 hover:underline"
                          onClick={() => setExpanded(open ? null : key)}
                        >
                          {formatMonthLabel(key)}
                        </button>
                      </TableCell>
                      <TableCell>{snapshot.balances.length}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyPrecise(assets)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrencyPrecise(liabilities)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrencyPrecise(assets - liabilities)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openFor(key)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open ? (
                      <TableRow key={`${snapshot.id}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/40">
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {snapshot.balances.map((balance) => (
                              <div
                                key={balance.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                              >
                                <span>
                                  {balance.assetType
                                    ? ASSET_LABELS[balance.assetType]
                                    : LIABILITY_LABELS[balance.liabilityType ?? ""]}
                                  <Badge
                                    variant={balance.person ? "default" : "outline"}
                                    className="ml-2"
                                  >
                                    {balance.person?.name ?? "Combined"}
                                  </Badge>
                                </span>
                                <span
                                  className={
                                    balance.liabilityType
                                      ? "tabular-nums text-destructive"
                                      : "tabular-nums"
                                  }
                                >
                                  {balance.liabilityType ? "−" : ""}
                                  {formatCurrencyPrecise(Number(balance.amount))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </>
                );
              })}
              {snapshots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No snapshots recorded yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NetWorthDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        month={month}
        onMonthChange={(next) => openFor(next)}
        rows={rows}
        onRowsChange={setRows}
        notes={notes}
        onNotesChange={setNotes}
        people={activePeople}
        isExisting={isExisting}
        previousBalances={previousBalances}
        previousMonth={previousMonth}
        onSaved={load}
      />
    </div>
  );
}
