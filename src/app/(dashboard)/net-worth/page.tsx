"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
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
  ASSET_LABELS,
  formatCurrency,
  formatCurrencyPrecise,
  INVESTMENT_ASSETS,
  LIABILITY_LABELS,
} from "@/lib/utils";

type AssetType = keyof typeof ASSET_LABELS;
type LiabilityType = keyof typeof LIABILITY_LABELS;

type Balance = {
  assetType: AssetType | null;
  liabilityType: LiabilityType | null;
  amount: string;
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

const ASSET_ORDER: AssetType[] = [
  "BROKERAGE",
  "FOUR_O_ONE_K",
  "ROTH_IRA",
  "HSA",
  "CHECKING",
  "SAVINGS",
  "CRYPTO",
  "HOME_VALUE",
];

const LIABILITY_ORDER: LiabilityType[] = ["MORTGAGE", "CAR_LOAN"];

const emptyBalances: Record<string, string> = Object.fromEntries(
  [...ASSET_ORDER, ...LIABILITY_ORDER].map((key) => [key, ""]),
);

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function sumBalances(balances: Balance[], kind: "asset" | "liability") {
  return balances
    .filter((balance) => (kind === "asset" ? balance.assetType : balance.liabilityType))
    .reduce((sum, balance) => sum + Number(balance.amount), 0);
}

/** Form contents for a month: the saved snapshot if there is one, else blank. */
function snapshotToForm(month: string, snapshots: Snapshot[]) {
  const existing = snapshots.find(
    (snapshot) => snapshot.month.slice(0, 7) === month,
  );

  if (!existing) return { values: { ...emptyBalances }, notes: "" };

  const values = { ...emptyBalances };
  for (const balance of existing.balances) {
    const key = balance.assetType ?? balance.liabilityType;
    if (key) values[key] = String(Number(balance.amount));
  }

  return { values, notes: existing.notes ?? "" };
}

export default function NetWorthPage() {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [values, setValues] = useState<Record<string, string>>(emptyBalances);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<Snapshot[] | null> => {
    const [dashboardResponse, snapshotResponse] = await Promise.all([
      fetch("/api/dashboard/net-worth"),
      fetch("/api/net-worth"),
    ]);

    if (!dashboardResponse.ok || !snapshotResponse.ok) {
      setMessage({ tone: "error", text: "Could not load net worth data." });
      return null;
    }

    const snapshotData: Snapshot[] = await snapshotResponse.json();
    setData(await dashboardResponse.json());
    setSnapshots(snapshotData);
    return snapshotData;
  }, []);

  useEffect(() => {
    async function run() {
      const snapshotData = await load();
      if (snapshotData) applyMonth(currentMonth(), snapshotData);
    }
    run();
    // applyMonth only touches state setters, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  /** Selecting a month loads whatever is already stored for it. */
  function applyMonth(nextMonth: string, snapshotData: Snapshot[] = snapshots) {
    const form = snapshotToForm(nextMonth, snapshotData);
    setMonth(nextMonth);
    setValues(form.values);
    setNotes(form.notes);
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    const balances = [
      ...ASSET_ORDER.filter((key) => values[key] !== "").map((key) => ({
        assetType: key,
        amount: Number(values[key]),
      })),
      ...LIABILITY_ORDER.filter((key) => values[key] !== "").map((key) => ({
        liabilityType: key,
        amount: Number(values[key]),
      })),
    ];

    if (balances.length === 0) {
      setMessage({ tone: "error", text: "Enter at least one balance." });
      setSaving(false);
      return;
    }

    const response = await fetch("/api/net-worth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, notes: notes || undefined, balances }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage({ tone: "error", text: body.error ?? "Could not save the snapshot." });
      setSaving(false);
      return;
    }

    setMessage({ tone: "ok", text: `Saved balances for ${month}.` });
    const snapshotData = await load();
    if (snapshotData) applyMonth(month, snapshotData);
    setSaving(false);
  }

  const allocation = (data?.allocation ?? []).map((item) => ({
    name: ASSET_LABELS[item.name] ?? item.name,
    total: item.total,
  }));

  const editingExisting = snapshots.some(
    (snapshot) => snapshot.month.slice(0, 7) === month,
  );

  const draftTotals = useMemo(() => {
    const assets = ASSET_ORDER.reduce(
      (sum, key) => sum + (Number(values[key]) || 0),
      0,
    );
    const liabilities = LIABILITY_ORDER.reduce(
      (sum, key) => sum + (Number(values[key]) || 0),
      0,
    );
    const investments = INVESTMENT_ASSETS.reduce(
      (sum, key) => sum + (Number(values[key]) || 0),
      0,
    );
    return { assets, liabilities, investments, netWorth: assets - liabilities };
  }, [values]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Net Worth Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Enter balances once a month, then track assets, liabilities, and net worth
          over time.
        </p>
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
          label="Investments (draft month)"
          value={formatCurrency(draftTotals.investments)}
          hint="Brokerage, 401k, Roth IRA, HSA"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Balances</CardTitle>
          <p className="text-sm text-muted-foreground">
            {editingExisting
              ? `Editing the saved snapshot for ${month}. Saving replaces it.`
              : `New snapshot for ${month}.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Month</Label>
              <Input
                type="month"
                value={month}
                onChange={(event) => applyMonth(event.target.value)}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Assets
            </h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {ASSET_ORDER.map((key) => (
                <div key={key} className="space-y-2">
                  <Label>{ASSET_LABELS[key]}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={values[key] ?? ""}
                    onChange={(event) =>
                      setValues({ ...values, [key]: event.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Liabilities
            </h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {LIABILITY_ORDER.map((key) => (
                <div key={key} className="space-y-2">
                  <Label>{LIABILITY_LABELS[key]}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={values[key] ?? ""}
                    onChange={(event) =>
                      setValues({ ...values, [key]: event.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={save} disabled={saving}>
              {editingExisting ? "Update Snapshot" : "Save Snapshot"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Assets {formatCurrencyPrecise(draftTotals.assets)} − Liabilities{" "}
              {formatCurrencyPrecise(draftTotals.liabilities)} ={" "}
              <span className="font-medium text-foreground">
                {formatCurrencyPrecise(draftTotals.netWorth)}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

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
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Snapshot History ({snapshots.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Liabilities</TableHead>
                <TableHead className="text-right">Net Worth</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((snapshot) => {
                const assets = sumBalances(snapshot.balances, "asset");
                const liabilities = sumBalances(snapshot.balances, "liability");

                return (
                  <TableRow key={snapshot.id}>
                    <TableCell className="whitespace-nowrap">
                      {snapshot.month.slice(0, 7)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(assets)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(liabilities)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrencyPrecise(assets - liabilities)}
                    </TableCell>
                    <TableCell>{snapshot.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyMonth(snapshot.month.slice(0, 7))}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
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
    </div>
  );
}
