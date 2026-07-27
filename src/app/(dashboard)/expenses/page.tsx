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
  formatCurrencyPrecise,
  OWNER_LABELS,
  toDateInputValue,
} from "@/lib/utils";

type Owner = "MATTHEW" | "GENEVIEVE" | "SHARED";

type Transaction = {
  id: string;
  date: string;
  description: string;
  notes: string | null;
  amount: number;
  owner: Owner;
  matthewSplitPercent: number | null;
  genevieveSplitPercent: number | null;
  isManual: boolean;
  account: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  tags: string[];
  split: { matthew: number; genevieve: number };
};

type Option = { id: string; name: string };

const emptyForm = {
  date: toDateInputValue(new Date()),
  amount: "",
  description: "",
  notes: "",
  owner: "SHARED" as Owner,
  categoryId: "",
  accountId: "",
  tags: "",
  overrideSplit: false,
  matthewSplitPercent: "50",
};

type EditState = {
  id: string;
  description: string;
  notes: string;
  owner: Owner;
  categoryId: string;
  tags: string;
  overrideSplit: boolean;
  matthewSplitPercent: string;
};

export default function ExpensesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const loadTransactions = useCallback(async () => {
    const response = await fetch(`/api/transactions?${filtersToQuery(filters)}`);
    if (!response.ok) {
      setMessage({ tone: "error", text: "Could not load transactions." });
      return;
    }
    setTransactions(await response.json());
  }, [filters]);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((response) => response.json()),
      fetch("/api/accounts").then((response) => response.json()),
    ])
      .then(([categoryData, accountData]) => {
        setCategories(categoryData);
        setAccounts(accountData);
      })
      .catch(() =>
        setMessage({ tone: "error", text: "Could not load categories or accounts." }),
      );
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

  function splitFields(overrideSplit: boolean, matthewPercent: string) {
    if (!overrideSplit) {
      return { matthewSplitPercent: null, genevieveSplitPercent: null };
    }
    const matthew = Math.min(Math.max(Number(matthewPercent) || 0, 0), 100);
    return {
      matthewSplitPercent: matthew,
      genevieveSplitPercent: 100 - matthew,
    };
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const split = splitFields(form.overrideSplit, form.matthewSplitPercent);
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        amount: Number(form.amount),
        description: form.description,
        notes: form.notes || undefined,
        owner: form.owner,
        categoryId: form.categoryId || undefined,
        accountId: form.accountId || undefined,
        tags: parseTags(form.tags),
        matthewSplitPercent: split.matthewSplitPercent ?? undefined,
        genevieveSplitPercent: split.genevieveSplitPercent ?? undefined,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage({ tone: "error", text: data.error ?? "Could not save expense." });
    } else {
      setForm({ ...emptyForm, date: form.date });
      setMessage({ tone: "ok", text: "Expense added." });
      await loadTransactions();
    }

    setSaving(false);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    setMessage(null);

    const split = splitFields(editing.overrideSplit, editing.matthewSplitPercent);
    const response = await fetch(`/api/transactions/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: editing.description,
        notes: editing.notes,
        owner: editing.owner,
        categoryId: editing.categoryId || null,
        tags: parseTags(editing.tags),
        matthewSplitPercent: split.matthewSplitPercent,
        genevieveSplitPercent: split.genevieveSplitPercent,
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
  const sharedSelected = form.owner === "SHARED";

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
              <Label>Owner</Label>
              <Select
                value={form.owner}
                onValueChange={(value) =>
                  setForm({ ...form, owner: value as Owner })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MATTHEW">Matthew</SelectItem>
                  <SelectItem value="GENEVIEVE">Genevieve</SelectItem>
                  <SelectItem value="SHARED">Shared</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input
                placeholder="Vacation, Medical"
                value={form.tags}
                onChange={(event) => setForm({ ...form, tags: event.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.overrideSplit}
                  onChange={(event) =>
                    setForm({ ...form, overrideSplit: event.target.checked })
                  }
                />
                Override split percentage
                {!sharedSelected && form.overrideSplit ? (
                  <span className="text-xs text-muted-foreground">
                    (an override applies regardless of owner)
                  </span>
                ) : null}
              </label>
              {form.overrideSplit ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    className="max-w-[140px]"
                    value={form.matthewSplitPercent}
                    onChange={(event) =>
                      setForm({ ...form, matthewSplitPercent: event.target.value })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    % Matthew / {100 - (Number(form.matthewSplitPercent) || 0)} %
                    Genevieve
                  </span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
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
                <TableHead>Owner</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Matthew</TableHead>
                <TableHead className="text-right">Genevieve</TableHead>
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
                  <TableCell>{OWNER_LABELS[transaction.owner]}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {transaction.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(transaction.split.matthew)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(transaction.split.genevieve)}
                  </TableCell>
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
                            owner: transaction.owner,
                            categoryId: transaction.category?.id ?? "",
                            tags: transaction.tags.join(", "),
                            overrideSplit: transaction.matthewSplitPercent != null,
                            matthewSplitPercent: String(
                              transaction.matthewSplitPercent ?? 50,
                            ),
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
                  <TableCell colSpan={10} className="text-muted-foreground">
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
                <Label>Owner</Label>
                <Select
                  value={editing.owner}
                  onValueChange={(value) =>
                    setEditing({ ...editing, owner: value as Owner })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATTHEW">Matthew</SelectItem>
                    <SelectItem value="GENEVIEVE">Genevieve</SelectItem>
                    <SelectItem value="SHARED">Shared</SelectItem>
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
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.overrideSplit}
                    onChange={(event) =>
                      setEditing({ ...editing, overrideSplit: event.target.checked })
                    }
                  />
                  Override split percentage
                </label>
                {editing.overrideSplit ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      className="max-w-[140px]"
                      value={editing.matthewSplitPercent}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          matthewSplitPercent: event.target.value,
                        })
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      % Matthew /{" "}
                      {100 - (Number(editing.matthewSplitPercent) || 0)} % Genevieve
                    </span>
                  </div>
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
