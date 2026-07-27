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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  SimpleBarChart,
  SimpleLineChart,
  StatCard,
} from "@/components/charts/dashboard-charts";
import {
  formatCurrency,
  formatCurrencyPrecise,
  OWNER_LABELS,
  toDateInputValue,
} from "@/lib/utils";

type IncomeOwner = "MATTHEW" | "GENEVIEVE";

type IncomeEntry = {
  id: string;
  date: string;
  source: string;
  description: string | null;
  amount: string;
  owner: IncomeOwner;
};

type IncomeData = {
  totalIncome: number;
  monthlyIncome: { month: string; total: number }[];
  annualIncome: { year: string; total: number }[];
  incomeByPerson: { name: string; total: number }[];
  incomeVsExpenses: { month: string; income: number; expenses: number }[];
};

const emptyForm = {
  date: toDateInputValue(new Date()),
  source: "",
  description: "",
  amount: "",
  owner: "MATTHEW" as IncomeOwner,
};

export default function IncomePage() {
  const [data, setData] = useState<IncomeData | null>(null);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<(typeof emptyForm & { id: string }) | null>(
    null,
  );
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [dashboardResponse, entriesResponse] = await Promise.all([
      fetch("/api/dashboard/income"),
      fetch("/api/income"),
    ]);

    if (!dashboardResponse.ok || !entriesResponse.ok) {
      setMessage({ tone: "error", text: "Could not load income data." });
      return;
    }

    setData(await dashboardResponse.json());
    setEntries(await entriesResponse.json());
  }, []);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  async function submit(
    url: string,
    method: "POST" | "PATCH",
    values: typeof emptyForm,
    successText: string,
  ): Promise<boolean> {
    setSaving(true);
    setMessage(null);

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: values.date,
        source: values.source,
        description: values.description || undefined,
        amount: Number(values.amount),
        owner: values.owner,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setMessage({ tone: "error", text: body.error ?? "Could not save income." });
      setSaving(false);
      return false;
    }

    setMessage({ tone: "ok", text: successText });
    await load();
    setSaving(false);
    return true;
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const created = await submit("/api/income", "POST", form, "Income saved.");
    if (created) setForm({ ...emptyForm, date: form.date });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const updated = await submit(
      `/api/income/${editing.id}`,
      "PATCH",
      editing,
      "Income updated.",
    );
    if (updated) setEditing(null);
  }

  async function handleDelete(entry: IncomeEntry) {
    if (
      !window.confirm(
        `Delete ${entry.source} for ${formatCurrencyPrecise(Number(entry.amount))}?`,
      )
    ) {
      return;
    }

    const response = await fetch(`/api/income/${entry.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage({ tone: "error", text: "Could not delete the entry." });
      return;
    }

    setMessage({ tone: "ok", text: "Income deleted." });
    await load();
  }

  const currentYear = String(new Date().getUTCFullYear());
  const thisYearIncome =
    data?.annualIncome.find((item) => item.year === currentYear)?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Income Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Record income by person and compare it against spending.
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
        <StatCard label="Total Income" value={formatCurrency(data?.totalIncome ?? 0)} />
        <StatCard
          label={`${currentYear} Income`}
          value={formatCurrency(thisYearIncome)}
        />
        <StatCard
          label="Months Tracked"
          value={String(data?.monthlyIncome.length ?? 0)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Income</CardTitle>
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
            <div className="space-y-2">
              <Label>Source</Label>
              <Input
                placeholder="Employer, side project, dividend"
                value={form.source}
                onChange={(event) => setForm({ ...form, source: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select
                value={form.owner}
                onValueChange={(value) =>
                  setForm({ ...form, owner: value as IncomeOwner })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MATTHEW">Matthew</SelectItem>
                  <SelectItem value="GENEVIEVE">Genevieve</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                Save Income
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Income</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={data?.monthlyIncome ?? []}
              xKey="month"
              yKey="total"
              name="Income"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Annual Income</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={data?.annualIncome ?? []}
              xKey="year"
              yKey="total"
              name="Income"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income by Person</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={data?.incomeByPerson ?? []}
              xKey="name"
              yKey="total"
              name="Income"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              data={data?.incomeVsExpenses ?? []}
              xKey="month"
              lines={[
                { key: "income", color: SERIES_COLORS[0], name: "Income" },
                { key: "expenses", color: SERIES_COLORS[1], name: "Expenses" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Entries ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">
                    {entry.date.slice(0, 10)}
                  </TableCell>
                  <TableCell>{entry.source}</TableCell>
                  <TableCell>{entry.description ?? "—"}</TableCell>
                  <TableCell>{OWNER_LABELS[entry.owner]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(Number(entry.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${entry.source}`}
                        onClick={() =>
                          setEditing({
                            id: entry.id,
                            date: entry.date.slice(0, 10),
                            source: entry.source,
                            description: entry.description ?? "",
                            amount: String(Number(entry.amount)),
                            owner: entry.owner,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${entry.source}`}
                        onClick={() => handleDelete(entry)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No income recorded yet.
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
            <DialogTitle>Edit Income</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editing.date}
                  onChange={(event) =>
                    setEditing({ ...editing, date: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editing.amount}
                  onChange={(event) =>
                    setEditing({ ...editing, amount: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input
                  value={editing.source}
                  onChange={(event) =>
                    setEditing({ ...editing, source: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select
                  value={editing.owner}
                  onValueChange={(value) =>
                    setEditing({ ...editing, owner: value as IncomeOwner })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATTHEW">Matthew</SelectItem>
                    <SelectItem value="GENEVIEVE">Genevieve</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editing.description}
                  onChange={(event) =>
                    setEditing({ ...editing, description: event.target.value })
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
