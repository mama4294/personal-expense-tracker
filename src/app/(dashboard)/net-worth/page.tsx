"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Upload } from "lucide-react";
import { PersonToggle } from "@/components/filters/person-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/table";
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
import { AccountName } from "@/components/net-worth/account-logo";
import { PersonBadge } from "@/components/people/person-badge";
import { NetWorthImportDialog } from "@/components/import/financial-import-dialogs";
import {
  ASSET_LABELS,
  cn,
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
  account: { name: string; logo: string | null } | null;
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

function sumInvestedAssets(balances: Balance[], person: string) {
  return balances
    .filter((balance) =>
      (person === "COMBINED" || balance.personId === person) &&
      balance.assetType &&
      INVESTMENT_ASSETS.includes(balance.assetType as (typeof INVESTMENT_ASSETS)[number]),
    )
    .reduce((sum, balance) => sum + Number(balance.amount), 0);
}

type HistoryRow = {
  key: string;
  /** Null for legacy rows that predate configured accounts; those can't take new balances. */
  accountId: string | null;
  name: string;
  logo: string | null;
  kind: "asset" | "liability";
  type: string;
  person: { id: string; name: string } | null;
  amounts: Map<string, number>;
};

/**
 * The History grid is two tables side by side — pinned Account/Owner on the
 * left, scrolling months on the right — so the scrollbar spans only the
 * values. Fixed row heights keep the two halves aligned.
 */
const HISTORY_ROW_HEIGHT = {
  section: "h-8",
  account: "h-12",
  total: "h-11",
} as const;

const TYPE_ORDER = [...Object.keys(ASSET_LABELS), ...Object.keys(LIABILITY_LABELS)];

/** One row per account across all snapshots, keyed by month. Snapshots arrive newest first, so names and logos come from the latest month. */
function historyRows(snapshots: Snapshot[], accounts: ConfiguredNetWorthAccount[]): HistoryRow[] {
  const rows = new Map<string, HistoryRow>();
  // Configured accounts come first so new ones get a row before their first balance.
  for (const account of accounts) {
    const type = account.assetType ?? account.liabilityType ?? "";
    rows.set(account.id, {
      key: account.id,
      accountId: account.id,
      name: account.name,
      logo: account.logo ?? null,
      kind: account.assetType ? "asset" : "liability",
      type,
      person: account.person ?? null,
      amounts: new Map<string, number>(),
    });
  }
  for (const snapshot of snapshots) {
    const month = snapshot.month.slice(0, 7);
    for (const balance of snapshot.balances) {
      const key = balance.accountId ?? `${balance.accountName}|${balance.personId ?? ""}`;
      const type = balance.assetType ?? balance.liabilityType ?? "";
      const row = rows.get(key) ?? {
        key,
        accountId: balance.accountId,
        name: balance.account?.name || balance.accountName
          || (balance.assetType ? ASSET_LABELS[type] : LIABILITY_LABELS[type]),
        logo: balance.account?.logo ?? null,
        kind: balance.assetType ? "asset" : "liability",
        type,
        person: balance.person,
        amounts: new Map<string, number>(),
      };
      row.amounts.set(month, Number(balance.amount));
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name),
  );
}

export default function NetWorthPage() {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [netWorthAccounts, setNetWorthAccounts] = useState<ConfiguredNetWorthAccount[]>([]);
  const [person, setPerson] = useState("COMBINED");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  /** A month being entered inline in the History table, keyed by account id. */
  const [draft, setDraft] = useState<{ month: string; values: Record<string, string> } | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

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

  // A person sees only the accounts they hold, matching the rest of the app;
  // jointly held accounts appear under Combined.
  const history = historyRows(snapshots, netWorthAccounts).filter(
    (row) => person === "COMBINED" || row.person?.id === person,
  );
  const historyTotal = (kind: "asset" | "liability", month: string) =>
    history
      .filter((row) => row.kind === kind)
      .reduce((sum, row) => sum + (row.amounts.get(month) ?? 0), 0);
  const draftTotal = (kind: "asset" | "liability") =>
    history
      .filter((row) => row.kind === kind && row.accountId)
      .reduce((sum, row) => sum + (Number(draft?.values[row.accountId!]) || 0), 0);
  // The month being drafted replaces its own column rather than appearing twice.
  const historyMonths = snapshots.filter((snapshot) => snapshot.month.slice(0, 7) !== draft?.month);

  function existingValues(targetMonth: string) {
    const existing = snapshots.find((snapshot) => snapshot.month.slice(0, 7) === targetMonth);
    if (!existing) return null;
    return Object.fromEntries(
      existing.balances
        .filter((balance) => balance.accountId)
        .map((balance) => [balance.accountId!, String(Number(balance.amount))]),
    );
  }

  function startDraft() {
    const latest = snapshots[0]?.month.slice(0, 7);
    let next = currentMonth();
    if (latest) {
      const [year, monthIndex] = latest.split("-").map(Number);
      next = new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 7);
    }
    setDraftError(null);
    setDraft({ month: next, values: existingValues(next) ?? {} });
  }

  async function saveDraft() {
    if (!draft) return;
    const balances = Object.entries(draft.values)
      .filter(([, value]) => value.trim() !== "")
      .map(([accountId, value]) => ({ accountId, amount: Number(value) }));
    if (balances.length === 0) {
      setDraftError("Enter at least one balance.");
      return;
    }
    if (balances.some((balance) => !Number.isFinite(balance.amount))) {
      setDraftError("Balances must be numbers.");
      return;
    }
    setDraftSaving(true);
    setDraftError(null);
    const response = await fetch("/api/net-worth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: draft.month, balances }),
    });
    setDraftSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setDraftError(body.error ?? "Could not save the month.");
      return;
    }
    setMessage({ tone: "ok", text: `Saved ${formatMonthLabel(draft.month)} balances.` });
    setDraft(null);
    await load();
  }

  /** Enter moves down the column, like a spreadsheet. */
  function focusNextDraftInput(current: HTMLInputElement) {
    const inputs = [...document.querySelectorAll<HTMLInputElement>("input[data-draft-input]")];
    inputs[inputs.indexOf(current) + 1]?.focus();
  }

  // One list drives both halves of the History grid so their rows line up.
  type HistoryItem =
    | { id: string; type: "section"; label: string }
    | { id: string; type: "account"; row: HistoryRow }
    | { id: string; type: "total"; label: string; strong: boolean; firstTotal: boolean; value: (month: string) => number };
  const historyLayout: HistoryItem[] = [
    ...(["asset", "liability"] as const).flatMap((kind): HistoryItem[] => {
      const rows = history.filter((row) => row.kind === kind);
      if (rows.length === 0) return [];
      return [
        { id: `section-${kind}`, type: "section", label: kind === "asset" ? "Assets" : "Liabilities" },
        ...rows.map((row): HistoryItem => ({ id: row.key, type: "account", row })),
      ];
    }),
    { id: "total-assets", type: "total", label: "Total assets", strong: false, firstTotal: true, value: (month) => historyTotal("asset", month) },
    { id: "total-liabilities", type: "total", label: "Total liabilities", strong: false, firstTotal: false, value: (month) => -historyTotal("liability", month) },
    {
      id: "total-net-worth",
      type: "total",
      label: "Net worth",
      strong: true,
      firstTotal: false,
      value: (month) => historyTotal("asset", month) - historyTotal("liability", month),
    },
  ];
  const historyRowClass = (item: HistoryItem) =>
    cn(
      "border-b border-border last:border-0",
      HISTORY_ROW_HEIGHT[item.type],
      item.type === "section" && "bg-muted",
      item.type === "total" && item.firstTotal && "border-t-2",
      item.type === "account" && hoveredRow === item.id && "bg-muted/50",
    );

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
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>History</CardTitle>
            <p className="text-sm text-muted-foreground">
              Each account&apos;s balance, month by month. Select a month to edit its balances.
            </p>
          </div>
          {draft ? (
            <div className="flex flex-wrap items-center gap-2">
              {draftError ? <p className="text-sm text-destructive">{draftError}</p> : null}
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={draftSaving}>
                Cancel
              </Button>
              <Button onClick={saveDraft} disabled={draftSaving}>
                <Check className="h-4 w-4" />
                {draftSaving ? "Saving…" : `Save ${formatMonthLabel(draft.month)}`}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startDraft}>
              <Plus className="h-4 w-4" />
              Add month
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 && !draft ? (
            <p className="text-sm text-muted-foreground">No snapshots recorded yet. Use Add month to enter your first balances.</p>
          ) : (
            <div className="flex whitespace-nowrap text-sm" onMouseLeave={() => setHoveredRow(null)}>
              <table className="shrink-0 border-r border-border">
                <thead>
                  <tr className="h-10 border-b border-border">
                    <th className="max-w-44 px-3 text-left font-medium text-muted-foreground">Account</th>
                    <th className="px-3 text-left font-medium text-muted-foreground">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLayout.map((item) => (
                    <tr
                      key={item.id}
                      onMouseEnter={() => setHoveredRow(item.id)}
                      className={historyRowClass(item)}
                    >
                      {item.type === "section" ? (
                        <td colSpan={2} className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </td>
                      ) : item.type === "account" ? (
                        <>
                          <td className="max-w-44 px-3">
                            <AccountName name={item.row.name} logo={item.row.logo} className="max-w-full font-medium" />
                          </td>
                          <td className="px-3">
                            {item.row.person ? (
                              <PersonBadge
                                name={item.row.person.name}
                                color={people.find((owner) => owner.id === item.row.person?.id)?.color}
                              />
                            ) : (
                              <Badge variant="outline">Combined</Badge>
                            )}
                          </td>
                        </>
                      ) : (
                        <td
                          colSpan={2}
                          className={cn("px-3", item.strong ? "font-semibold" : "font-medium text-muted-foreground")}
                        >
                          {item.label}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="min-w-0 flex-1 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="h-10 border-b border-border">
                      {draft ? (
                        <th className="bg-primary/5 px-2 text-right">
                          <Input
                            type="month"
                            aria-label="Month to enter"
                            value={draft.month}
                            onChange={(event) => {
                              const next = event.target.value;
                              if (!next) return;
                              setDraft((current) => current && {
                                month: next,
                                values: existingValues(next) ?? current.values,
                              });
                            }}
                            className="ml-auto h-8 w-40 px-2 text-sm font-medium"
                          />
                        </th>
                      ) : null}
                      {historyMonths.map((snapshot) => {
                        const key = snapshot.month.slice(0, 7);
                        return (
                          <th key={snapshot.id} className="px-3 text-right font-medium">
                            <button
                              type="button"
                              title={`Edit ${formatMonthLabel(key)} balances`}
                              className="rounded-md px-1 underline-offset-2 hover:underline"
                              onClick={() => openFor(key)}
                            >
                              {formatMonthLabel(key)}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {historyLayout.map((item) => (
                      <tr
                        key={item.id}
                        onMouseEnter={() => setHoveredRow(item.id)}
                        className={historyRowClass(item)}
                      >
                        {draft ? (
                          <td className="bg-primary/5 px-2 text-right tabular-nums">
                            {item.type === "account" ? (
                              item.row.accountId ? (
                                <Input
                                  data-draft-input
                                  type="number"
                                  step="0.01"
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  aria-label={`${item.row.name} balance for ${formatMonthLabel(draft.month)}`}
                                  value={draft.values[item.row.accountId] ?? ""}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    const accountId = item.row.accountId!;
                                    setDraft((current) => current && {
                                      ...current,
                                      values: { ...current.values, [accountId]: value },
                                    });
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      focusNextDraftInput(event.currentTarget);
                                    }
                                  }}
                                  className="ml-auto h-8 w-32 px-2 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )
                            ) : item.type === "total" ? (
                              (() => {
                                const value = item.id === "total-assets"
                                  ? draftTotal("asset")
                                  : item.id === "total-liabilities"
                                    ? -draftTotal("liability")
                                    : draftTotal("asset") - draftTotal("liability");
                                return (
                                  <span className={cn("px-1", item.strong ? "font-semibold" : "text-muted-foreground")}>
                                    {`${value < 0 ? "−" : ""}${formatCurrency(Math.abs(value))}`}
                                  </span>
                                );
                              })()
                            ) : null}
                          </td>
                        ) : null}
                        {item.type === "section" ? (
                          <td colSpan={historyMonths.length} />
                        ) : (
                          historyMonths.map((snapshot) => {
                            const month = snapshot.month.slice(0, 7);
                            const amount = item.type === "account"
                              ? item.row.amounts.get(month)
                              : item.value(month);
                            const liability = item.type === "account" && item.row.kind === "liability";
                            return (
                              <td
                                key={snapshot.id}
                                className={cn(
                                  "px-3 text-right tabular-nums",
                                  amount === undefined && "text-muted-foreground",
                                  liability && "text-destructive",
                                  item.type === "total" && (item.strong ? "font-semibold" : "text-muted-foreground"),
                                )}
                              >
                                {amount === undefined
                                  ? "—"
                                  : `${liability || amount < 0 ? "−" : ""}${formatCurrency(Math.abs(amount))}`}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
