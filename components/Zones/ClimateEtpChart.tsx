"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

export interface ClimateEtpDataPoint {
  date: string;
  /** Pluie quotidienne (mm) issue de l'archive météo. Utilisée pour les KPIs / graphique principal. */
  precipitationMm: number;
  et0Mm: number;
  tempMaxC: number;
  tempMinC: number;
  soilTempC?: number | null;
}

const SERIES_DESCRIPTIONS: Record<string, string> = {
  et0Mm: "Évapotranspiration potentielle (mm). Besoin en eau de référence de la culture.",
  tempMaxC: "Température maximale de l'air (°C). Météo.",
  tempMinC: "Température minimale de l'air (°C). Météo.",
  soilTempC: "Température du sol (°C). Utile pour gel et conditions de semis.",
};

interface ClimateEtpChartProps {
  data: ClimateEtpDataPoint[];
  /** Date du jour (YYYY-MM-DD) pour afficher "Du jour" dans le tooltip */
  todayDate?: string;
}

export function ClimateEtpChart({ data, todayDate }: ClimateEtpChartProps) {
  const hasSoilTemp = data.some((d) => d.soilTempC != null);
  const getLocalYYYYMMDD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = todayDate ?? getLocalYYYYMMDD(new Date());
  const showTodayLine = data.some((d) => d.date === todayStr);

  const renderTooltip = (props: {
    active?: boolean;
    label?: string;
    payload?: { name: string; value: number }[];
  }) => {
    const { active, label, payload = [] } = props;
    if (!active || !label || !payload.length) return null;
    const isToday = label === todayStr;
    const labels: Record<string, string> = {
      et0Mm: "ETp (mm)",
      tempMaxC: "T° air max",
      tempMinC: "T° air min",
      soilTempC: "T° sol",
    };
    return (
      <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
        <div className="mb-1.5 font-medium">
          {new Date(label).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          <span className={`ml-2 text-xs font-normal ${isToday ? "text-primary" : "text-muted-foreground"}`}>
            {isToday ? "— Donnée du jour" : "— Historique"}
          </span>
        </div>
        <ul className="space-y-1">
          {payload.map((entry) => (
            <li key={entry.name} className="flex justify-between gap-4" title={SERIES_DESCRIPTIONS[entry.name]}>
              <span>
                {labels[entry.name] ?? entry.name}:{" "}
                {entry.name === "et0Mm" ? entry.value.toFixed(1) : entry.value} {entry.name.startsWith("temp") || entry.name === "soilTempC" ? "°C" : "mm"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="w-full">
      <p className="text-sm font-medium text-muted-foreground mb-2">
        Climat et évapotranspiration
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 26, right: 16, left: 8, bottom: 8 }}>
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
            tick={{ fontSize: 11 }}
            label={{ value: "ETp (mm)", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            label={{ value: "°C", angle: 90, position: "insideRight", fontSize: 11 }}
          />
          <Tooltip content={renderTooltip as never} />
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
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="et0Mm"
            name="ETp (mm)"
            stroke="rgb(107 114 128)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="tempMaxC"
            name="T° air max"
            stroke="rgb(234 88 12)"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="tempMinC"
            name="T° air min"
            stroke="rgb(59 130 246)"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          {hasSoilTemp && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="soilTempC"
              name="T° sol"
              stroke="rgb(34 197 94)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
