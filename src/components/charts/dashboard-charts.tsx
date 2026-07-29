"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";

/**
 * Categorical series colors in fixed slot order — assigned by position, never
 * cycled. Validated against the white card surface for lightness band, chroma,
 * colorblind separation, and normal-vision separation.
 */
export const SERIES_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

/** Ninth and beyond fold into a single neutral "Other" slice. */
const OTHER_COLOR = "#898781";
const GRID_COLOR = "#e2e8f0";
const AXIS_COLOR = "#c3c2b7";
const TICK_COLOR = "#64748b";

export type ValueFormat = "currency" | "percent";

function formatValue(value: number, format: ValueFormat): string {
  return format === "percent"
    ? `${value.toFixed(1)}%`
    : formatCurrencyPrecise(value);
}

/** Compact axis ticks that stay readable at small magnitudes. */
function axisTick(value: number, format: ValueFormat): string {
  if (format === "percent") return `${Math.round(value)}%`;
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (magnitude >= 10_000) return `$${Math.round(value / 1000)}k`;
  if (magnitude >= 1_000) return `$${(value / 1000).toFixed(1)}k`;
  return formatCurrency(value);
}

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${GRID_COLOR}`,
  fontSize: 12,
} as const;

export function SimpleBarChart({
  data,
  xKey,
  yKey,
  valueFormat = "currency",
  name,
  onSelect,
  selected,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  valueFormat?: ValueFormat;
  name?: string;
  /** Makes bars clickable; receives the category/account label that was hit. */
  onSelect?: (label: string) => void;
  selected?: string | null;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12, fill: TICK_COLOR }}
          stroke={AXIS_COLOR}
        />
        <YAxis
          tickFormatter={(value) => axisTick(Number(value), valueFormat)}
          tick={{ fontSize: 12, fill: TICK_COLOR }}
          stroke={AXIS_COLOR}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
          formatter={(value) => formatValue(Number(value), valueFormat)}
        />
        <Bar
          dataKey={yKey}
          name={name ?? yKey}
          fill={SERIES_COLORS[0]}
          radius={[4, 4, 0, 0]}
          cursor={onSelect ? "pointer" : undefined}
          onClick={
            onSelect
              ? (entry: unknown) => {
                  // Recharts hands back the rendered bar; the original row sits
                  // on `payload`.
                  const bar = entry as {
                    payload?: Record<string, unknown>;
                  } & Record<string, unknown>;
                  onSelect(String(bar.payload?.[xKey] ?? bar[xKey] ?? ""));
                }
              : undefined
          }
        >
          {onSelect
            ? data.map((entry) => {
                const label = String(entry[xKey] ?? "");
                const dimmed = selected != null && selected !== label;
                return (
                  <Cell
                    key={label}
                    fill={SERIES_COLORS[0]}
                    fillOpacity={dimmed ? 0.25 : 1}
                  />
                );
              })
            : null}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart({
  data,
  xKey,
  lines,
  valueFormat = "currency",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  lines: { key: string; color: string; name: string }[];
  valueFormat?: ValueFormat;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12, fill: TICK_COLOR }}
          stroke={AXIS_COLOR}
        />
        <YAxis
          tickFormatter={(value) => axisTick(Number(value), valueFormat)}
          tick={{ fontSize: 12, fill: TICK_COLOR }}
          stroke={AXIS_COLOR}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => formatValue(Number(value), valueFormat)}
        />
        {/* A single series is named by the card title; a legend would be noise. */}
        {lines.length > 1 ? <Legend iconType="circle" /> : null}
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Slices are colored by slot order. Anything past the eighth slot is folded into
 * a single neutral "Other" rather than recycling a hue that already means
 * something else on the same chart.
 */
export function SimplePieChart({
  data,
  onSelect,
  selected,
}: {
  data: { name: string; total: number }[];
  /** Makes slices clickable; receives the slice label that was hit. */
  onSelect?: (label: string) => void;
  selected?: string | null;
}) {
  const sorted = [...data].sort((a, b) => b.total - a.total);
  const slices = sorted.slice(0, SERIES_COLORS.length);
  const overflow = sorted.slice(SERIES_COLORS.length);

  if (overflow.length > 0) {
    slices.push({
      name: `Other (${overflow.length})`,
      total: overflow.reduce((sum, item) => sum + item.total, 0),
    });
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="total"
          nameKey="name"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={2}
          cursor={onSelect ? "pointer" : undefined}
          onClick={
            onSelect
              ? (entry: { name?: string }) => onSelect(String(entry.name ?? ""))
              : undefined
          }
        >
          {slices.map((slice, index) => (
            <Cell
              key={slice.name}
              fill={
                index < SERIES_COLORS.length
                  ? SERIES_COLORS[index]
                  : OTHER_COLOR
              }
              fillOpacity={
                selected != null && selected !== slice.name ? 0.25 : 1
              }
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => formatCurrencyPrecise(Number(value))}
        />
        <Legend iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
