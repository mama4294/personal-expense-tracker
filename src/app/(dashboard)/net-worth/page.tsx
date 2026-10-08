"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { PersonToggle } from "@/components/filters/person-toggle";
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
  GroupedBarChart,
  NEUTRAL_COLOR,
  SERIES_COLORS,
  SimpleLineChart,
  SimplePieChart,
  StatCard,
} from "@/components/charts/dashboard-charts";
import {
  balanceKey,
  NetWorthDialog,
  rowsForAccounts,
  type ConfiguredNetWorthAccount,
  type BalanceRow,
} from "@/components/net-worth/net-worth-dialog";
import { personColor } from "@/lib/colors";
import { PersonBadge } from "@/components/people/person-badge";
import { NetWorthImportDialog } from "@/components/import/financial-import-dialogs";
import {
  ASSET_LABELS,
  formatCurrency,
  formatMonthLabel,
  INVESTMENT_ASSETS,
  LIABILITY_LABELS,
} from "@/lib/utils";

type Person = { id: string; name: string; isActive: boolean; color: string };

type Balance = {
  id: string;
  assetType: string | null;
  liabilityType: string | null;
  amount: string;
  accountName: string;
  accountId: string | null;
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
  /// One row per asset category, with a numeric column per selected holder.
  categoriesByPerson: Record<string, string | number>[];
  accountHolders: string[];
  latestNetWorth: number;
  jointNetWorth: number;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function sumBalances(balances: Balance[], kind: "asset" | "liability") {
  return balances
    .filter((balance) => (kind === "asset" ? balance.assetType : balance.liabilityType))
    .reduce((sum, balance) => sum + Number(balance.amount), 0);
}

function sumInvestedAssets(balances: Balance[], person: string) {
  return balances
    .filter((balance) =>
      (person === "COMBINED" || balance.personId === person) &&
      balance.assetType &&
      INVESTMENT_ASSETS.includes(balance.assetType as (typeof INVESTMENT_ASSETS)[number]),
    )
    .reduce((sum, balance) => sum + Number(balance.amount), 0);
}

export default function NetWorthPage() {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [netWorthAccounts, setNetWorthAccounts] = useState<ConfiguredNetWorthAccount[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [person, setPerson] = useState("COMBINED");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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

  const activePeople = people.filter((entry) => entry.isActive);
  const activeColor = personColor(
    activePeople.find((entry) => entry.id === person)?.color,
  );

  const load = useCallback(async () => {
    const [dashboardResponse, snapshotResponse, peopleResponse, accountsResponse] = await Promise.all([
      fetch(`/api/dashboard/net-worth?person=${person}`),
      fetch("/api/net-worth"),
      fetch("/api/people"),
      fetch("/api/net-worth/accounts"),
    ]);

    if (!dashboardResponse.ok || !snapshotResponse.ok || !peopleResponse.ok || !accountsResponse.ok) {
      setMessage({ tone: "error", text: "Could not load net worth data." });
      return;
    }

    setData(await dashboardResponse.json());
    setSnapshots(await snapshotResponse.json());
    setPeople(await peopleResponse.json());
    setNetWorthAccounts(await accountsResponse.json());
  }, [person]);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  const isExisting = snapshots.some(
    (snapshot) => snapshot.month.slice(0, 7) === month,
  );

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
    setPreviousBalances(previous
      ? Object.fromEntries(previous.balances.filter((balance) => balance.accountId).map((balance) => [balanceKey(balance.accountId!), Number(balance.amount)]))
      : {});

    setMonth(targetMonth);

    if (existing) {
      setRows(rowsForAccounts(netWorthAccounts, existing.balances));
      setNotes(existing.notes ?? "");
    } else {
      setRows(rowsForAccounts(netWorthAccounts));
      setNotes("");
    }

    setDialogOpen(true);
  }

  const allocation = (data?.allocation ?? []).map((item) => ({
    name: ASSET_LABELS[item.name] ?? item.name,
    total: item.total,
  }));

  const categoryRows = (data?.categoriesByPerson ?? []).map((row) => ({
    ...row,
    name: ASSET_LABELS[String(row.name)] ?? String(row.name),
  }));

  // Jointly held accounts belong to no one, so they get the neutral slot
  // rather than borrowing a person's colour.
  const holderSeries = (data?.accountHolders ?? []).map((holder) => ({
    key: holder,
    name: holder,
    color:
      holder === "Combined"
        ? NEUTRAL_COLOR
        : personColor(people.find((entry) => entry.name === holder)?.color),
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
        <div className="flex flex-wrap items-center gap-3">
          <PersonToggle
            people={activePeople}
            value={person}
            onChange={setPerson}
          />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => openFor(currentMonth())}>
            <Plus className="h-4 w-4" />
            Add Balances
          </Button>
        </div>
      </div>

      {person !== "COMBINED" && (data?.jointNetWorth ?? 0) !== 0 ? (
        <p className="text-sm text-muted-foreground">
          Showing only accounts held by{" "}
          {activePeople.find((entry) => entry.id === person)?.name}. A further{" "}
          {formatCurrency(data?.jointNetWorth ?? 0)} is held jointly and appears
          under Combined.
        </p>
      ) : null}

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
          label="Invested Assets"
          value={formatCurrency(sumInvestedAssets(snapshots[0]?.balances ?? [], person))}
          hint="Brokerage, RSUs, 401k, Roth IRA, and HSA balances."
        />
        <StatCard
          label="Total Assets"
          value={formatCurrency(data?.timeline.at(-1)?.assets ?? 0)}
          hint="All asset balances, including cash, investments, property, and crypto."
        />
        <StatCard
          label="Total Net Worth"
          value={formatCurrency(data?.latestNetWorth ?? 0)}
          hint="Total assets minus mortgage, car loan, and credit card balances."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net Worth Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              fractionDigits={0}
              data={data?.timeline ?? []}
              xKey="month"
              lines={[
                { key: "netWorth", color: activeColor, name: "Net Worth" },
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
            <SimplePieChart
              fractionDigits={0} data={allocation} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Categories by Person</CardTitle>
            <p className="text-sm text-muted-foreground">Latest balances.</p>
          </CardHeader>
          <CardContent>
            {categoryRows.length > 0 ? (
              <GroupedBarChart
                fractionDigits={0}
                data={categoryRows}
                xKey="name"
                series={holderSeries}
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No balances recorded yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              fractionDigits={0}
              data={data?.timeline ?? []}
              xKey="month"
              lines={[{ key: "assets", color: activeColor, name: "Assets" }]}
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
              fractionDigits={0}
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
            Every account, whoever holds it. Select a month to see the detail.
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
                  <Fragment key={snapshot.id}>
                    <TableRow>
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
                        {formatCurrency(assets)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(liabilities)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(assets - liabilities)}
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
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/40">
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {snapshot.balances.map((balance) => (
                              <div
                                key={balance.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                              >
                                <span>
                                  {balance.accountName || (balance.assetType
                                    ? ASSET_LABELS[balance.assetType]
                                    : LIABILITY_LABELS[balance.liabilityType ?? ""])}
                                  {balance.person ? (
                                    <PersonBadge
                                      name={balance.person.name}
                                      color={people.find((owner) => owner.id === balance.person?.id)?.color}
                                      className="ml-2"
                                    />
                                  ) : (
                                    <Badge variant="outline" className="ml-2">Combined</Badge>
                                  )}
                                </span>
                                <span
                                  className={
                                    balance.liabilityType
                                      ? "tabular-nums text-destructive"
                                      : "tabular-nums"
                                  }
                                >
                                  {balance.liabilityType ? "−" : ""}
                                  {formatCurrency(Number(balance.amount))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
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
        isExisting={isExisting}
        previousBalances={previousBalances}
        previousMonth={previousMonth}
        onSaved={load}
      />

      <NetWorthImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
      />
    </div>
  );
}
