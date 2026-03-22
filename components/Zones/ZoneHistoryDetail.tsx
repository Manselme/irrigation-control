"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSensorHistory } from "@/lib/hooks/useSensorHistory";
import { usePumpActivity } from "@/lib/hooks/usePumpActivity";
import { getDailyWeatherWithEt0, type DailyWeatherWithEt0 } from "@/lib/weather";
import { ZoneHistoryKPIs } from "@/components/Zones/ZoneHistoryKPIs";
import { DynamicHydricChart } from "@/components/Zones/DynamicHydricChart";
import type { DynamicHydricDataPoint } from "@/components/Zones/DynamicHydricChart";
import { ClimateEtpChart } from "@/components/Zones/ClimateEtpChart";
import { downloadZoneHistoryCsv } from "@/lib/zoneHistoryExport";
import type { ZoneHistoryExportRow } from "@/lib/zoneHistoryExport";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, RefreshCw } from "lucide-react";
import type { SensorHistoryPoint } from "@/lib/hooks/useSensorHistory";
import type { Zone, Module } from "@/types";

function getZoneCenter(zone: { polygon?: { coordinates?: number[][][] } }): { lat: number; lng: number } | null {
  const coords = zone.polygon?.coordinates?.[0];
  if (!coords?.length) return null;
  const [lng, lat] = coords[0];
  return { lat, lng };
}

function getSeasonBounds(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const start = `${year}-03-01`;
  const endDate = new Date(year, 9, 31);
  const end = now < endDate ? now.toISOString().slice(0, 10) : `${year}-10-31`;
  return { start, end };
}

function getPeriodBounds(period: string): { start: string; end: string; days: number } {
  const end = new Date();
  const endStr = end.toISOString().slice(0, 10);
  if (period === "7") {
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { start: start.toISOString().slice(0, 10), end: endStr, days: 7 };
  }
  if (period === "30") {
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    return { start: start.toISOString().slice(0, 10), end: endStr, days: 30 };
  }
  const { start, end: e } = getSeasonBounds();
  const startD = new Date(start);
  const endD = new Date(e);
  const days = Math.ceil((endD.getTime() - startD.getTime()) / (24 * 60 * 60 * 1000));
  return { start, end: e, days };
}

function aggregateSensorByDay(
  points: SensorHistoryPoint[],
  startDate: string,
  endDate: string
): Map<
  string,
  { tension_cb: number[]; humidity_10cm: number[]; humidity_30cm: number[]; humidity: number[] }
> {
  const byDay = new Map<
    string,
    { tension_cb: number[]; humidity_10cm: number[]; humidity_30cm: number[]; humidity: number[] }
  >();
  points.forEach((p) => {
    const date = new Date(p.timestamp).toISOString().slice(0, 10);
    if (date < startDate || date > endDate) return;
    if (!byDay.has(date))
      byDay.set(date, {
        tension_cb: [],
        humidity_10cm: [],
        humidity_30cm: [],
        humidity: [],
      });
    const row = byDay.get(date)!;
    if (p.tension_cb != null) row.tension_cb.push(p.tension_cb);
    if (p.humidity_10cm != null) row.humidity_10cm.push(p.humidity_10cm);
    if (p.humidity_30cm != null) row.humidity_30cm.push(p.humidity_30cm);
    if (p.humidity != null) row.humidity.push(p.humidity);
  });
  return byDay;
}

export interface ZoneHistoryDetailProps {
  zone: Zone;
  /** Module pompe de la zone (pour gateways V2) */
  pumpModule?: Module | null;
  /** Afficher le lien Retour vers /history */
  showBackLink?: boolean;
  /** Afficher le titre (nom de la zone) dans le bandeau */
  showZoneTitle?: boolean;
}

