"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Person = {
  id: string;
  name: string;
  isActive: boolean;
};

export type SplitRow = { personId: string; percent: number };

export function splitTotal(splits: SplitRow[]) {
  return splits.reduce((sum, split) => sum + (Number(split.percent) || 0), 0);
}

/** An even split across the given people, remainder landing on the first. */
export function evenSplit(people: Person[]): SplitRow[] {
  if (people.length === 0) return [];
  const base = Math.floor(100 / people.length);
  const remainder = 100 - base * people.length;

  return people.map((person, index) => ({
    personId: person.id,
    percent: index === 0 ? base + remainder : base,
  }));
}

export function describeSplitRows(splits: SplitRow[], people: Person[]): string {
  const owning = splits.filter((split) => split.percent > 0);
  if (owning.length === 0) return "Unassigned";
  if (owning.length === 1) {
    return people.find((person) => person.id === owning[0].personId)?.name ?? "Unknown";
  }
  return "Shared";
}

/**
 * Percentage-per-person editor. Shares must total 100 before a save is allowed,
 * so the running total is shown rather than silently normalized.
 */
export function SplitEditor({
  people,
  splits,
  onChange,
  compact = false,
}: {
  people: Person[];
  splits: SplitRow[];
  onChange: (splits: SplitRow[]) => void;
  compact?: boolean;
}) {
  const total = splitTotal(splits);
  const balanced = total === 100;

  function setPercent(personId: string, raw: string) {
    const percent = Math.min(Math.max(Number(raw) || 0, 0), 100);
    const existing = splits.some((split) => split.personId === personId);

    onChange(
      existing
        ? splits.map((split) =>
            split.personId === personId ? { ...split, percent } : split,
          )
        : [...splits, { personId, percent }],
    );
  }

  function assignAll(personId: string) {
    onChange([{ personId, percent: 100 }]);
  }

  if (people.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add people in Settings before assigning shares.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {people.map((person) => {
          const percent =
            splits.find((split) => split.personId === person.id)?.percent ?? 0;

          return (
            <label key={person.id} className="space-y-1">
              <span className="text-sm font-medium">{person.name}</span>
              <span className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={percent}
                  onChange={(event) => setPercent(person.id, event.target.value)}
                  aria-label={`${person.name} share percentage`}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "text-sm tabular-nums",
            balanced ? "text-muted-foreground" : "text-destructive",
          )}
        >
          Total {total}%{balanced ? "" : " — must equal 100%"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(evenSplit(people))}
        >
          Split evenly
        </Button>
        {people.map((person) => (
          <Button
            key={person.id}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => assignAll(person.id)}
          >
            All {person.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
