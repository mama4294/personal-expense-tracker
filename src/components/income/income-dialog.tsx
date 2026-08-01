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
import { toDateInputValue } from "@/lib/utils";

export type IncomeDraft = {
  id?: string;
  date: string;
  source: string;
  description: string;
  amount: string;
  personId: string;
};

export function blankIncome(): IncomeDraft {
  return {
    date: toDateInputValue(new Date()),
    source: "",
    description: "",
    amount: "",
    personId: "",
  };
}

/** Shared by "Add Income" and the per-row edit action. */
export function IncomeDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  people,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: IncomeDraft;
  onDraftChange: (draft: IncomeDraft) => void;
  people: { id: string; name: string }[];
  onSaved: () => void | Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editing = Boolean(draft.id);

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (!draft.personId) {
      setError("Choose whose income this is.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(
      editing ? `/api/income/${draft.id}` : "/api/income",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: draft.date,
          source: draft.source,
          description: draft.description || undefined,
          amount: Number(draft.amount),
          personId: draft.personId,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save the income entry.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setError(null);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Income" : "Add Income"}</DialogTitle>
          <DialogDescription>
            Paychecks, side work, dividends — anything coming in.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={draft.date}
              onChange={(event) =>
                onDraftChange({ ...draft, date: event.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={draft.amount}
              onChange={(event) =>
                onDraftChange({ ...draft, amount: event.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Input
              placeholder="Employer, side project, dividend"
              value={draft.source}
              onChange={(event) =>
                onDraftChange({ ...draft, source: event.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Person</Label>
            <Select
              value={draft.personId}
              onValueChange={(value) => onDraftChange({ ...draft, personId: value })}
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
            <Label>Description</Label>
            <Input
              value={draft.description}
              onChange={(event) =>
                onDraftChange({ ...draft, description: event.target.value })
              }
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          ) : null}

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || people.length === 0}>
              {editing ? "Save Changes" : "Add Income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
