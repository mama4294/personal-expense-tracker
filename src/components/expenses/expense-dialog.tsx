"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  evenSplit,
  SplitEditor,
  splitTotal,
  type Person,
  type SplitRow,
} from "@/components/people/split-editor";
import { toDateInputValue } from "@/lib/utils";

type Option = { id: string; name: string };

function blankForm() {
  return {
    date: toDateInputValue(new Date()),
    amount: "",
    description: "",
    notes: "",
    categoryId: "",
    accountId: "",
    tags: "",
    overrideSplit: false,
  };
}

export function ExpenseDialog({
  open,
  onOpenChange,
  people,
  categories,
  accounts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: Person[];
  categories: Option[];
  accounts: Option[];
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState(blankForm);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Untouched splits fall back to an even one. Derived rather than stored so it
  // is still right when the people list arrives after this mounts.
  const effectiveSplits = splits.length > 0 ? splits : evenSplit(people);

  /** Clearing on close means the next open always starts blank. */
  function handleOpenChange(next: boolean) {
    if (!next) {
      setForm(blankForm());
      setSplits([]);
      setError(null);
    }
    onOpenChange(next);
  }

  // Without an account there is no default split to inherit.
  const needsSplit = form.overrideSplit || !form.accountId;

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (needsSplit && splitTotal(effectiveSplits) !== 100) {
      setError("Shares must add up to 100%.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        amount: Number(form.amount),
        description: form.description,
        notes: form.notes || undefined,
        categoryId: form.categoryId || undefined,
        accountId: form.accountId || undefined,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        splits: needsSplit
          ? effectiveSplits.filter((split) => split.percent > 0)
          : [],
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save the expense.");
      setSaving(false);
      return;
    }

    setSaving(false);
    handleOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            For cash, Venmo, checks, reimbursements — anything that won&apos;t come
            in on a CSV.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Account</Label>
            <Select
              value={form.accountId || "none"}
              onValueChange={(value) =>
                setForm({ ...form, accountId: value === "none" ? "" : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.categoryId || "none"}
              onValueChange={(value) =>
                setForm({ ...form, categoryId: value === "none" ? "" : value })
              }
            >
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Tags</Label>
            <Input
              placeholder="Vacation, Medical"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
            />
          </div>

          <div className="space-y-3 sm:col-span-2">
            {form.accountId ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.overrideSplit}
                  onChange={(event) =>
                    setForm({ ...form, overrideSplit: event.target.checked })
                  }
                />
                Override the account&apos;s default split
              </label>
            ) : (
              <p className="text-sm font-medium">Split</p>
            )}

            {needsSplit ? (
              <SplitEditor
                people={people}
                splits={effectiveSplits}
                onChange={setSplits}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Using the account&apos;s default split.
              </p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          ) : null}

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || people.length === 0}>
              Add Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
