"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export interface CriticalZoneItem {
  zoneId: string;
  zoneName: string;
  tensionCb: number;
}

interface TopCriticalZonesWidgetProps {
  zones: CriticalZoneItem[];
}

function getBarColor(tensionCb: number): string {
  if (tensionCb >= 60) return "bg-destructive";
  if (tensionCb >= 30) return "bg-amber-500";
  return "bg-primary";
}

function getBarLabel(tensionCb: number): string {
  return `${Math.round(tensionCb)} CB`;
}

export function TopCriticalZonesWidget({ zones }: TopCriticalZonesWidgetProps) {
  return (
    <section className="h-full rounded-xl bg-surface-lowest p-5 ring-1 ring-border/15">
      <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Top Stress Zones
      </h3>
      {zones.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-4 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          All zones under control. No critical stress detected.
        </div>
      ) : (
        <div className="space-y-6">
          {zones.map((zone) => {
            const pct = Math.max(5, Math.min(100, Math.round((zone.tensionCb / 100) * 100)));
            return (
              <div key={zone.zoneId}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold font-headline">{zone.zoneName}</span>
                  <span className={`text-[10px] font-black ${zone.tensionCb >= 60 ? "text-destructive" : zone.tensionCb >= 30 ? "text-amber-600" : "text-primary"}`}>
                    {getBarLabel(zone.tensionCb)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-low">
                  <div
                    className={`h-full rounded-full ${getBarColor(zone.tensionCb)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2">
                  <Button asChild size="sm" className="w-full text-[10px] uppercase tracking-widest">
                    <Link href={`/irrigation?zone=${encodeURIComponent(zone.zoneId)}`}>Start Irrigation</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