export function ZoneHistoryDetail({
  zone,
  pumpModule,
  showBackLink = true,
  showZoneTitle = true,
}: ZoneHistoryDetailProps) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"7" | "30" | "saison">("30");
  const [weatherDaily, setWeatherDaily] = useState<DailyWeatherWithEt0[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const bounds = useMemo(() => getPeriodBounds(period), [period]);
  const center = useMemo(() => getZoneCenter(zone), [zone]);
  const lat = center?.lat ?? 46.6;
  const lng = center?.lng ?? 1.9;

  const firstFieldId = zone.fieldModuleIds?.[0];
  const pumpId = zone.pumpModuleId ?? undefined;

  const sensorPoints = useSensorHistory(user?.uid, firstFieldId ?? undefined, bounds.days);
  const pumpGatewayOpts =
    pumpModule?.gatewayId && pumpModule?.deviceId
      ? { gatewayId: pumpModule.gatewayId, deviceId: pumpModule.deviceId }
      : undefined;
  const [pumpDays, refreshPumpActivity] = usePumpActivity(
    user?.uid,
    pumpId,
    bounds.days,
    pumpGatewayOpts
  );

  useEffect(() => {
    if (!bounds.start || !bounds.end) return;
    setWeatherLoading(true);
    getDailyWeatherWithEt0(lat, lng, bounds.start, bounds.end)
      .then(setWeatherDaily)
      .catch(() => setWeatherDaily([]))
      .finally(() => setWeatherLoading(false));
  }, [lat, lng, bounds.start, bounds.end]);

  const sensorByDay = useMemo(
    () => aggregateSensorByDay(sensorPoints, bounds.start, bounds.end),
    [sensorPoints, bounds.start, bounds.end]
  );

  const combinedData = useMemo(() => {
    const dates = new Set<string>();
    for (let d = new Date(bounds.start); d <= new Date(bounds.end); d.setDate(d.getDate() + 1)) {
      dates.add(d.toISOString().slice(0, 10));
    }
    pumpDays.forEach((d) => dates.add(d.date));
    weatherDaily.forEach((d) => dates.add(d.date));
    const sorted = Array.from(dates).sort();
    return sorted.map((date) => {
      const p = pumpDays.find((d) => d.date === date);
      const w = weatherDaily.find((d) => d.date === date);
      const s = sensorByDay.get(date);
      const hasVolume = p?.volume_m3 != null && p.volume_m3 > 0;
      const irrigationValue = hasVolume ? (p?.volume_m3 ?? 0) : (p?.minutesOn ?? 0);
      const tensionArr = s?.tension_cb ?? [];
      const h10 = s?.humidity_10cm ?? [];
      const h30 = s?.humidity_30cm ?? [];
      const h = s?.humidity ?? [];
      return {
        date,
        pluieMm: w?.precipitationMm ?? 0,
        irrigationValue,
        tension_cb:
          tensionArr.length > 0 ? tensionArr.reduce((a, b) => a + b, 0) / tensionArr.length : null,
        humidity_10cm: h10.length > 0 ? h10.reduce((a, b) => a + b, 0) / h10.length : null,
        humidity_30cm: h30.length > 0 ? h30.reduce((a, b) => a + b, 0) / h30.length : null,
        humidity: h.length > 0 ? h.reduce((a, b) => a + b, 0) / h.length : null,
      };
    });
  }, [pumpDays, weatherDaily, sensorByDay, bounds]);

  const kpis = useMemo(() => {
    let volumeIrrigation = 0;
    let hasVolume = false;
    combinedData.forEach((d) => {
      const p = pumpDays.find((x) => x.date === d.date);
      if (p?.volume_m3 != null && p.volume_m3 > 0) {
        volumeIrrigation += p.volume_m3;
        hasVolume = true;
      } else if (p?.minutesOn != null) {
        volumeIrrigation += p.minutesOn;
      }
    });
    const pluviometrieMm = combinedData.reduce((s, d) => s + d.pluieMm, 0);
    const tensionValues = combinedData.map((d) => d.tension_cb).filter((v): v is number => v != null);
    const tensionMoyenne =
      tensionValues.length > 0
        ? tensionValues.reduce((a, b) => a + b, 0) / tensionValues.length
        : null;
    const etpSum = weatherDaily.reduce((s, d) => s + d.et0Mm, 0);
    const bilanHydrique = pluviometrieMm - etpSum;

    const todayPump = pumpDays.find((p) => p.date === todayStr);
    const defaultUnit = (hasVolume ? "m3" : "min") as "m3" | "min";
    const irrigationAujourdhui = todayPump
      ? {
          value: (todayPump.volume_m3 != null && todayPump.volume_m3 > 0)
            ? todayPump.volume_m3
            : (todayPump.minutesOn ?? 0),
          unit: (todayPump.volume_m3 != null && todayPump.volume_m3 > 0 ? "m3" : "min") as "m3" | "min",
        }
      : { value: 0, unit: defaultUnit };

    return {
      volumeIrrigation,
      irrigationUnit: (hasVolume ? "m3" : "min") as "m3" | "min",
      pluviometrieMm,
      tensionMoyenne,
      tensionTrend: null as "up" | "down" | null,
      bilanHydrique,
      irrigationAujourdhui,
    };
  }, [combinedData, pumpDays, weatherDaily]);

  const exportRows: ZoneHistoryExportRow[] = useMemo(
    () =>
      combinedData.map((d) => {
        const p = pumpDays.find((x) => x.date === d.date);
        return {
          date: d.date,
          zoneName: zone.name ?? "",
          pluviometrie_mm: d.pluieMm,
          irrigation_m3: p?.volume_m3 ?? 0,
          tension_sol_cb: d.tension_cb,
          humidite_10cm_pct: d.humidity_10cm,
          humidite_30cm_pct: d.humidity_30cm,
        };
      }),
    [combinedData, pumpDays, zone.name]
  );

  const handleExport = () => {
    downloadZoneHistoryCsv(exportRows, zone.name ?? "Zone", bounds.start, bounds.end);
  };

  const hydricData: DynamicHydricDataPoint[] = combinedData.map((d) => ({
    date: d.date,
    pluieMm: d.pluieMm,
    irrigationValue: d.irrigationValue,
    tension_cb: d.tension_cb,
    humidity_10cm: d.humidity_10cm,
    humidity_30cm: d.humidity_30cm,
    humidity: d.humidity,
  }));

  if (!user) return null;

  return (
    <div className="space-y-6 bg-slate-50/50 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBackLink && (
            <Button variant="ghost" size="icon" asChild>
              <Link href="/history">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {showZoneTitle && (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{zone.name}</h1>
              <p className="text-sm text-muted-foreground">Historique &amp; analytique</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "7" | "30" | "saison")}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="saison">Saison en cours</option>
          </select>
          <Button variant="outline" size="default" onClick={() => refreshPumpActivity()} className="gap-2" title="Récupérer les dernières données (irrigation, capteurs)">
            <RefreshCw className="h-4 w-4" />
            Rafraîchir
          </Button>
          <Button variant="outline" size="default" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exporter (CSV)
          </Button>
        </div>
      </div>

      <ZoneHistoryKPIs
        volumeIrrigation={kpis.volumeIrrigation}
        irrigationUnit={kpis.irrigationUnit}
        pluviometrieMm={kpis.pluviometrieMm}
        tensionMoyenne={kpis.tensionMoyenne}
        tensionTrend={kpis.tensionTrend}
        bilanHydrique={kpis.bilanHydrique}
        irrigationAujourdhui={kpis.irrigationAujourdhui}
      />

      <Card className="border-border">
        <CardContent className="pt-6">
          <DynamicHydricChart
            data={hydricData}
            irrigationUnit={kpis.irrigationUnit}
            todayDate={todayStr}
          />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="pt-6">
          {weatherLoading ? (
            <p className="text-sm text-muted-foreground">Chargement climat…</p>
          ) : (
            <ClimateEtpChart data={weatherDaily} todayDate={todayStr} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
