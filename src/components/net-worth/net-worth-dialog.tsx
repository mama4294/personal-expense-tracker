"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSET_LABELS,
  cn,
  formatCurrency,
  LIABILITY_LABELS,
} from "@/lib/utils";

export const ASSET_TYPES = [
  "CHECKING",
  "SAVINGS",
  "BROKERAGE",
  "RSU",
  "FOUR_O_ONE_K",
  "ROTH_IRA",
  "HSA",
  "CRYPTO",
  "HOME_VALUE",
] as const;

export const LIABILITY_TYPES = ["MORTGAGE", "CAR_LOAN", "CREDIT_CARD"] as const;

/** Accounts nearly every household re-enters each month. */
export const DEFAULT_ACCOUNTS = [
  "CHECKING",
  "SAVINGS",
  "BROKERAGE",
  "FOUR_O_ONE_K",
  "ROTH_IRA",
  "HSA",
] as const;

/** "" means the account is held jointly. */
export const COMBINED = "";

export type BalanceRow = {
  key: string;
  kind: "asset" | "liability";
  type: string;
  personId: string;
  amount: string;
};

let rowCounter = 0;
export function newRow(
  kind: "asset" | "liability" = "asset",
  type?: string,
): BalanceRow {
  rowCounter += 1;
  return {
    key: `row-${rowCounter}`,
    kind,
    type: type ?? (kind === "asset" ? ASSET_TYPES[0] : LIABILITY_TYPES[0]),
    personId: COMBINED,
    amount: "",
  };
}

/** The starting set for a month with no history to copy from. */
export function defaultRows(): BalanceRow[] {
  return DEFAULT_ACCOUNTS.map((type) => newRow("asset", type));
}

export function rowsFromSnapshot(
  balances: {
    assetType: string | null;
    liabilityType: string | null;
    amount: string | number;
    personId: string | null;
  }[],
): BalanceRow[] {
  return balances.map((balance) => {
    rowCounter += 1;
    const kind: "asset" | "liability" = balance.assetType
      ? "asset"
      : "liability";
    return {
      key: `row-${rowCounter}`,
      kind,
      type: (balance.assetType ?? balance.liabilityType) as string,
      personId: balance.personId ?? COMBINED,
      amount: String(Number(balance.amount)),
    };
  });
}

/**
 * Asset and liability accounts share one dropdown, so the option value has to
 * carry both halves of the answer. The two type lists don't overlap today, but
 * encoding the kind keeps that from becoming a correctness requirement.
 */
function accountValue(kind: BalanceRow["kind"], type: string) {
  return `${kind}:${type}`;
}

function parseAccountValue(value: string): {
  kind: BalanceRow["kind"];
  type: string;
} {
  const [kind, type] = value.split(":");
  return { kind: kind as BalanceRow["kind"], type };
}

