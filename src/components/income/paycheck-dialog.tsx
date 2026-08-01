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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEDUCTION_FIELDS, netIncome, totalDeductions } from "@/lib/income";
import { cn, formatCurrencyPrecise } from "@/lib/utils";

export type PaycheckDraft = {
  month: string;
  personId: string;
  companyId: string;
  annualSalary: string;
  grossIncome: string;
  medical: string;
  dentalVision: string;
  retirement401k: string;
  hsa: string;
  taxes: string;
};

export function blankPaycheck(month: string, personId = ""): PaycheckDraft {
  return {
    month,
    personId,
    companyId: "",
    annualSalary: "",
    grossIncome: "",
    medical: "",
    dentalVision: "",
    retirement401k: "",
    hsa: "",
    taxes: "",
  };
}

function toNumber(value: string) {
  return Number(value) || 0;
}

export function PaycheckDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  people,
  companies,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: PaycheckDraft;
  onDraftChange: (draft: PaycheckDraft) => void;
  people: { id: string; name: string }[];
  companies: { id: string; name: string; personId: string; isActive: boolean }[];
  onSaved: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const paycheck = {
    grossIncome: toNumber(draft.grossIncome),
    medical: toNumber(draft.medical),
    dentalVision: toNumber(draft.dentalVision),
    retirement401k: toNumber(draft.retirement401k),
    hsa: toNumber(draft.hsa),
    taxes: toNumber(draft.taxes),
  };

  const deductions = totalDeductions(paycheck);
  const net = netIncome(paycheck);
  const overDrawn = deductions > paycheck.grossIncome;

  /** Monthly gross is usually annual ÷ 12; offer it rather than impose it. */
  const suggestedGross = toNumber(draft.annualSalary) / 12;

  // Only this person's companies, and only current ones — unless a past
  // employer is already attached to the paycheck being edited.
  const options = companies.filter(
    (company) =>
      company.personId === draft.personId &&
      (company.isActive || company.id === draft.companyId),
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (!draft.personId) {
      setError("Choose whose paycheck this is.");
      return;
    }
    if (overDrawn) {
      setError("Deductions add up to more than gross income.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/monthly-income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: draft.month,
        personId: draft.personId,
        companyId: draft.companyId || null,
        annualSalary: toNumber(draft.annualSalary),
        ...paycheck,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save the paycheck.");
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
          <DialogTitle>Monthly Paycheck</DialogTitle>
          <DialogDescription>Record income</DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Month</Label>
              <Input
                type="month"
                value={draft.month}
                onChange={(event) =>
                  onDraftChange({ ...draft, month: event.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Person</Label>
              <Select
                value={draft.personId}
                onValueChange={(value) =>
                  // Companies belong to a person, so the old pick can't carry over.
                  onDraftChange({ ...draft, personId: value, companyId: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a person" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Company</Label>
              <Select
                value={draft.companyId || "none"}
                onValueChange={(value) =>
                  onDraftChange({
                    ...draft,
                    companyId: value === "none" ? "" : value,
                  })
                }
                disabled={!draft.personId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No company</SelectItem>
                  {options.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.personId && options.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No companies yet for this person — add them under Settings →
                  People → Companies.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Annual Salary</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={draft.annualSalary}
                onChange={(event) =>
                  onDraftChange({ ...draft, annualSalary: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Gross</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={draft.grossIncome}
                onChange={(event) =>
                  onDraftChange({ ...draft, grossIncome: event.target.value })
                }
                required
              />
              {suggestedGross > 0 && !draft.grossIncome ? (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      grossIncome: suggestedGross.toFixed(2),
                    })
                  }
                >
                  Use {formatCurrencyPrecise(suggestedGross)} (salary ÷ 12)
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Deductions</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {DEDUCTION_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={draft[field.key]}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        [field.key]: event.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-muted-foreground">
                Net = Gross {formatCurrencyPrecise(paycheck.grossIncome)} −
                Deductions {formatCurrencyPrecise(deductions)}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  overDrawn ? "text-destructive" : "text-foreground",
                )}
              >
                Net {formatCurrencyPrecise(net)}
              </span>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || people.length === 0}>
              Save Paycheck
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
