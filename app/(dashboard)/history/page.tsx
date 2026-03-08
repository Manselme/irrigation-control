"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useZones } from "@/lib/hooks/useZones";
import { useSensorHistory } from "@/lib/hooks/useSensorHistory";
import { usePumpActivity } from "@/lib/hooks/usePumpActivity";
import { getForecast } from "@/lib/weather";
import { HistoryCharts } from "@/components/History/HistoryCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HistoryPage() {
  const { user } = useAuth();
  const { farms } = useFarms(user?.uid);
  const { modules } = useModules(user?.uid);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const { zones } = useZones(user?.uid, selectedFarmId);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const [periodDays, setPeriodDays] = useState<number>(30);
  const selectedZone = selectedZoneId
    ? zones.find((z) => z.id === selectedZoneId)
    : zones[0];
  const pumpModuleId = selectedZone?.pumpModuleId ?? null;
  const firstFieldModuleId = selectedZone?.fieldModuleIds?.[0];

  const humidityPoints = useSensorHistory(
    user?.uid,
    firstFieldModuleId ?? undefined,
    periodDays
  );
  const pumpDays = usePumpActivity(user?.uid, pumpModuleId ?? undefined, periodDays);
  const [rainDays, setRainDays] = useState<{ date: string; precipitationMm: number }[]>([]);

  useEffect(() => {
    if (!selectedZone?.polygon?.coordinates?.[0]?.[0]) return;
    const [lng, lat] = selectedZone.polygon.coordinates[0][0];
    const forecastDays = Math.min(16, periodDays);
    getForecast(lat, lng, forecastDays)
      .then((list) =>
        setRainDays(list.map((d) => ({ date: d.date, precipitationMm: d.precipitationMm })))
      )
      .catch(() => setRainDays([]));
  }, [selectedZone?.id, selectedZone?.polygon, periodDays]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Historique
          </h1>
          <p className="text-muted-foreground">
            Évolution de l&apos;humidité, temps de pompe et pluviométrie.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={7}>7 jours</option>
            <option value={14}>14 jours</option>
            <option value={30}>30 jours</option>
          </select>
          {farms.length > 1 && (
          <select
            value={selectedFarmId ?? ""}
            onChange={(e) => {
              setSelectedFarmId(e.target.value || null);
              setSelectedZoneId(null);
            }}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Toutes les fermes</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          )}
        </div>
      </div>

      {zones.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune zone. Les graphiques s&apos;afficheront une fois des zones et des capteurs en place.
        </p>
      ) : (
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Données par zone</CardTitle>
            <select
              value={selectedZoneId ?? selectedZone?.id ?? ""}
              onChange={(e) => setSelectedZoneId(e.target.value || null)}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent>
            <HistoryCharts
              humidityPoints={humidityPoints}
              pumpDays={pumpDays}
              rainDays={rainDays}
              zoneName={selectedZone?.name ?? ""}
              periodDays={periodDays}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