/** Keys the previous-month lookup by the account *and* who holds it. */
export function balanceKey(type: string, personId: string | null) {
  return `${type}|${personId ?? COMBINED}`;
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
  people,
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
  people: { id: string; name: string }[];
  isExisting: boolean;
  /** Amounts from the most recent earlier snapshot, keyed by balanceKey(). */
  previousBalances: Record<string, number>;
  previousMonth: string | null;
  onSaved: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A month carried forward can run to a dozen rows, so an appended row lands
  // well below the scroll box and the click reads as a no-op. Scroll to it and
  // put the cursor on the field the user is going to change first.
  const scrollerRef = useRef<HTMLDivElement>(null);
  // A ref, not state: this is a one-shot side effect on the row that was just
  // appended, and it must not trigger another render of its own.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    const row = scrollerRef.current?.querySelector(`[data-row-key="${key}"]`);
    row?.scrollIntoView({ block: "nearest" });
    row?.querySelector<HTMLElement>('[aria-label="Account type"]')?.focus();
  }, [rows]);

  function addRow() {
    const row = newRow();
    pendingFocus.current = row.key;
    onRowsChange([...rows, row]);
  }

  function updateRow(key: string, changes: Partial<BalanceRow>) {
    onRowsChange(
      rows.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...changes };
        // Switching between asset and liability needs a valid type for the new
        // kind, since the two lists don't overlap. The account dropdown always
        // sends both together, so only fall back when the type was left out.
        if (
          changes.kind &&
          changes.kind !== row.kind &&
          changes.type === undefined
        ) {
          next.type =
            changes.kind === "asset" ? ASSET_TYPES[0] : LIABILITY_TYPES[0];
        }
        return next;
      }),
    );
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
        balances: filled.map((row) => ({
          ...(row.kind === "asset"
            ? { assetType: row.type }
            : { liabilityType: row.type }),
          amount: Number(row.amount),
          personId: row.personId === COMBINED ? null : row.personId,
        })),
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isExisting ? "Edit Balances" : "Add Balances"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="snapshot-month">Month</Label>
            <Input
              id="snapshot-month"
              type="month"
              className="w-[190px]"
              value={month}
              onChange={(event) => onMonthChange(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1.2fr_1fr_150px_40px]">
              <span>Account</span>
              <span>Person</span>
              <span>Amount</span>
              <span className="sr-only">Remove</span>
            </div>

            <div
              ref={scrollerRef}
              className="max-h-[340px] space-y-2 overflow-y-auto pr-1"
            >
              {rows.map((row) => {
                const previous =
                  previousBalances[balanceKey(row.type, row.personId)];
                const current = row.amount === "" ? null : Number(row.amount);
                const change =
                  previous != null && previous !== 0 && current != null
                    ? (current - previous) / Math.abs(previous)
                    : null;
                // A big jump usually means a typo or the wrong person.
                const unusual = change != null && Math.abs(change) > 0.25;

                return (
                  <div
                    key={row.key}
                    data-row-key={row.key}
                    className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1.2fr_1fr_150px_40px] sm:items-start sm:border-0 sm:p-1"
                  >
                    <Select
                      value={accountValue(row.kind, row.type)}
                      onValueChange={(value) =>
                        updateRow(row.key, parseAccountValue(value))
                      }
                    >
                      <SelectTrigger aria-label="Account type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Assets</SelectLabel>
                          {ASSET_TYPES.map((type) => (
                            <SelectItem
                              key={type}
                              value={accountValue("asset", type)}
                            >
                              {ASSET_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Liabilities</SelectLabel>
                          {LIABILITY_TYPES.map((type) => (
                            <SelectItem
                              key={type}
                              value={accountValue("liability", type)}
                            >
                              {LIABILITY_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <Select
                      value={row.personId || "combined"}
                      onValueChange={(value) =>
                        updateRow(row.key, {
                          personId: value === "combined" ? COMBINED : value,
                        })
                      }
                    >
                      <SelectTrigger aria-label="Person">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="combined">Combined</SelectItem>
                        {people.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="space-y-1">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        aria-label="Amount"
                        value={row.amount}
                        onChange={(event) =>
                          updateRow(row.key, { amount: event.target.value })
                        }
                      />
                      {previousMonth ? (
                        <p
                          className={cn(
                            "text-xs tabular-nums",
                            unusual
                              ? "text-amber-600"
                              : "text-muted-foreground",
                          )}
                        >
                          {previous == null ? (
                            "No prior value"
                          ) : (
                            <>
                              {"Previous"}: {formatCurrency(previous)}
                              {change != null
                                ? ` · ${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}%`
                                : null}
                            </>
                          )}
                        </p>
                      ) : null}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove account"
                      onClick={() =>
                        onRowsChange(
                          rows.filter((item) => item.key !== row.key),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
            >
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="snapshot-notes">Notes</Label>
            <Textarea
              id="snapshot-notes"
              rows={2}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {isExisting ? "Update Balances" : "Save Balances"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
