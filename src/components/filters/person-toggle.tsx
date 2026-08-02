"use client";

import { ColorDot } from "@/components/settings/color-picker";
import { personColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

export type PersonOption = { id: string; name: string; color?: string };

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
  const options: PersonOption[] = [{ id: "COMBINED", name: "Combined" }, ...people];

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
            <span className="flex items-center gap-1.5">
              {option.id === "COMBINED" ? null : (
                <ColorDot color={personColor(option.color)} />
              )}
              {option.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
