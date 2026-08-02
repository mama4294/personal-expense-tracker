"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  blankIncome,
  IncomeDialog,
  type IncomeDraft,
} from "@/components/income/income-dialog";
import {
  blankPaycheck,
  PaycheckDialog,
  type PaycheckDraft,
} from "@/components/income/paycheck-dialog";
import { netIncome } from "@/lib/income";
import { personColor } from "@/lib/colors";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatMonthLabel,
} from "@/lib/utils";

type Person = { id: string; name: string; isActive: boolean; color: string };

type IncomeEntry = {
  id: string;
  date: string;
  source: string;
  description: string | null;
  amount: string;
  personId: string;
  person: { id: string; name: string };
};

type Company = {
  id: string;
  name: string;
  personId: string;
  isActive: boolean;
};

type Paycheck = {
  id: string;
  month: string;
  personId: string;
  person: { id: string; name: string };
  companyId: string | null;
  company: { id: string; name: string } | null;
  annualSalary: string;
  grossIncome: string;
  medical: string;
  dentalVision: string;
  retirement401k: string;
  hsa: string;
  taxes: string;
};

type IncomeData = {
  totalIncome: number;
  monthlyIncome: { month: string; total: number }[];
  annualIncome: { year: string; total: number }[];
  incomeByPerson: { name: string; total: number }[];
  incomeVsExpenses: { month: string; income: number; expenses: number }[];
};

export default function IncomePage() {
  const [data, setData] = useState<IncomeData | null>(null);
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<IncomeDraft>(blankIncome);
  const [paycheckOpen, setPaycheckOpen] = useState(false);
  const [paycheckDraft, setPaycheckDraft] = useState<PaycheckDraft>(() =>
    blankPaycheck(new Date().toISOString().slice(0, 7)),
  );
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(
    null,
  );

  const activePeople = people.filter((person) => person.isActive);
  const colorByPerson = Object.fromEntries(
    activePeople.map((entry) => [entry.name, personColor(entry.color)]),
  );

  const load = useCallback(async () => {
    const [
      dashboardResponse,
      entriesResponse,
      peopleResponse,
      paycheckResponse,
      companyResponse,
    ] = await Promise.all([
        fetch("/api/dashboard/income"),
        fetch("/api/income"),
        fetch("/api/people"),
        fetch("/api/monthly-income"),
        fetch("/api/companies"),
      ]);

    if (
      !dashboardResponse.ok ||
      !entriesResponse.ok ||
      !peopleResponse.ok ||
      !paycheckResponse.ok ||
      !companyResponse.ok
    ) {
      setMessage({ tone: "error", text: "Could not load income data." });
      return;
    }

    setData(await dashboardResponse.json());
    setEntries(await entriesResponse.json());
    setPeople(await peopleResponse.json());
    setPaychecks(await paycheckResponse.json());
    setCompanies(await companyResponse.json());
  }, []);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  function openAddOther() {
    setDraft({ ...blankIncome(), personId: activePeople[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openAddPaycheck() {
    setPaycheckDraft(
      blankPaycheck(
        new Date().toISOString().slice(0, 7),
        activePeople[0]?.id ?? "",
      ),
    );
    setPaycheckOpen(true);
  }

  function openEditPaycheck(paycheck: Paycheck) {
    setPaycheckDraft({
      month: paycheck.month.slice(0, 7),
      personId: paycheck.personId,
      companyId: paycheck.companyId ?? "",
      annualSalary: String(Number(paycheck.annualSalary)),
      grossIncome: String(Number(paycheck.grossIncome)),
      medical: String(Number(paycheck.medical)),
      dentalVision: String(Number(paycheck.dentalVision)),
      retirement401k: String(Number(paycheck.retirement401k)),
      hsa: String(Number(paycheck.hsa)),
      taxes: String(Number(paycheck.taxes)),
    });
    setPaycheckOpen(true);
  }

  async function deletePaycheck(paycheck: Paycheck) {
    if (
      !window.confirm(
        `Delete the ${formatMonthLabel(paycheck.month)} paycheck for ${paycheck.person.name}?`,
      )
    ) {
      return;
    }

    const response = await fetch(`/api/monthly-income/${paycheck.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setMessage({ tone: "error", text: "Could not delete the paycheck." });
      return;
    }

    setMessage({ tone: "ok", text: "Paycheck deleted." });
    await load();
  }

  /** Numbers for a stored paycheck row, as the shared helpers expect them. */
  function toPaycheck(entry: Paycheck) {
    return {
      grossIncome: Number(entry.grossIncome),
      medical: Number(entry.medical),
      dentalVision: Number(entry.dentalVision),
      retirement401k: Number(entry.retirement401k),
      hsa: Number(entry.hsa),
      taxes: Number(entry.taxes),
    };
  }


  function openEdit(entry: IncomeEntry) {
    setDraft({
      id: entry.id,
      date: entry.date.slice(0, 10),
      source: entry.source,
      description: entry.description ?? "",
      amount: String(Number(entry.amount)),
      personId: entry.personId,
    });
    setDialogOpen(true);
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Income</h2>
          <p className="text-sm text-muted-foreground">
            Record income by person and compare it against spending.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={openAddOther}
            disabled={activePeople.length === 0}
          >
            <Plus className="h-4 w-4" />
            Other Income
          </Button>
          <Button onClick={openAddPaycheck} disabled={activePeople.length === 0}>
            <Plus className="h-4 w-4" />
            Add Paycheck
          </Button>
        </div>
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
            <span className="font-medium">Settings → People</span> before recording
            income.
          </CardContent>
        </Card>
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
              xTickFormatter={formatMonthLabel}
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
              colorByLabel={colorByPerson}
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
              xTickFormatter={formatMonthLabel}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Paychecks ({paychecks.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gross pay and deductions per person per month. Net is what reached the
            bank; 401k and HSA are saved rather than spent.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Annual Salary</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Taxes</TableHead>
                <TableHead className="text-right">401k</TableHead>
                <TableHead className="text-right">HSA</TableHead>
                <TableHead className="text-right">Med + Dental</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paychecks.map((entry) => {
                const values = toPaycheck(entry);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatMonthLabel(entry.month)}
                    </TableCell>
                    <TableCell>{entry.person.name}</TableCell>
                    <TableCell>{entry.company?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(entry.annualSalary))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(values.grossIncome)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(values.taxes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(values.retirement401k)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(values.hsa)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyPrecise(values.medical + values.dentalVision)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrencyPrecise(netIncome(values))}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${formatMonthLabel(entry.month)} paycheck`}
                          onClick={() => openEditPaycheck(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${formatMonthLabel(entry.month)} paycheck`}
                          onClick={() => deletePaycheck(entry)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paychecks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground">
                    No paychecks recorded yet. Add one to unlock the Cash Flow page.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Other Income ({entries.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            One-off income that isn&apos;t part of a paycheck — dividends, side work,
            gifts.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Person</TableHead>
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
                  <TableCell>{entry.person.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyPrecise(Number(entry.amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${entry.source}`}
                        onClick={() => openEdit(entry)}
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

      <PaycheckDialog
        open={paycheckOpen}
        onOpenChange={setPaycheckOpen}
        draft={paycheckDraft}
        onDraftChange={setPaycheckDraft}
        people={activePeople}
        companies={companies}
        onSaved={load}
      />

      <IncomeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        onDraftChange={setDraft}
        people={activePeople}
        onSaved={load}
      />
    </div>
  );
}
