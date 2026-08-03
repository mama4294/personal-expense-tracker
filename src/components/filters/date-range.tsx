"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type DateRange = { startDate: string; endDate: string };

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(year: number, month: number) {
  return iso(new Date(Date.UTC(year, month, 1)));
}

/** Day 0 of the following month is the last day of this one. */
function endOfMonth(year: number, month: number) {
  return iso(new Date(Date.UTC(year, month + 1, 0)));
}

export type RangePreset = {
  id: string;
  label: string;
  resolve: (now: Date) => DateRange;
};

// Everything is computed in UTC to match how dates are stored and compared.
export const RANGE_PRESETS: RangePreset[] = [
  {
    id: "this-month",
    label: "This month",
    resolve: (now) => ({
      startDate: startOfMonth(now.getUTCFullYear(), now.getUTCMonth()),
      endDate: endOfMonth(now.getUTCFullYear(), now.getUTCMonth()),
    }),
  },
  {
    id: "last-month",
    label: "Last month",
    resolve: (now) => ({
      startDate: startOfMonth(now.getUTCFullYear(), now.getUTCMonth() - 1),
      endDate: endOfMonth(now.getUTCFullYear(), now.getUTCMonth() - 1),
    }),
  },
  {
    id: "last-3-months",
    label: "Last 3 months",
    resolve: (now) => ({
      startDate: startOfMonth(now.getUTCFullYear(), now.getUTCMonth() - 2),
      endDate: endOfMonth(now.getUTCFullYear(), now.getUTCMonth()),
    }),
  },
  {
    id: "year-to-date",
    label: "Year to date",
    resolve: (now) => ({
      startDate: startOfMonth(now.getUTCFullYear(), 0),
      endDate: endOfMonth(now.getUTCFullYear(), now.getUTCMonth()),
    }),
  },
  {
    id: "last-12-months",
    label: "Last 12 months",
    resolve: (now) => ({
      startDate: startOfMonth(now.getUTCFullYear(), now.getUTCMonth() - 11),
      endDate: endOfMonth(now.getUTCFullYear(), now.getUTCMonth()),
    }),
  },
  {
    id: "last-year",
    label: "Last year",
    resolve: (now) => ({
      startDate: startOfMonth(now.getUTCFullYear() - 1, 0),
      endDate: endOfMonth(now.getUTCFullYear() - 1, 11),
    }),
  },
  {
    // Last, because it's the escape hatch rather than the everyday view.
    id: "all",
    label: "All time",
    resolve: () => ({ startDate: "", endDate: "" }),
  },
];

/** The range the Spending page opens on. */
export const DEFAULT_RANGE_PRESET = "last-month";

export function defaultRange(now: Date = new Date()): DateRange {
  const preset = RANGE_PRESETS.find((entry) => entry.id === DEFAULT_RANGE_PRESET);
  return preset ? preset.resolve(now) : { startDate: "", endDate: "" };
}

/** Which preset, if any, the current dates correspond to. */
export function activePresetId(range: DateRange, now = new Date()): string | null {
  const match = RANGE_PRESETS.find((preset) => {
    const resolved = preset.resolve(now);
    return (
      resolved.startDate === range.startDate && resolved.endDate === range.endDate
    );
  });

  return match?.id ?? null;
}

export function DateRangePicker({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const active = activePresetId(range);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-1">
        {RANGE_PRESETS.map((preset) => {
          const selected = active === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(preset.resolve(new Date()))}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="range-start" className="text-xs">
            From
          </Label>
          <Input
            id="range-start"
            type="date"
            className="w-[170px]"
            value={range.startDate}
            onChange={(event) =>
              onChange({ ...range, startDate: event.target.value })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="range-end" className="text-xs">
            To
          </Label>
          <Input
            id="range-end"
            type="date"
            className="w-[170px]"
            value={range.endDate}
            onChange={(event) => onChange({ ...range, endDate: event.target.value })}
          />
        </div>
        {active === null ? (
          <span className="pb-2 text-xs text-muted-foreground">Custom range</span>
        ) : null}
      </div>
    </div>
  );
}
