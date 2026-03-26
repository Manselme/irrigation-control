"use client";

import { Droplets, CloudRain, Thermometer, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ZoneHistoryKPIsProps {
  volumeIrrigation: number;
  irrigationUnit: "m3" | "min";
  pluviometrieMm: number;
  tensionMoyenne: number | null;
  tensionTrend?: "up" | "down" | null;
  bilanHydrique: number | null;
  irrigationAujourdhui?: { value: number; unit: "m3" | "min" } | null;
}

export function ZoneHistoryKPIs({
  volumeIrrigation,
  irrigationUnit,
  pluviometrieMm,
  tensionMoyenne,
  tensionTrend,
  bilanHydrique,
  irrigationAujourdhui,
}: ZoneHistoryKPIsProps) {
  const fmtVol = (v: number, unit: "m3" | "min" = irrigationUnit) =>
    unit === "m3" ? v.toFixed(1) : String(Math.round(v));
  const unitLabel = (unit: "m3" | "min" = irrigationUnit) =>
    unit === "m3" ? "m³" : "min";

  const todayVal = irrigationAujourdhui
    ? fmtVol(irrigationAujourdhui.value, irrigationAujourdhui.unit)
    : null;
  const todayUnit = irrigationAujourdhui
    ? unitLabel(irrigationAujourdhui.unit)
    : null;

  const tensionColor =
    tensionMoyenne != null && tensionMoyenne >= 40
      ? "text-destructive"
      : tensionMoyenne != null && tensionMoyenne >= 25
        ? "text-amber-600"
        : "text-primary";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Card 1 — Cumulative Irrigation (green gradient) */}
      <div className="p-5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex flex-col justify-between min-h-[140px]">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-80">
            {irrigationAujourdhui ? "Irrigation Today" : "Cumulative Irrigation"}
          </span>
          <Droplets className="h-5 w-5 opacity-80" />
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-headline">
              {irrigationAujourdhui ? todayVal : fmtVol(volumeIrrigation)}
            </span>
            <span className="text-sm font-medium opacity-80">
              {irrigationAujourdhui ? todayUnit : unitLabel()}
            </span>
          </div>
          {irrigationAujourdhui && volumeIrrigation > 0 && (
            <p className="text-[10px] mt-1 font-medium bg-white/10 w-fit px-2 py-0.5 rounded">
              Period: {fmtVol(volumeIrrigation)} {unitLabel()}
            </p>
          )}
        </div>
      </div>

      {/* Card 2 — Total Rain */}
      <div className="p-5 rounded-xl bg-surface-lowest ring-1 ring-border/10 flex flex-col justify-between min-h-[140px]">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Total Rain</span>
          <CloudRain className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-headline">{pluviometrieMm.toFixed(1)}</span>
            <span className="text-sm font-medium text-muted-foreground">mm</span>
          </div>
        </div>
      </div>

      {/* Card 3 — Current Tension */}
      <div className="p-5 rounded-xl bg-surface-lowest ring-1 ring-border/10 flex flex-col justify-between min-h-[140px]">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Avg. Tension</span>
          <Thermometer className={cn("h-5 w-5", tensionColor)} />
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-headline">
              {tensionMoyenne != null ? tensionMoyenne.toFixed(0) : "—"}
            </span>
            <span className="text-sm font-medium text-muted-foreground">cb</span>
          </div>
          {tensionMoyenne != null && (
            <p className={cn("text-[10px] mt-1 font-medium flex items-center gap-1", tensionColor)}>
              {tensionTrend === "up" && "↑ "}
              {tensionTrend === "down" && "↓ "}
              {tensionMoyenne >= 40
                ? "Stress Threshold"
                : tensionMoyenne >= 25
                  ? "Mild Stress"
                  : "Optimal Range"}
            </p>
          )}
        </div>
      </div>

      {/* Card 4 — Water Balance */}
      <div className="p-5 rounded-xl bg-surface-lowest ring-1 ring-border/10 flex flex-col justify-between min-h-[140px]">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Water Balance</span>
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-headline">
              {bilanHydrique != null ? bilanHydrique.toFixed(1) : "—"}
            </span>
            <span className="text-sm font-medium text-muted-foreground">mm</span>
          </div>
          {bilanHydrique != null && (
            <p className="text-[10px] mt-1 font-medium text-muted-foreground italic">
              {bilanHydrique < 0 ? "Deficit state active" : "Surplus"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
