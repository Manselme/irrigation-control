"use client";

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

export interface DynamicHydricDataPoint {
  date: string;
  pluieMm: number;
  /** Valeur affichée en barre (mm, m³ ou minutes selon irrigationUnit) */
  irrigationValue: number;
  tension_cb: number | null;
  humidity_10cm: number | null;
  humidity_30cm: number | null;
  /** Humidité sol unique (si pas de 10cm/30cm) */
  humidity?: number | null;
}

const SERIES_DESCRIPTIONS: Record<string, string> = {
  pluieMm: "Précipitations naturelles (mm). Source : météo.",
  irrigationBar: "Eau apportée par la pompe (mm, m³ ou min selon capteur).",
  tension_cb: "Stress hydrique du sol en centibars. Zone 10–30 cb = confort de la plante.",
  humidity_10cm: "Humidité du sol à -10 cm (%). Superficielle.",
  humidity_30cm: "Humidité du sol à -30 cm (%). Profonde.",
  humiditySol: "Humidité du sol (%).",
};

interface DynamicHydricChartProps {
  data: DynamicHydricDataPoint[];
  /** Unité de la barre irrigation : "mm" | "m3" | "min" */
  irrigationUnit?: "mm" | "m3" | "min";
  /** Date du jour (YYYY-MM-DD) pour afficher "Du jour" dans le tooltip et la ligne de référence */
  todayDate?: string;
}

export function DynamicHydricChart({
  data,
  irrigationUnit = "mm",
  todayDate,
}: DynamicHydricChartProps) {
  const irrigationLabel =
    irrigationUnit === "m3" ? "Irrigation (m³)" : irrigationUnit === "min" ? "Irrigation (min)" : "Irrigation (mm)";
  const chartData = data.map((d) => ({
    ...d,
    irrigationBar: d.irrigationValue,
    humiditySol: d.humidity_30cm ?? d.humidity_10cm ?? d.humidity ?? null,
  }));

  const getLocalYYYYMMDD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = todayDate ?? getLocalYYYYMMDD(new Date());
  const showTodayLine = data.some((d) => d.date === todayStr);

  const renderTooltip = (props: { active?: boolean; label?: string; payload?: { name: string; value: number | null }[] }) => {
    const { active, label, payload = [] } = props;
    if (!active || !label || !payload.length) return null;
    const isToday = label === todayStr;
    return (
      <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
        <div className="mb-1.5 font-medium">
          {new Date(label).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          <span className={`ml-2 text-xs font-normal ${isToday ? "text-primary" : "text-muted-foreground"}`}>
            {isToday ? "— Donnée du jour" : "— Historique"}
          </span>
        </div>
        <ul className="space-y-1">
          {payload.map((entry) => {
            const desc = SERIES_DESCRIPTIONS[entry.name === "irrigationBar" ? "irrigationBar" : entry.name];
            const labelName =
              entry.name === "irrigationBar"
                ? irrigationLabel
                : entry.name === "tension_cb"
                  ? "Tension (cb)"
                  : entry.name === "pluieMm"
                    ? "Pluie (mm)"
                    : entry.name === "humidity_10cm"
                      ? "Humidité -10 cm"
                      : entry.name === "humidity_30cm"
                        ? "Humidité -30 cm"
                        : entry.name;
            const value =
              entry.value == null ? "—" : entry.name.includes("humidity") ? `${entry.value} %` : entry.value;
            return (
              <li key={entry.name} className="flex justify-between gap-4">
                <span title={desc}>{labelName}: {value}</span>
              </li>
            );
          })}
        </ul>
        {payload.some((p) => p.name === "tension_cb" || p.name?.startsWith("humidity")) && (
          <p className="mt-1.5 text-xs text-muted-foreground border-t pt-1.5">
            Bande verte : zone de confort (10–30 cb).
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      <p className="text-sm font-medium text-muted-foreground mb-2">
        Dynamique hydrique du sol
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={chartData}
          margin={{ top: 26, right: 50, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
            }
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fontSize: 11 }}
            domain={[0, "auto"]}
            allowDataOverflow
            label={{ value: "Apports (mm)", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[100, 0]}
            tick={{ fontSize: 11 }}
            label={{
              value: "Tension (cb) / Humidité (%)",
              angle: 90,
              position: "insideRight",
              fontSize: 11,
            }}
          />
          <Tooltip content={renderTooltip as never} />
          <Legend />
          <ReferenceArea
            yAxisId="right"
            y1={30}
            y2={10}
            fill="rgb(34 197 94 / 0.12)"
            strokeOpacity={0}
          />
          {showTodayLine && (
            <ReferenceLine
              yAxisId="left"
              x={todayStr}
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              label={{ value: "Aujourd'hui", position: "insideTop", dy: -10, fontSize: 10 }}
            />
          )}
          <Bar yAxisId="left" dataKey="pluieMm" name="Pluie (mm)" stackId="water" fill="rgb(147 197 253)" radius={[0, 0, 0, 0]} />
          <Bar
            yAxisId="left"
            dataKey="irrigationBar"
            name={irrigationLabel}
            stackId="water"
            fill="rgb(30 64 175)"
            radius={[2, 2, 0, 0]}
          />
          {data.some((d) => d.tension_cb != null) && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="tension_cb"
              name="Tension (cb)"
              stroke="rgb(185 28 28)"
              strokeWidth={2.5}
              dot={false}
              connectNulls
            />
          )}
          {data.some((d) => d.humidity_10cm != null) && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="humidity_10cm"
              name="Humidité -10 cm"
              stroke="rgb(59 130 246)"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              connectNulls
            />
          )}
          {data.some((d) => d.humidity_30cm != null) && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="humidity_30cm"
              name="Humidité -30 cm"
              stroke="rgb(30 64 175)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
          {!data.some((d) => d.humidity_10cm != null) && !data.some((d) => d.humidity_30cm != null) && data.some((d) => (d.humidity ?? d.humidity_30cm ?? d.humidity_10cm) != null) && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="humiditySol"
              name="Humidité sol"
              stroke="rgb(30 64 175)"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
