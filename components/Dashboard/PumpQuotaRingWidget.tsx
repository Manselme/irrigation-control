"use client";

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
  if (ratio >= 0.9) return "stroke-destructive";
  if (ratio >= 0.7) return "stroke-amber-500";
  return "stroke-primary";
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

  return (
    <section className="rounded-xl bg-surface-lowest p-5 ring-1 ring-border/15">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Pump Activity &amp; Quota
      </h3>
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={radius} className="stroke-surface-low" strokeWidth="10" fill="none" />
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
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-headline font-black">{percent}%</span>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weekly Volume</p>
          <p className="font-headline font-bold text-sm">{weeklyVolumeM3.toFixed(1)} / {quotaM3.toFixed(0)} m³</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">Live Pumps</p>
          <p className="font-headline font-bold text-sm">{livePumpOnCount} active</p>
          {ratio >= 0.9 && (
            <p className="mt-1 text-[10px] font-bold text-destructive uppercase">Quota &gt;90%</p>
          )}
        </div>
      </div>
    </section>
  );
}
