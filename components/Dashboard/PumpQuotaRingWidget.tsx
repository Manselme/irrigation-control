"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PumpQuotaRingWidgetProps {
  weeklyVolumeM3: number;
  quotaM3: number;
  livePumpOnCount: number;
}

function getRatio(weeklyVolumeM3: number, quotaM3: number): number {
  if (quotaM3 <= 0) return 0;
  return Math.max(0, weeklyVolumeM3 / quotaM3);
}

function getRingColor(ratio: number): string {
  if (ratio >= 0.9) return "stroke-red-500";
  if (ratio >= 0.7) return "stroke-orange-500";
  return "stroke-sky-500";
}

export function PumpQuotaRingWidget({
  weeklyVolumeM3,
  quotaM3,
  livePumpOnCount,
}: PumpQuotaRingWidgetProps) {
  const ratio = getRatio(weeklyVolumeM3, quotaM3);
  const percent = Math.min(100, Math.round(ratio * 100));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(circumference, (percent / 100) * circumference);
  const ringColor = getRingColor(ratio);
  const isAlert = ratio >= 0.9;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Activité pompage & quota</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={radius} className="stroke-slate-200" strokeWidth="10" fill="none" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              className={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${progress} ${circumference}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <p className="text-xl font-semibold">{percent}%</p>
              <p className="text-[11px] text-muted-foreground">du quota</p>
            </div>
          </div>
        </div>
        <div className="w-full space-y-1 text-sm">
          <p>
            <span className="font-medium">{weeklyVolumeM3.toFixed(1)} m³</span> / {quotaM3.toFixed(0)} m³ cette semaine
          </p>
          <p>Pompes actives: <span className="font-medium">{livePumpOnCount}</span></p>
          {isAlert ? (
            <p className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-red-700">
              Alerte: quota hebdomadaire atteint a 90%+
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

