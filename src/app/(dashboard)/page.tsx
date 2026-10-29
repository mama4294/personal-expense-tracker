"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, Download, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SERIES_COLORS } from "@/components/charts/dashboard-charts";
import {
  NetWorthBreakdownChart,
  Sparkline,
  type BreakdownSeries,
} from "@/components/home/net-worth-breakdown-chart";
import { PersonToggle } from "@/components/filters/person-toggle";
import { AccountLogo } from "@/components/net-worth/account-logo";
import { PersonBadge } from "@/components/people/person-badge";
import { NET_WORTH_GROUPS, type NetWorthGroupKey } from "@/lib/net-worth-groups";
import { cn, formatCurrency, formatCurrencyPrecise, formatMonthLabel } from "@/lib/utils";

type Person = { id: string; name: string; isActive: boolean; color: string };

type HomeAccount = {
  key: string;
  name: string;
  logo: string | null;
  typeLabel: string;
  group: NetWorthGroupKey;
  person: { id: string; name: string } | null;
  balance: number;
  previous: number | null;
  history: { month: string; amount: number }[];
};

type HomeGroup = {
  key: NetWorthGroupKey;
  label: string;
  kind: "asset" | "liability";
  total: number;
  previous: number | null;
  accounts: HomeAccount[];
};

type HomeData = {
  latestMonth: string | null;
  previousMonth: string | null;
  timeline: ({ month: string; assets: number; liabilities: number; netWorth: number } & Record<NetWorthGroupKey, number>)[];
  groups: HomeGroup[];
};

/** Fixed slot per group, so a filter that hides a group never repaints the rest. */
const GROUP_COLORS: Record<NetWorthGroupKey, string> = {
  cash: SERIES_COLORS[0],
  investments: SERIES_COLORS[1],
  property: SERIES_COLORS[2],
  creditCards: SERIES_COLORS[3],
  loans: SERIES_COLORS[4],
};

const TOTALS_SERIES: BreakdownSeries[] = [
  { key: "assets", name: "Assets", color: SERIES_COLORS[0] },
  { key: "liabilities", name: "Liabilities", color: SERIES_COLORS[3], negative: true },
];

const UP_COLOR = "#1baf7a";
const DOWN_COLOR = "#e34948";

/**
 * Month-over-month change. For a liability, a rising balance is bad news, so
 * the colour follows whether the change helps net worth, not its sign.
 */
