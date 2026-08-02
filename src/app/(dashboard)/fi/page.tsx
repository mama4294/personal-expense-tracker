"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/table";
import {
  SERIES_COLORS,
  SimpleLineChart,
  StatCard,
} from "@/components/charts/dashboard-charts";
import { PersonToggle } from "@/components/filters/person-toggle";
import { personColor } from "@/lib/colors";
import { formatCurrency, formatMonthLabel, formatPercent } from "@/lib/utils";

type FiData = {
  annualSpending: number;
  fiNumber: number;
  currentInvestments: number;
  monthlyWithdrawal: number;
  annualWithdrawal: number;
  remaining: number;
  progressPercent: number;
  withdrawalRate: number;
  history: {
    month: string;
    investments: number;
    annualSpending: number;
    fiNumber: number;
    progress: number;
  }[];
  jointInvestments: number;
};

type Person = { id: string; name: string; isActive: boolean; color: string };

export default function FiPage() {
  const [data, setData] = useState<FiData | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState("COMBINED");

  const activePeople = people.filter((entry) => entry.isActive);
  const activeColor = personColor(
    activePeople.find((entry) => entry.id === person)?.color,
  );

  const load = useCallback(async () => {
    const [fiResponse, peopleResponse] = await Promise.all([
      fetch(`/api/dashboard/fi?person=${person}`),
      fetch("/api/people"),
    ]);
    if (!fiResponse.ok || !peopleResponse.ok) return;
    setData(await fiResponse.json());
    setPeople(await peopleResponse.json());
  }, [person]);

  useEffect(() => {
    async function run() {
      await load();
    }
    run();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Financial Independence</h2>
          <p className="text-sm text-muted-foreground">
            FI number, investment progress, and 4% withdrawal projections.
          </p>
        </div>
        <PersonToggle people={activePeople} value={person} onChange={setPerson} />
      </div>

      {person !== "COMBINED" ? (
        <p className="text-sm text-muted-foreground">
          {activePeople.find((entry) => entry.id === person)?.name}&apos;s share of
          spending, against the investments they hold.
          {(data?.jointInvestments ?? 0) > 0
            ? ` A further ${formatCurrency(data?.jointInvestments ?? 0)} of investments is held jointly and counts only under Combined.`
            : ""}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Annual Spending"
          value={formatCurrency(data?.annualSpending ?? 0)}
          hint="Trailing 12 months"
        />
        <StatCard label="FI Number" value={formatCurrency(data?.fiNumber ?? 0)} />
        <StatCard
          label="Current Investments"
          value={formatCurrency(data?.currentInvestments ?? 0)}
        />
        <StatCard
          label="Remaining"
          value={formatCurrency(data?.remaining ?? 0)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>FI Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>{formatPercent(data?.progressPercent ?? 0)} complete</span>
            <span>{formatPercent(data?.withdrawalRate ?? 0.04)} withdrawal rate</span>
          </div>
          <Progress value={(data?.progressPercent ?? 0) * 100} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Monthly Withdrawal Income"
          value={formatCurrency(data?.monthlyWithdrawal ?? 0)}
          hint="Current investments × withdrawal rate ÷ 12"
        />
        <StatCard
          label="Annual Withdrawal Income"
          value={formatCurrency(data?.annualWithdrawal ?? 0)}
          hint={`Compared to ${formatCurrency(data?.annualSpending ?? 0)} annual spending`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Historical FI Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              data={(data?.history ?? []).map((item) => ({
                month: item.month,
                progress: Number((item.progress * 100).toFixed(1)),
              }))}
              xKey="month"
              lines={[
                { key: "progress", color: activeColor, name: "Progress %" },
              ]}
              valueFormat="percent"
              xTickFormatter={formatMonthLabel}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Investments vs FI Number</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart
              data={data?.history ?? []}
              xKey="month"
              lines={[
                { key: "investments", color: activeColor, name: "Investments" },
                { key: "fiNumber", color: SERIES_COLORS[1], name: "FI Number" },
              ]}
              xTickFormatter={formatMonthLabel}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
