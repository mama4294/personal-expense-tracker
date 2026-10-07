"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_LABELS, formatCurrency, LIABILITY_LABELS } from "@/lib/utils";

export const COMBINED = "";

export type BalanceRow = {
  key: string;
  accountId: string;
  name: string;
  category: string;
  personName: string;
  amount: string;
};

export type ConfiguredNetWorthAccount = {
  id: string;
  name: string;
  assetType: string | null;
  liabilityType: string | null;
  personId: string | null;
  person?: { id: string; name: string } | null;
};

export function rowsForAccounts(
  accounts: ConfiguredNetWorthAccount[],
  balances: { accountId: string | null; amount: string | number }[] = [],
): BalanceRow[] {
  const amounts = new Map(
    balances
      .filter((balance) => balance.accountId)
      .map((balance) => [balance.accountId!, String(Number(balance.amount))]),
  );
  return accounts.map((account) => ({
    key: account.id,
    accountId: account.id,
    name: account.name,
    category: account.assetType
      ? ASSET_LABELS[account.assetType]
      : LIABILITY_LABELS[account.liabilityType ?? ""],
    personName: account.person?.name ?? "Combined",
    amount: amounts.get(account.id) ?? "",
  }));
}

/** Keys prior monthly values by the stable configured account id. */
export function balanceKey(accountId: string) {
  return accountId;
}

export function NetWorthDialog({
  open,
  onOpenChange,
  month,
  onMonthChange,
  rows,
  onRowsChange,
  notes,
  onNotesChange,
  isExisting,
  previousBalances,
  previousMonth,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  onMonthChange: (month: string) => void;
  rows: BalanceRow[];
  onRowsChange: (rows: BalanceRow[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  isExisting: boolean;
  previousBalances: Record<string, number>;
  previousMonth: string | null;
  onSaved: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRow(key: string, amount: string) {
    onRowsChange(rows.map((row) => row.key === key ? { ...row, amount } : row));
  }

  async function save() {
    const filled = rows.filter((row) => row.amount !== "");
    if (filled.length === 0) {
      setError("Enter an amount for at least one account.");
      return;
    }

    setSaving(true);
    setError(null);
    const response = await fetch("/api/net-worth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        notes: notes || undefined,
        balances: filled.map((row) => ({ accountId: row.accountId, amount: Number(row.amount) })),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save the snapshot.");
      setSaving(false);
      return;
    }

    setSaving(false);
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isExisting ? "Edit Balances" : "Add Balances"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Accounts come from Settings. Enter each account&apos;s current value; category totals are calculated automatically.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="snapshot-month">Month</Label>
            <Input id="snapshot-month" type="month" className="w-[190px]" value={month} onChange={(event) => onMonthChange(event.target.value)} />
          </div>

          {rows.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_150px] gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Account</span><span className="text-right">Current value</span>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {rows.map((row) => {
                  const previous = previousBalances[balanceKey(row.accountId)];
                  const current = row.amount === "" ? null : Number(row.amount);
                  const change = previous != null && previous !== 0 && current != null
                    ? (current - previous) / Math.abs(previous)
                    : null;
                  const unusual = change != null && Math.abs(change) > 0.25;
                  return (
                    <div key={row.key} className="grid grid-cols-[1fr_150px] items-center gap-3 rounded-lg border border-border p-3 sm:border-0 sm:p-1">
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.category} · {row.personName}</p>
                      </div>
                      <div className="space-y-1">
                        <Input type="number" step="0.01" placeholder="0.00" aria-label={`${row.name} current value`} value={row.amount} onChange={(event) => updateRow(row.key, event.target.value)} />
                        {previousMonth ? (
                          <p className={`text-right text-xs tabular-nums ${unusual ? "text-amber-600" : "text-muted-foreground"}`}>
                            {previous == null ? "No prior value" : <>Previous: {formatCurrency(previous)}{change != null ? ` · ${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}%` : null}</>}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Add accounts in Settings → Net Worth Accounts first.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="snapshot-notes">Notes</Label>
            <Textarea id="snapshot-notes" rows={2} value={notes} onChange={(event) => onNotesChange(event.target.value)} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || rows.length === 0}>
            {isExisting ? "Update Balances" : "Save Balances"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
