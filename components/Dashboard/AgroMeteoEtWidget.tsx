"use client";

import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgroMeteoSnapshot, type AgroMeteoSnapshot } from "@/lib/weather";
import { Sun } from "lucide-react";

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
        if (mounted) setError("Weather data unavailable.");
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
    () => (data?.hourly24h ?? []).filter((_, i) => i % 3 === 0).slice(0, 4),
    [data]
  );

  if (loading) {
    return (
      <section className="rounded-xl bg-primary p-5 text-white">
        <Skeleton className="h-14 w-full bg-white/20" />
        <Skeleton className="mt-3 h-20 w-full bg-white/20" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-xl bg-primary p-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Local Weather &amp; ET</p>
        <p className="mt-2 text-xs opacity-70">{error ?? "No data available."}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col justify-between rounded-xl bg-primary p-5 text-white">
      <div>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Local Weather &amp; ET</p>
            <h3 className="font-headline text-xl font-bold">
              {`${lat.toFixed(1)}°, ${lng.toFixed(1)}°`}
            </h3>
          </div>
          <Sun className="h-8 w-8 opacity-80" />
        </div>
        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
          <div>
            <p className="text-[9px] font-bold uppercase opacity-70">ET (Daily)</p>
            <p className="font-headline text-lg font-black">{data.etTodayMm.toFixed(1)} mm/d</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase opacity-70">Rain 24h</p>
            <p className="font-headline text-lg font-black">{data.rain24hMm.toFixed(1)} mm</p>
          </div>
          {timeline.slice(0, 2).map((point) => (
            <div key={point.time}>
              <p className="text-[9px] font-bold uppercase opacity-70">{hourLabel(point.time)}</p>
              <p className="font-headline text-sm font-bold">{Math.round(point.tempC)}°C &middot; {Math.round(point.windKmh)} km/h</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
