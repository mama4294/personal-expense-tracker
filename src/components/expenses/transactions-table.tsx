"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  describeSplitRows,
  evenSplit,
  SplitEditor,
  splitTotal,
  type Person,
  type SplitRow,
} from "@/components/people/split-editor";
import { accountLabel, cn, formatCurrencyPrecise } from "@/lib/utils";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  notes: string | null;
  amount: number;
  isManual: boolean;
  hasOverride: boolean;
  account: { id: string; name: string; nickname: string | null } | null;
  category: { id: string; name: string } | null;
  tags: string[];
  splits: SplitRow[];
  amounts: Record<string, number>;
  /** The share belonging to the filtered person, or the full amount if combined. */
  filteredAmount: number;
};

type Option = { id: string; name: string };

/** Columns worth ordering by; the rest are free text or derived. */
type SortKey = "date" | "amount" | "account";
type Sort = { key: SortKey; dir: "asc" | "desc" };

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 rounded hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}

type EditState = {
  id: string;
  description: string;
  notes: string;
  categoryId: string;
  tags: string;
  overrideSplit: boolean;
  splits: SplitRow[];
};

export function TransactionsTable({
  transactions,
  people,
  categories,
  onChanged,
  onError,
}: {
  transactions: Transaction[];
  people: Person[];
  categories: Option[];
  onChanged: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "desc" });

  const activePeople = people.filter((person) => person.isActive);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : // Money and dates are most useful biggest-first; names read A-Z.
          { key, dir: key === "account" ? "asc" : "desc" },
    );
  }

  const sorted = useMemo(() => {
    const direction = sort.dir === "asc" ? 1 : -1;
    // Newest-first within a group keeps re-sorts from shuffling equal rows.
    const byDate = (a: Transaction, b: Transaction) =>
      b.date.localeCompare(a.date);

    return [...transactions].sort((a, b) => {
      if (sort.key === "amount") {
        return (a.amount - b.amount) * direction || byDate(a, b);
      }
      if (sort.key === "account") {
        return (
          accountLabel(a.account).localeCompare(accountLabel(b.account)) *
            direction || byDate(a, b)
        );
      }
      return a.date.localeCompare(b.date) * direction;
    });
  }, [transactions, sort]);

  async function saveEdit() {
    if (!editing) return;

    if (editing.overrideSplit && splitTotal(editing.splits) !== 100) {
      onError("Shares must add up to 100%.");
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/transactions/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editing.description,
        notes: editing.notes,
        categoryId: editing.categoryId || null,
        tags: editing.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        splits: editing.overrideSplit
          ? editing.splits.filter((split) => split.percent > 0)
          : [],
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      onError(body.error ?? "Could not update the transaction.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(null);
    await onChanged();
  }

  async function remove(transaction: Transaction) {
    const confirmed = window.confirm(
      `Delete "${transaction.description}" for ${formatCurrencyPrecise(transaction.amount)}? This cannot be undone.`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/transactions/${transaction.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      onError("Could not delete the transaction.");
      return;
    }

    await onChanged();
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead
              label="Date"
              sortKey="date"
              sort={sort}
              onSort={toggleSort}
            />
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <SortableHead
              label="Account"
              sortKey="account"
              sort={sort}
              onSort={toggleSort}
            />
            <TableHead>Split</TableHead>
            {activePeople.map((person) => (
              <TableHead key={person.id} className="text-right">
                {person.name}
              </TableHead>
            ))}
            <SortableHead
              label="Amount"
              sortKey="amount"
              sort={sort}
              onSort={toggleSort}
              align="right"
            />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="whitespace-nowrap">
                {transaction.date.slice(0, 10)}
              </TableCell>
              <TableCell>
                <span>{transaction.description}</span>
                {transaction.tags.length > 0 ? (
                  <span className="ml-2 inline-flex flex-wrap gap-1">
                    {transaction.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                ) : null}
                {transaction.notes ? (
                  <p className="text-xs text-muted-foreground">{transaction.notes}</p>
                ) : null}
              </TableCell>
              <TableCell>{transaction.category?.name ?? "—"}</TableCell>
              <TableCell>{accountLabel(transaction.account)}</TableCell>
              <TableCell className="whitespace-nowrap">
                {describeSplitRows(transaction.splits, people)}
                {transaction.hasOverride ? (
                  <Badge variant="outline" className="ml-2">
                    override
                  </Badge>
                ) : null}
              </TableCell>
              {activePeople.map((person) => (
                <TableCell key={person.id} className="text-right tabular-nums">
                  {formatCurrencyPrecise(transaction.amounts[person.id] ?? 0)}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums">
                {formatCurrencyPrecise(transaction.amount)}
              </TableCell>
              <TableCell className="text-right">
                <span className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${transaction.description}`}
                    onClick={() =>
                      setEditing({
                        id: transaction.id,
                        description: transaction.description,
                        notes: transaction.notes ?? "",
                        categoryId: transaction.category?.id ?? "",
                        tags: transaction.tags.join(", "),
                        overrideSplit: transaction.hasOverride,
                        splits:
                          transaction.splits.length > 0
                            ? transaction.splits
                            : evenSplit(activePeople),
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${transaction.description}`}
                    onClick={() => remove(transaction)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8 + activePeople.length}
                className="text-muted-foreground"
              >
                No transactions match these filters.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Dialog
        open={editing != null}
        onOpenChange={(open) => (open ? null : setEditing(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editing.description}
                  onChange={(event) =>
                    setEditing({ ...editing, description: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editing.categoryId || "none"}
                  onValueChange={(value) =>
                    setEditing({
                      ...editing,
                      categoryId: value === "none" ? "" : value,
                    })
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
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  placeholder="Vacation, Medical"
                  value={editing.tags}
                  onChange={(event) =>
                    setEditing({ ...editing, tags: event.target.value })
                  }
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.overrideSplit}
                    onChange={(event) =>
                      setEditing({ ...editing, overrideSplit: event.target.checked })
                    }
                  />
                  Override the split
                </label>
                {editing.overrideSplit ? (
                  <SplitEditor
                    people={activePeople}
                    splits={editing.splits}
                    onChange={(splits) => setEditing({ ...editing, splits })}
                    compact
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Using the account&apos;s default split.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editing.notes}
                  onChange={(event) =>
                    setEditing({ ...editing, notes: event.target.value })
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
