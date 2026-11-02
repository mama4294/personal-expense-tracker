"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";

const GRID_COLOR = "#e2e8f0";
const AXIS_COLOR = "#c3c2b7";
const TICK_COLOR = "#64748b";
const LINE_COLOR = "#0f172a";

export type BreakdownSeries = {
  key: string;
  name: string;
  color: string;
  /** Liabilities are drawn below zero. */
  negative?: boolean;
};

function axisTick(value: number) {
  const magnitude = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (magnitude >= 1_000_000) return `${sign}$${(magnitude / 1_000_000).toFixed(1)}M`;
  if (magnitude >= 1_000) return `${sign}$${Math.round(magnitude / 1000)}k`;
  return formatCurrency(value);
}

type TooltipEntry = { dataKey?: string | number; name?: string | number; value?: number; color?: string };

function BreakdownTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-48 rounded-xl border border-border bg-card p-3 text-xs shadow-sm">
      <p className="mb-2 font-medium">{formatMonthLabel(String(label))}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                aria-hidden="true"
                className={entry.dataKey === "netWorth" ? "h-0.5 w-3 rounded-full" : "h-2 w-2 rounded-sm"}
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="tabular-nums font-medium">{formatCurrency(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stacked assets above zero, liabilities below, with the net worth line on the same axis. */
export function NetWorthBreakdownChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: BreakdownSeries[];
}) {
  const rows = data.map((row) => ({
    ...row,
    ...Object.fromEntries(
      series.filter((item) => item.negative).map((item) => [item.key, -Number(row[item.key] ?? 0)]),
    ),
  }));

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.name}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
          Net Worth
        </li>
      </ul>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={rows} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthLabel}
            tick={{ fontSize: 12, fill: TICK_COLOR }}
            stroke={AXIS_COLOR}
          />
          <YAxis
            tickFormatter={(value) => axisTick(Number(value))}
            tick={{ fontSize: 12, fill: TICK_COLOR }}
            stroke={AXIS_COLOR}
            width={64}
          />
          <ReferenceLine y={0} stroke={AXIS_COLOR} />
          <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "#f1f5f9" }} />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name}
              stackId="balances"
              fill={item.color}
              stroke="#ffffff"
              strokeWidth={2}
              maxBarSize={36}
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="netWorth"
            name="Net Worth"
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: LINE_COLOR, stroke: "#ffffff", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny trend line for an account row; values are shown beside it. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-8 w-24" aria-hidden="true" />;
  return (
    <div className="h-8 w-24" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={values.map((value, index) => ({ index, value }))} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
