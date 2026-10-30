"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/table";
import { PersonBadge } from "@/components/people/person-badge";
import type { Person } from "@/components/people/split-editor";
import { cn, formatCurrency, formatMonthLabel } from "@/lib/utils";

export type CategoryMonthRow = {
  category: string;
  /** Null when nobody is assigned a share of the expense. */
  personId: string | null;
  /** Spending per "YYYY-MM", positive for money out. */
  months: Record<string, number>;
};

type Line = {
  key: string;
  months: Record<string, number>;
} & (
  | { type: "category"; category: string; people: CategoryMonthRow[] }
  | { type: "person"; row: CategoryMonthRow }
);

/** "category", a "YYYY-MM" month column, or "total" (the default, with no header). */
type Sort = { key: string; dir: "asc" | "desc" };

const DEFAULT_SORT: Sort = { key: "total", dir: "desc" };

function SortButton({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string;
  sortKey: string;
  sort: Sort;
  onSort: (key: string) => void;
  align?: "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground",
        align === "right" && "flex-row-reverse",
      )}
    >
      {label}
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * The label columns and the month columns are separate tables, so only the
 * months scroll. Fixed row heights keep the two halves aligned.
 */
const ROW_HEIGHT = "h-11";

function formatAmount(amount: number) {
  return `${amount < 0 ? "−" : ""}${formatCurrency(Math.abs(amount))}`;
}

function sumMonths(rows: CategoryMonthRow[]) {
  const months: Record<string, number> = {};
  for (const row of rows) {
    for (const [month, amount] of Object.entries(row.months)) {
      months[month] = (months[month] ?? 0) + amount;
    }
  }
  return months;
}

function sumAll(months: Record<string, number>) {
  return Object.values(months).reduce((sum, amount) => sum + amount, 0);
}

/** Every month from the earliest with spending through this one, newest first. */
function monthRange(rows: CategoryMonthRow[]) {
  const keys = rows.flatMap((row) => Object.keys(row.months)).sort();
  if (keys.length === 0) return [];

  const now = new Date();
  const end = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const last = keys.at(-1)! > end ? keys.at(-1)! : end;
  const months: string[] = [];
  let [year, month] = keys[0].split("-").map(Number);
  for (let key = keys[0]; key <= last; ) {
    months.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    key = `${year}-${String(month).padStart(2, "0")}`;
  }
  return months.reverse();
}

/**
 * Spending by category, one column per month. Combined shows each category's
 * total and expands into each person's share; a single person's view is just
 * their share, so there is nothing to expand.
 */
export function CategoryMonthTable({
  rows,
  people,
  combined,
}: {
  rows: CategoryMonthRow[];
  people: Person[];
  combined: boolean;
}) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  // Each header cycles through its two directions, then back to the default
  // of largest categories overall.
  function toggleSort(key: string) {
    // Money reads biggest-first; names read A-Z.
    const first = key === "category" ? "asc" : "desc";
    setSort((current) =>
      current.key !== key
        ? { key, dir: first }
        : current.dir === first
          ? { key, dir: first === "asc" ? "desc" : "asc" }
          : DEFAULT_SORT,
    );
  }

  const sortValue = (months: Record<string, number>) =>
    sort.key === "total" ? sumAll(months) : (months[sort.key] ?? 0);

  const months = monthRange(rows);
  const personOrder = (personId: string | null) => {
    const index = people.findIndex((person) => person.id === personId);
    return index === -1 ? people.length : index;
  };

  const byCategory = new Map<string, CategoryMonthRow[]>();
  for (const row of rows) {
    byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row]);
  }

  // Categories follow the chosen column; people stay in their usual order
  // under their category.
  const direction = sort.dir === "asc" ? 1 : -1;
  const lines: Line[] = Array.from(byCategory.entries())
    .map(([category, categoryRows]) => ({ category, categoryRows, months: sumMonths(categoryRows) }))
    .sort((a, b) =>
      sort.key === "category"
        ? a.category.localeCompare(b.category) * direction
        : (sortValue(a.months) - sortValue(b.months)) * direction || a.category.localeCompare(b.category),
    )
    .flatMap(({ category, categoryRows, months: categoryMonths }) => {
      const members = [...categoryRows].sort((a, b) => personOrder(a.personId) - personOrder(b.personId));
      const line: Line = { type: "category", key: category, category, people: members, months: categoryMonths };
      if (!combined || !expanded.has(category)) return [line];
      return [
        line,
        ...members.map((row): Line => ({
          type: "person",
          key: `${category}:${row.personId ?? ""}`,
          row,
          months: row.months,
        })),
      ];
    });

  const totals = sumMonths(rows);

  function toggle(category: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const rowClass = (line: Line) =>
    cn(
      "border-b border-border",
      ROW_HEIGHT,
      line.type === "person" && "bg-muted/30",
      hoveredRow === line.key && "bg-muted/50",
    );
  const totalClass = cn("border-t-2 border-border font-semibold", ROW_HEIGHT);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No spending recorded yet.</p>;
  }

  return (
    <div className="flex whitespace-nowrap text-sm" onMouseLeave={() => setHoveredRow(null)}>
      <table className="shrink-0 border-r border-border">
        <thead>
          <tr className="h-10 border-b border-border">
            <th className="max-w-52 px-3 text-left font-medium">
              <SortButton label="Category" sortKey="category" sort={sort} onSort={toggleSort} />
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.key} onMouseEnter={() => setHoveredRow(line.key)} className={rowClass(line)}>
              {line.type === "category" ? (
                <td className="max-w-52 px-3 font-medium">
                  {combined ? (
                    <button
                      type="button"
                      aria-expanded={expanded.has(line.category)}
                      aria-label={`${expanded.has(line.category) ? "Collapse" : "Expand"} ${line.category}`}
                      className="-ml-1 flex max-w-full items-center gap-1 rounded-md px-1 hover:bg-muted"
                      onClick={() => toggle(line.category)}
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          expanded.has(line.category) && "rotate-90",
                        )}
                      />
                      <span className="truncate">{line.category}</span>
                    </button>
                  ) : (
                    <span className="block truncate">{line.category}</span>
                  )}
                </td>
              ) : (
                <td className="px-3 pl-9">
                  {line.row.personId ? (
                    <PersonBadge
                      name={people.find((entry) => entry.id === line.row.personId)?.name ?? "Unknown"}
                      color={people.find((entry) => entry.id === line.row.personId)?.color}
                    />
                  ) : (
                    <Badge variant="outline">Unassigned</Badge>
                  )}
                </td>
              )}
            </tr>
          ))}
          <tr className={totalClass}>
            <td className="px-3">Total spending</td>
          </tr>
        </tbody>
      </table>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="h-10 border-b border-border">
              {months.map((month) => (
                <th key={month} className="px-3 text-right font-medium">
                  <SortButton
                    label={formatMonthLabel(month)}
                    sortKey={month}
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.key} onMouseEnter={() => setHoveredRow(line.key)} className={rowClass(line)}>
                {months.map((month) => {
                  const amount = line.months[month];
                  return (
                    <td
                      key={month}
                      className={cn(
                        "px-3 text-right tabular-nums",
                        amount === undefined && "text-muted-foreground",
                        line.type === "person" && "text-muted-foreground",
                      )}
                    >
                      {amount === undefined ? "—" : formatAmount(amount)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className={totalClass}>
              {months.map((month) => (
                <td key={month} className="px-3 text-right tabular-nums">
                  {formatAmount(totals[month] ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
