"use client";

import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { SERIES_COLORS } from "@/components/charts/dashboard-charts";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";

export type SankeyInput = {
  grossIncome: number;
  otherIncome: number;
  taxes: number;
  retirement401k: number;
  hsa: number;
  medical: number;
  dentalVision: number;
  expenses: number;
  savings: number;
  categories: { name: string; total: number }[];
};

type Node = { name: string; tone: "income" | "deduction" | "expense" | "savings" };
type Link = { source: number; target: number; value: number };

const TONE_COLORS: Record<Node["tone"], string> = {
  income: SERIES_COLORS[0],
  deduction: SERIES_COLORS[3],
  expense: SERIES_COLORS[1],
  savings: SERIES_COLORS[2],
};

/** Categories past this point crowd the diagram; the rest fold into "Other". */
const MAX_CATEGORIES = 8;

export function buildSankey(input: SankeyInput): {
  nodes: Node[];
  links: Link[];
} {
  const nodes: Node[] = [];
  const links: Link[] = [];

  const add = (name: string, tone: Node["tone"]) => {
    nodes.push({ name, tone });
    return nodes.length - 1;
  };

  const income = add("Income", "income");

  if (input.otherIncome > 0) {
    // Other income joins the same pool rather than starting its own chain.
    const other = add("Other Income", "income");
    links.push({ source: other, target: income, value: input.otherIncome });
  }

  const takeHome = add("Take-home", "income");

  const deductions: [string, number][] = [
    ["Taxes", input.taxes],
    ["401k", input.retirement401k],
    ["HSA", input.hsa],
    ["Medical", input.medical],
    ["Dental & Vision", input.dentalVision],
  ];

  for (const [name, value] of deductions) {
    if (value <= 0) continue;
    const tone: Node["tone"] =
      name === "401k" || name === "HSA" ? "savings" : "deduction";
    const node = add(name, tone);
    links.push({ source: income, target: node, value });
  }

  const deductionTotal = deductions.reduce((sum, [, value]) => sum + value, 0);
  const takeHomeValue = Math.max(
    input.grossIncome + input.otherIncome - deductionTotal,
    0,
  );

  if (takeHomeValue > 0) {
    links.push({ source: income, target: takeHome, value: takeHomeValue });
  }

  const sorted = [...input.categories].sort((a, b) => b.total - a.total);
  const shown = sorted.slice(0, MAX_CATEGORIES);
  const overflow = sorted.slice(MAX_CATEGORIES);

  for (const category of shown) {
    if (category.total <= 0) continue;
    const node = add(category.name, "expense");
    links.push({ source: takeHome, target: node, value: category.total });
  }

  if (overflow.length > 0) {
    const total = overflow.reduce((sum, item) => sum + item.total, 0);
    if (total > 0) {
      const node = add(`Other (${overflow.length})`, "expense");
      links.push({ source: takeHome, target: node, value: total });
    }
  }

  // Whatever take-home wasn't spent stayed in the bank.
  const leftover = takeHomeValue - input.expenses;
  if (leftover > 0) {
    const node = add("Unspent", "savings");
    links.push({ source: takeHome, target: node, value: leftover });
  }

  return { nodes, links };
}

function SankeyNode({
  x,
  y,
  width,
  height,
  index,
  payload,
  containerWidth,
  incomeColor,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: Node & { value: number };
  containerWidth: number;
  /** Recolours the income nodes to match the selected person. */
  incomeColor?: string;
}) {
  const isRightSide = x + width + 160 > containerWidth;
  const fill =
    payload.tone === "income"
      ? (incomeColor ?? TONE_COLORS.income)
      : (TONE_COLORS[payload.tone] ?? SERIES_COLORS[0]);

  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={1} />
      <text
        textAnchor={isRightSide ? "end" : "start"}
        x={isRightSide ? x - 8 : x + width + 8}
        y={y + height / 2}
        fontSize={12}
        fill="#0f172a"
        dominantBaseline="middle"
      >
        {payload.name}
      </text>
      <text
        textAnchor={isRightSide ? "end" : "start"}
        x={isRightSide ? x - 8 : x + width + 8}
        y={y + height / 2 + 14}
        fontSize={11}
        fill="#64748b"
        dominantBaseline="middle"
      >
        {formatCurrency(payload.value)}
      </text>
    </Layer>
  );
}

export function CashFlowSankey({
  data,
  incomeColor,
}: {
  data: SankeyInput;
  /** Recolours the income nodes to match the selected person. */
  incomeColor?: string;
}) {
  const { nodes, links } = buildSankey(data);

  if (links.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No income or spending recorded for this month.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={460}>
      <Sankey
        data={{ nodes, links }}
        nodePadding={26}
        nodeWidth={12}
        margin={{ top: 10, right: 150, bottom: 10, left: 90 }}
        link={{ stroke: "#cbd5e1", strokeOpacity: 0.45 }}
        node={
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((props: any) => (
            <SankeyNode {...props} incomeColor={incomeColor} />
          )) as never
        }
      >
        <Tooltip
          formatter={(value) => formatCurrencyPrecise(Number(value))}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
        />
      </Sankey>
    </ResponsiveContainer>
  );
}
