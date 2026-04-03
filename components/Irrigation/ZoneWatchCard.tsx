"use client";

import { useMemo } from "react";
import type { Zone } from "@/types";
import { Button } from "@/components/ui/button";
import { useSensorHistory } from "@/lib/hooks/useSensorHistory";
import { formatModulePumpPressure } from "@/lib/pumpPressure";
import type { Module } from "@/types";

type ZoneStatus = "irrigating" | "idle" | "alert";

interface ZoneWatchCardProps {
  userId: string | undefined;
  zone: Zone;
  status: ZoneStatus;
  thirstScore: number;
  tensionCb?: number;
  humidity?: number;
  onSelect: () => void;
  onStartStop: () => void;
  isPumpRunning: boolean;
  hasPump: boolean;
  /** Module pompe associé (pression affichée si présent). */
  pumpModule?: Module | null;
}

function statusLabel(status: ZoneStatus): string {
  if (status === "irrigating") return "En cours";
  if (status === "alert") return "Alerte";
  return "A l'arret";
}

function statusClass(status: ZoneStatus): string {
  if (status === "irrigating") return "text-indigo-700 bg-indigo-50 border-indigo-200";
  if (status === "alert") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

function thirstLabel(score: number): string {
  if (score >= 70) return "Soif elevee";
  if (score >= 40) return "Vigilance";
  return "Confort";
}

function thirstClass(score: number): string {
  if (score >= 70) return "bg-red-500";
  if (score >= 40) return "bg-orange-400";
  return "bg-emerald-500";
}

export function ZoneWatchCard({
  userId,
  zone,
  status,
  thirstScore,
  tensionCb,
  humidity,
  onSelect,
  onStartStop,
  isPumpRunning,
  hasPump,
  pumpModule,
}: ZoneWatchCardProps) {
  const firstFieldModuleId = zone.fieldModuleIds?.[0];
  const points = useSensorHistory(userId, firstFieldModuleId, 1);
  const sparkPoints = useMemo(() => {
    if (!points.length) return "";
    const samples = points
      .filter((p) => typeof p.humidity === "number")
      .slice(-20)
      .map((p) => p.humidity as number);
    if (samples.length < 2) return "";
    const max = Math.max(...samples, 100);
    const min = Math.min(...samples, 0);
    const spread = Math.max(1, max - min);
    return samples
      .map((v, idx) => {
        const x = (idx / (samples.length - 1)) * 100;
        const y = 28 - ((v - min) / spread) * 24;
        return `${x},${y}`;
      })
      .join(" ");
  }, [points]);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{zone.name}</h3>
          <div
            className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusClass(status)}`}
          >
            {statusLabel(status)}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onSelect}>
          Details
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{thirstLabel(thirstScore)}</span>
          <span>{Math.round(thirstScore)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full ${thirstClass(thirstScore)}`}
            style={{ width: `${Math.max(6, Math.min(100, thirstScore))}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <p>Tension: {tensionCb != null ? `${Math.round(tensionCb)} cb` : "--"}</p>
          <p>Humidite: {humidity != null ? `${Math.round(humidity)}%` : "--"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-medium text-slate-600">Pompe</p>
        {pumpModule ? (
          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
            <p>Pression : {formatModulePumpPressure(pumpModule)}</p>
            {pumpModule.moisturePct != null && Number.isFinite(pumpModule.moisturePct) ? (
              <p>
                Humidite sol : {Math.round(pumpModule.moisturePct)}%
                {pumpModule.moistureMv != null && Number.isFinite(pumpModule.moistureMv)
                  ? ` (${Math.round(pumpModule.moistureMv)} mV)`
                  : ""}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <Button
            size="sm"
            onClick={onStartStop}
            disabled={!hasPump}
            variant={isPumpRunning ? "destructive" : "default"}
          >
            {isPumpRunning ? "STOP" : "START"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {hasPump ? (isPumpRunning ? "En marche" : "A l'arret") : "Aucune pompe"}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 p-2">
        <p className="mb-2 text-xs text-muted-foreground">Tendance humidite 24h</p>
        {sparkPoints ? (
          <svg viewBox="0 0 100 30" className="h-10 w-full">
            <polyline
              points={sparkPoints}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <p className="text-xs text-muted-foreground">Donnees insuffisantes sur 24h.</p>
        )}
      </div>
    </article>
  );
}

