"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface CriticalZoneItem {
  zoneId: string;
  zoneName: string;
  tensionCb: number;
}

interface TopCriticalZonesWidgetProps {
  zones: CriticalZoneItem[];
}

function getProgress(tensionCb: number): number {
  return Math.max(0, Math.min(100, Math.round((tensionCb / 200) * 100)));
}

function getProgressColor(progress: number): string {
  if (progress >= 75) return "bg-red-500";
  if (progress >= 45) return "bg-orange-500";
  return "bg-emerald-500";
}

export function TopCriticalZonesWidget({ zones }: TopCriticalZonesWidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Top 3 zones critiques</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {zones.length === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Tout est sous contrôle. Aucune zone critique détectée.
          </div>
        ) : (
          zones.map((zone, idx) => {
            const progress = getProgress(zone.tensionCb);
            return (
              <div key={zone.zoneId} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <p className="font-medium">
                    {idx + 1}. {zone.zoneName}
                  </p>
                  <p className="text-muted-foreground">{Math.round(zone.tensionCb)} cb</p>
                </div>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${getProgressColor(progress)}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <Button asChild size="sm" className="w-full">
                  <Link href={`/irrigation?zone=${encodeURIComponent(zone.zoneId)}`}>Irriguer</Link>
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