function Change({
  current,
  previous,
  liability = false,
  suffix,
  className,
}: {
  current: number;
  previous: number | null;
  liability?: boolean;
  suffix?: string;
  className?: string;
}) {
  if (previous === null) return null;
  const delta = current - previous;
  const percent = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const good = liability ? delta <= 0 : delta >= 0;
  const Icon = delta >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)}>
      <span
        className="inline-flex items-center gap-0.5 font-medium tabular-nums"
        style={{ color: delta === 0 ? undefined : good ? "#047857" : "#b91c1c" }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {formatCurrency(Math.abs(delta))}
        {percent !== null ? ` (${Math.abs(percent).toFixed(1)}%)` : ""}
      </span>
      {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

function downloadCsv(groups: HomeGroup[], month: string | null) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [
    ["Group", "Account", "Category", "Owner", "Balance"].join(","),
    ...groups.flatMap((group) =>
      group.accounts.map((account) =>
        [
          escape(group.label),
          escape(account.name),
          escape(account.typeLabel),
          escape(account.person?.name ?? "Combined"),
          (group.kind === "liability" ? -account.balance : account.balance).toFixed(2),
        ].join(","),
      ),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `net-worth-${month ?? "accounts"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState("COMBINED");
  const [view, setView] = useState<"breakdown" | "totals">("breakdown");
  const [range, setRange] = useState<"12" | "all">("12");
  const [summaryMode, setSummaryMode] = useState<"totals" | "percent">("totals");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [homeResponse, peopleResponse] = await Promise.all([
      fetch(`/api/dashboard/home?person=${person}`),
      fetch("/api/people"),
    ]);
    if (!homeResponse.ok || !peopleResponse.ok) {
      setError("Could not load your accounts.");
      return;
    }
    setError(null);
    setData(await homeResponse.json());
    setPeople(await peopleResponse.json());
  }, [person]);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  const activePeople = people.filter((entry) => entry.isActive);
  const colorFor = (personId: string) => people.find((entry) => entry.id === personId)?.color;

  const timeline = data?.timeline ?? [];
  const latest = timeline.at(-1);
  const previous = timeline.at(-2);
  const chartData = range === "12" ? timeline.slice(-12) : timeline;
  const groups = data?.groups ?? [];
  const assetGroups = groups.filter((group) => group.kind === "asset");
  const liabilityGroups = groups.filter((group) => group.kind === "liability");

  const breakdownSeries: BreakdownSeries[] = NET_WORTH_GROUPS
    .filter((group) => groups.some((entry) => entry.key === group.key))
    .map((group) => ({
      key: group.key,
      name: group.label,
      color: GROUP_COLORS[group.key],
      negative: group.kind === "liability",
    }));

  const toggleGroup = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const previousLabel = data?.previousMonth ? `since ${formatMonthLabel(data.previousMonth)}` : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            {data?.latestMonth
              ? `Balances as of ${formatMonthLabel(data.latestMonth)}.`
              : "Your net worth across every account."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PersonToggle people={activePeople} value={person} onChange={setPerson} />
          <Button variant="outline" asChild>
            <Link href="/net-worth">
              <RefreshCw className="h-4 w-4" />
              Update balances
            </Link>
          </Button>
          <Button asChild>
            <Link href="/settings">
              <Plus className="h-4 w-4" />
              Add account
            </Link>
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Net worth</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {formatCurrencyPrecise(latest?.netWorth ?? 0)}
                </p>
                {latest ? (
                  <Change current={latest.netWorth} previous={previous?.netWorth ?? null} suffix={previousLabel} />
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={view} onValueChange={(value) => setView(value as typeof view)}>
                <SelectTrigger className="w-44" aria-label="Chart view"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakdown">Breakdown</SelectItem>
                  <SelectItem value="totals">Assets vs. liabilities</SelectItem>
                </SelectContent>
              </Select>
              <Select value={range} onValueChange={(value) => setRange(value as typeof range)}>
                <SelectTrigger className="w-40" aria-label="Time range"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">Last 12 months</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {timeline.length > 0 ? (
            <NetWorthBreakdownChart
              data={chartData}
              series={view === "breakdown" ? breakdownSeries : TOTALS_SERIES}
            />
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {data ? (
                <>
                  No balances recorded yet.{" "}
                  <Link href="/net-worth" className="font-medium text-primary hover:underline">Add your first month</Link>.
                </>
              ) : "Loading…"}
            </div>
          )}
        </CardContent>
      </Card>

      {groups.length > 0 ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {groups.map((group) => {
              const open = !collapsed.has(group.key);
              const liability = group.kind === "liability";
              return (
                <Card key={group.key} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4 text-left hover:bg-muted"
                  >
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ChevronDown
                        className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")}
                        aria-hidden="true"
                      />
                      <span className="font-semibold">{group.label}</span>
                      <Change current={group.total} previous={group.previous} liability={liability} suffix={previousLabel} />
                    </span>
                    <span className="font-semibold tabular-nums">
                      {liability ? "−" : ""}{formatCurrencyPrecise(group.total)}
                    </span>
                  </button>
                  {open ? (
                    <ul className="divide-y divide-border border-t border-border">
                      {group.accounts.map((account) => {
                        const values = account.history.map((entry) => entry.amount);
                        const trendUp = values.length > 1 && values.at(-1)! >= values[0];
                        const trendGood = liability ? !trendUp : trendUp;
                        return (
                          <li key={account.key} className="flex items-center gap-4 px-5 py-3">
                            <AccountLogo name={account.name} logo={account.logo} className="h-9 w-9 rounded-full text-xs" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{account.name}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {account.typeLabel}
                                {account.person ? (
                                  <PersonBadge name={account.person.name} color={colorFor(account.person.id)} />
                                ) : (
                                  <Badge variant="outline">Combined</Badge>
                                )}
                              </div>
                            </div>
                            <div className="hidden sm:block">
                              <Sparkline values={values} color={trendGood ? UP_COLOR : DOWN_COLOR} />
                            </div>
                            <div className="text-right">
                              <p className="font-medium tabular-nums">
                                {liability ? "−" : ""}{formatCurrencyPrecise(account.balance)}
                              </p>
                              <Change
                                current={account.balance}
                                previous={account.previous}
                                liability={liability}
                                className="justify-end text-xs"
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </Card>
              );
            })}
          </div>

          <Card className="xl:sticky xl:top-24">
            <CardContent className="space-y-6 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Summary</h3>
                <div role="group" aria-label="Summary values" className="inline-flex gap-1 rounded-lg border border-border bg-muted p-1">
                  {(["totals", "percent"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={summaryMode === mode}
                      onClick={() => setSummaryMode(mode)}
                      className={cn(
                        "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                        summaryMode === mode ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              {[
                { title: "Assets", total: latest?.assets ?? 0, items: assetGroups },
                { title: "Liabilities", total: latest?.liabilities ?? 0, items: liabilityGroups },
              ].filter((section) => section.items.length > 0).map((section) => (
                <div key={section.title} className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <p className="font-semibold">{section.title}</p>
                    <p className="font-semibold tabular-nums text-muted-foreground">
                      {formatCurrencyPrecise(section.total)}
                    </p>
                  </div>
                  <div className="flex h-2.5 gap-0.5" aria-hidden="true">
                    {section.items.map((group) => (
                      <div
                        key={group.key}
                        className="rounded-full"
                        style={{
                          backgroundColor: GROUP_COLORS[group.key],
                          flexGrow: Math.max(group.total, 0),
                          flexBasis: 0,
                          minWidth: group.total > 0 ? 6 : 0,
                        }}
                      />
                    ))}
                  </div>
                  <ul className="space-y-2 text-sm">
                    {section.items.map((group) => (
                      <li key={group.key} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: GROUP_COLORS[group.key] }}
                          />
                          {group.label}
                        </span>
                        <span className="tabular-nums">
                          {summaryMode === "totals"
                            ? formatCurrency(group.total)
                            : `${section.total ? Math.round((group.total / section.total) * 100) : 0}%`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <Button
                variant="ghost"
                className="w-full text-primary"
                onClick={() => downloadCsv(groups, data?.latestMonth ?? null)}
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
