"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { SensorHistoryPoint } from "@/lib/hooks/useSensorHistory";
import type { PumpActivityDay } from "@/lib/hooks/usePumpActivity";
import type { ForecastDay } from "@/lib/weather";

interface HistoryChartsProps {
  humidityPoints: SensorHistoryPoint[];
  pumpDays: PumpActivityDay[];
  rainDays: { date: string; precipitationMm: number }[];
  zoneName: string;
  periodDays?: number;
}

function aggregateHumidityByDay(
  points: SensorHistoryPoint[]
): { date: string; humidity: number }[] {
  const byDay: Record<string, number[]> = {};
  points.forEach((p) => {
    const date = new Date(p.timestamp).toISOString().slice(0, 10);
    if (p.humidity == null) return;
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(p.humidity);
  });
  return Object.entries(byDay).map(([date, arr]) => ({
    date,
    humidity: Math.round(
      arr.reduce((a, b) => a + b, 0) / arr.length
    ),
  }));
}

export function HistoryCharts({
  humidityPoints,
  pumpDays,
  rainDays,
  zoneName,
  periodDays = 30,
}: HistoryChartsProps) {
  const humidityByDay = aggregateHumidityByDay(humidityPoints);
  const allDates = new Set<string>([
    ...humidityByDay.map((d) => d.date),
    ...pumpDays.map((d) => d.date),
    ...rainDays.map((d) => d.date),
  ]);
  const sortedDates = Array.from(allDates).sort();
  const combined = sortedDates.map((date) => {
    const h = humidityByDay.find((d) => d.date === date);
    const p = pumpDays.find((d) => d.date === date);
    const r = rainDays.find((d) => d.date === date);
    return {
      date,
      humidity: h?.humidity ?? null,
      minutesPump: p?.minutesOn ?? 0,
      pluieMm: r?.precipitationMm ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={combined} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
          />
          <YAxis
            yAxisId="humidity"
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: "Humidité %", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleDateString("fr-FR")}
            formatter={(value: number, name) => [
              name === "humidity" ? `${value} %` : value,
              name === "humidity" ? "Humidité sol" : name === "pluieMm" ? "Pluie (mm)" : "Pompe (min)",
            ]}
          />
          <Legend />
          {humidityByDay.length > 0 && (
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              name="Humidité sol"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={combined} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
          />
          <YAxis tick={{ fontSize: 12 }} domain={[0, "auto"]} allowDataOverflow />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleDateString("fr-FR")}
          />
          <Legend />
          <Bar dataKey="minutesPump" name="Pompe (min)" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
          <Bar dataKey="pluieMm" name="Pluie (mm)" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
