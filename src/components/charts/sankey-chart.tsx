"use client";

import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { SERIES_COLORS } from "@/components/charts/dashboard-charts";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";

export type SankeyInput = {
  grossIncome: number;
  /**
   * Gross pay per employer, which should add up to grossIncome. `color` marks
   * whose pay it is, so a combined month shows two earners apart.
   */
  incomeByCompany: { name: string; total: number; color?: string }[];
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

type Node = {
  name: string;
  tone: "income" | "deduction" | "expense" | "savings" | "deficit";
  /** Overrides the tone colour, so an employer can carry its earner's colour. */
  color?: string;
};
type Link = { source: number; target: number; value: number };

const TONE_COLORS: Record<Node["tone"], string> = {
  income: SERIES_COLORS[0],
  deduction: SERIES_COLORS[3],
  expense: SERIES_COLORS[1],
  savings: SERIES_COLORS[2],
  deficit: SERIES_COLORS[7],
};

/** Categories past this point crowd the diagram; the rest fold into "Other". */
const MAX_CATEGORIES = 8;

export function buildSankey(input: SankeyInput): {
  nodes: Node[];
  links: Link[];
} {
  const nodes: Node[] = [];
  const links: Link[] = [];

  const add = (name: string, tone: Node["tone"], color?: string) => {
    nodes.push({ name, tone, color });
    return nodes.length - 1;
  };

  // Every earner pays into one pool, and the pool is what gets divided up. One
  // node per employer on the left makes a second job visible instead of hidden
  // inside a single "Income" total.
  const income = add("Total Income", "income");

  const employers = input.incomeByCompany.filter((entry) => entry.total > 0);
  for (const employer of employers) {
    const node = add(employer.name, "income", employer.color);
    links.push({ source: node, target: income, value: employer.total });
  }

  // Paychecks recorded before the company list existed carry no employer.
  // Without this the inflows wouldn't add up to gross and the diagram would
  // quietly shrink.
  const attributed = employers.reduce((sum, entry) => sum + entry.total, 0);
  const unattributed = input.grossIncome - attributed;
  if (unattributed > 0) {
    const node = add("Other Pay", "income");
    links.push({ source: node, target: income, value: unattributed });
  }

  if (input.otherIncome > 0) {
    // Other income joins the same pool rather than starting its own chain.
    const other = add("Other Income", "income");
    links.push({ source: other, target: income, value: input.otherIncome });
  }

  // The pool divides three ways: what you keep, what the government takes, and
  // what you spend. Take-home is no longer a node of its own — it was a staging
  // post between income and expenses, and it split savings across two places.
  const preTax = input.retirement401k + input.hsa;
  const deductionTotal =
    input.taxes + input.medical + input.dentalVision + preTax;
  const takeHomeValue = Math.max(
    input.grossIncome + input.otherIncome - deductionTotal,
    0,
  );
  const leftover = Math.max(takeHomeValue - input.expenses, 0);

  // Spending more than you took home has to be funded from somewhere — savings
  // drawn down, or a card balance carried. Without an inflow for it, the
  // outflows would exceed the inflows and Sankey would silently inflate the
  // income node to cover the gap, overstating what was earned.
  const shortfall = Math.max(input.expenses - takeHomeValue, 0);
  if (shortfall > 0) {
    const node = add("Deficit", "deficit");
    links.push({ source: node, target: income, value: shortfall });
  }

  // --- kept ----------------------------------------------------------------
  // Pre-tax accounts never reach the bank but are still yours, so they belong
  // here rather than beside taxes.
  if (preTax + leftover > 0) {
    const savings = add("Savings", "savings");
    links.push({ source: income, target: savings, value: preTax + leftover });

    const kept: [string, number][] = [
      ["401k", input.retirement401k],
      ["HSA", input.hsa],
      ["Unspent", leftover],
    ];

    for (const [name, value] of kept) {
      if (value <= 0) continue;
      const node = add(name, "savings");
      links.push({ source: savings, target: node, value });
    }
  }

  // --- taken ---------------------------------------------------------------
  if (input.taxes > 0) {
    const taxes = add("Taxes", "deduction");
    links.push({ source: income, target: taxes, value: input.taxes });
  }

  // --- spent ---------------------------------------------------------------
  // Insurance premiums are withheld from gross, so they never appear as
  // transactions, but they are money spent and belong under Expenses. They keep
  // the deduction colour to show they never passed through the bank.
  const premiums: [string, number][] = [
    ["Medical", input.medical],
    ["Dental & Vision", input.dentalVision],
  ];
  const premiumTotal = premiums.reduce((sum, [, value]) => sum + value, 0);
  const spent = input.expenses + premiumTotal;

  if (spent > 0) {
    const expenses = add("Expenses", "expense");
    links.push({ source: income, target: expenses, value: spent });

    const sorted = [...input.categories].sort((a, b) => b.total - a.total);
    const shown = sorted.slice(0, MAX_CATEGORIES);
    const overflow = sorted.slice(MAX_CATEGORIES);

    for (const category of shown) {
      if (category.total <= 0) continue;
      const node = add(category.name, "expense");
      links.push({ source: expenses, target: node, value: category.total });
    }

    if (overflow.length > 0) {
      const total = overflow.reduce((sum, item) => sum + item.total, 0);
      if (total > 0) {
        const node = add(`Other (${overflow.length})`, "expense");
        links.push({ source: expenses, target: node, value: total });
      }
    }

    for (const [name, value] of premiums) {
      if (value <= 0) continue;
      const node = add(name, "deduction");
      links.push({ source: expenses, target: node, value });
    }
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
    payload.color ??
    (payload.tone === "income"
      ? (incomeColor ?? TONE_COLORS.income)
      : (TONE_COLORS[payload.tone] ?? SERIES_COLORS[0]));

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
        // "justify" shoves every dead end to the right edge, which would strand
        // Taxes in the leaf column instead of beside Savings and Expenses.
        align="left"
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
