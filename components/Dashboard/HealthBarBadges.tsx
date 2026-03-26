"use client";

import { Radio, AlertTriangle, Droplets } from "lucide-react";

interface HealthBarBadgesProps {
  networkIncidents: number;
  dryZonesCount: number;
  weeklyVolumeM3: number;
}

export function HealthBarBadges({
  networkIncidents,
  dryZonesCount,
  weeklyVolumeM3,
}: HealthBarBadgesProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <div className="flex items-center gap-3 rounded bg-surface-lowest px-4 py-2 ring-1 ring-border/15">
        <Radio className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Network</p>
          <p className="text-sm font-headline font-bold">
            {networkIncidents === 0 ? "All Online" : `${networkIncidents} Offline`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded bg-surface-lowest px-4 py-2 ring-1 ring-border/15">
        <AlertTriangle className={`h-4 w-4 ${dryZonesCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${dryZonesCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            Stress
          </p>
          <p className={`text-sm font-headline font-bold ${dryZonesCount > 0 ? "text-destructive" : ""}`}>
            {dryZonesCount === 0 ? "Optimal" : `${dryZonesCount} Critical`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded bg-surface-lowest px-4 py-2 ring-1 ring-border/15">
        <Droplets className="h-4 w-4 text-primary" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Volume</p>
          <p className="text-sm font-headline font-bold">
            {weeklyVolumeM3.toFixed(1)} m³
          </p>
        </div>
      </div>
    </div>
  );
}
