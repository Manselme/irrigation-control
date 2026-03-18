"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgroMeteoSnapshot, type AgroMeteoSnapshot } from "@/lib/weather";

interface AgroMeteoEtWidgetProps {
  lat: number;
  lng: number;
}

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function hourLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function AgroMeteoEtWidget({ lat, lng }: AgroMeteoEtWidgetProps) {
  const [data, setData] = useState<AgroMeteoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setError(null);
        const next = await getAgroMeteoSnapshot(lat, lng);
        if (mounted) setData(next);
      } catch {
        if (mounted) setError("Météo indisponible pour le moment.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [lat, lng]);

  const timeline = useMemo(
    () => (data?.hourly24h ?? []).filter((_, i) => i % 3 === 0).slice(0, 8),
    [data]
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Météo agronomique & ET</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Pas de données météo disponibles.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border bg-slate-50 p-2">
                <p className="text-muted-foreground">ET estimée (jour)</p>
                <p className="text-lg font-semibold">{data.etTodayMm.toFixed(1)} mm</p>
              </div>
              <div className="rounded-md border bg-slate-50 p-2">
                <p className="text-muted-foreground">Pluie cumulée 24h</p>
                <p className="text-lg font-semibold">{data.rain24hMm.toFixed(1)} mm</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Timeline 24h</p>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune prévision horaire.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {timeline.map((point) => (
                    <div key={point.time} className="rounded-md border p-2">
                      <p className="font-medium">{hourLabel(point.time)}</p>
                      <p>{Math.round(point.tempC)}°C</p>
                      <p>Vent {Math.round(point.windKmh)} km/h</p>
                      <p>Pluie {Math.round(point.rainProbPct)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

