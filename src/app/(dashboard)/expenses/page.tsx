"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DashboardFilters,
  emptyFilters,
  FilterState,
  filtersToQuery,
} from "@/components/filters/dashboard-filters";
import {
  describeSplitRows,
  evenSplit,
  SplitEditor,
  splitTotal,
  type Person,
  type SplitRow,
} from "@/components/people/split-editor";
import { formatCurrencyPrecise, toDateInputValue } from "@/lib/utils";

type Transaction = {
  id: string;
  date: string;
  description: string;
  notes: string | null;
  amount: number;
  isManual: boolean;
  hasOverride: boolean;
  account: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  tags: string[];
  splits: SplitRow[];
  amounts: Record<string, number>;
};

type Option = { id: string; name: string };

const blankForm = {
  date: toDateInputValue(new Date()),
  amount: "",
  description: "",
  notes: "",
  categoryId: "",
  accountId: "",
  tags: "",
  overrideSplit: false,
};

type EditState = {
  id: string;
  description: string;
  notes: string;
  categoryId: string;
  tags: string;
  overrideSplit: boolean;
  splits: SplitRow[];
};

export default function ExpensesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [form, setForm] = useState(blankForm);
  const [formSplits, setFormSplits] = useState<SplitRow[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const activePeople = people.filter((person) => person.isActive);

  const loadTransactions = useCallback(async () => {
    const response = await fetch(`/api/transactions?${filtersToQuery(filters)}`);
    if (!response.ok) {
      setMessage({ tone: "error", text: "Could not load transactions." });
      return;
    }
    setTransactions(await response.json());
  }, [filters]);

  useEffect(() => {
    async function run() {
      const [categoryData, accountData, peopleData] = await Promise.all([
        fetch("/api/categories").then((response) => response.json()),
        fetch("/api/accounts").then((response) => response.json()),
        fetch("/api/people").then((response) => response.json()),
      ]);
      setCategories(categoryData);
      setAccounts(accountData);
      setPeople(peopleData);
      setFormSplits(
        evenSplit(peopleData.filter((person: Person) => person.isActive)),
      );
    }
    run();
  }, []);

  useEffect(() => {
    async function run() {
      await loadTransactions();
    }
    run();
  }, [loadTransactions]);

  function parseTags(value: string) {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    // Without an account there is no default to inherit, so a split is required.
    const needsSplit = form.overrideSplit || !form.accountId;
    if (needsSplit && splitTotal(formSplits) !== 100) {
      setMessage({ tone: "error", text: "Shares must add up to 100%." });
      return;
    }

    setSaving(true);
    setMessage(null);

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
        tags: parseTags(form.tags),
        splits: needsSplit ? formSplits.filter((split) => split.percent > 0) : [],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage({ tone: "error", text: data.error ?? "Could not save expense." });
    } else {
      setForm({ ...blankForm, date: form.date });
      setFormSplits(evenSplit(activePeople));
      setMessage({ tone: "ok", text: "Expense added." });
      await loadTransactions();
    }

    setSaving(false);
  }

  async function handleSaveEdit() {
    if (!editing) return;

    if (editing.overrideSplit && splitTotal(editing.splits) !== 100) {
      setMessage({ tone: "error", text: "Shares must add up to 100%." });
      return;
    }

    setSaving(true);
    setMessage(null);

    const response = await fetch(`/api/transactions/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editing.description,
        notes: editing.notes,
        categoryId: editing.categoryId || null,
        tags: parseTags(editing.tags),
        splits: editing.overrideSplit
          ? editing.splits.filter((split) => split.percent > 0)
          : [],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage({ tone: "error", text: data.error ?? "Could not update transaction." });
    } else {
      setEditing(null);
      setMessage({ tone: "ok", text: "Transaction updated." });
      await loadTransactions();
    }

    setSaving(false);
  }

  async function handleDelete(transaction: Transaction) {
    const confirmed = window.confirm(
      `Delete "${transaction.description}" for ${formatCurrencyPrecise(transaction.amount)}? This cannot be undone.`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/transactions/${transaction.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setMessage({ tone: "error", text: "Could not delete transaction." });
      return;
    }

    setMessage({ tone: "ok", text: "Transaction deleted." });
    await loadTransactions();
  }

  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Expenses</h2>
        <p className="text-sm text-muted-foreground">
          Add manual expenses, then search, filter, and edit everything that has been
          imported.
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

      {activePeople.length === 0 ? (
        <Card>
          <CardContent className="p-5 text-sm">
            No people yet. Add them under{" "}
            <span className="font-medium">Settings → People</span> so expenses can be
            split.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add Manual Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
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
            <div className="space-y-2 md:col-span-2">
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
                  <SelectValue placeholder="No account (cash, Venmo, check)" />
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
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
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
            <div className="space-y-2 md:col-span-2">
              <Label>Tags</Label>
              <Input
                placeholder="Vacation, Medical"
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
              />
            </div>

            <div className="space-y-3 md:col-span-2">
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

              {form.overrideSplit || !form.accountId ? (
                <SplitEditor
                  people={activePeople}
                  splits={formSplits}
                  onChange={setFormSplits}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Using the account&apos;s default split.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving || activePeople.length === 0}>
                Add Expense
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <DashboardFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        accounts={accounts}
        people={activePeople}
        showSearch
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Transactions ({transactions.length}) · {formatCurrencyPrecise(total)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Split</TableHead>
                <TableHead>Tags</TableHead>
                {activePeople.map((person) => (
                  <TableHead key={person.id} className="text-right">
                    {person.name}
                  </TableHead>
                ))}
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="whitespace-nowrap">
                    {transaction.date.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <span>{transaction.description}</span>
                    {transaction.notes ? (
                      <p className="text-xs text-muted-foreground">
                        {transaction.notes}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{transaction.category?.name ?? "—"}</TableCell>
                  <TableCell>{transaction.account?.name ?? "Manual"}</TableCell>
                  <TableCell>
                    {describeSplitRows(transaction.splits, people)}
                    {transaction.hasOverride ? (
                      <Badge variant="outline" className="ml-2">
                        override
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {transaction.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  {activePeople.map((person) => (
                    <TableCell
                      key={person.id}
                      className="text-right tabular-nums"
                    >
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
                        onClick={() => handleDelete(transaction)}
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
                    colSpan={9 + activePeople.length}
                    className="text-muted-foreground"
                  >
                    No transactions match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            <Button onClick={handleSaveEdit} disabled={saving}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
