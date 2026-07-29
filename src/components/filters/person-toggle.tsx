"use client";

import { cn } from "@/lib/utils";

export type PersonOption = { id: string; name: string };

/**
 * Segmented control for "whose spending am I looking at". Combined always sits
 * first; the rest come from the people list, so it grows with the household.
 */
export function PersonToggle({
  people,
  value,
  onChange,
}: {
  people: PersonOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = [{ id: "COMBINED", name: "Combined" }, ...people];

  return (
    <div
      role="group"
      aria-label="Filter by person"
      className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-1"
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
