"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useTotalPumpActivity } from "@/lib/hooks/useTotalPumpActivity";

interface ConsumptionWidgetProps {
  userId: string | undefined;
  pumpModuleIds: string[];
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short" });
}

export function ConsumptionWidget({ userId, pumpModuleIds }: ConsumptionWidgetProps) {
  const { byDay, totalMinutes } = useTotalPumpActivity(userId, pumpModuleIds, 7);
  const totalHours = totalMinutes / 60;
  const chartData = byDay.map((d) => ({
    date: d.date,
    label: formatDayLabel(d.date),
    minutes: d.minutesOn,
  }));

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          Consommation & Historique rapide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium">
          {totalHours > 0
            ? `${totalHours.toFixed(1)} h de pompage cette semaine`
            : "Aucun temps de pompage cette semaine"}
        </p>
        {chartData.length > 0 ? (
          <div className="h-[120px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value: number) => [`${Math.round(value)} min`, "Pompage"]}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]?.payload) return null;
                    const p = payload[0].payload as { date: string; minutes: number };
                    return (
                      <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow">
                        <p>{new Date(p.date + "T12:00:00").toLocaleDateString("fr-FR")}</p>
                        <p>{Math.round(p.minutes)} min</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
