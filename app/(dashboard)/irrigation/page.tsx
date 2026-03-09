"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useZones } from "@/lib/hooks/useZones";
import { useSendCommand } from "@/lib/hooks/useCommands";
import { getForecast } from "@/lib/weather";
import type { ForecastDay } from "@/lib/weather";
import { shouldIrrigate } from "@/lib/autoIrrigationRules";
import { useAllZonesHumidity } from "@/lib/hooks/useZoneHumidity";
import { ZoneControls } from "@/components/Irrigation/ZoneControls";
import type { Zone } from "@/types";

function getZoneCenter(zone: Zone): { lat: number; lng: number } | null {
  const coords = zone.polygon?.coordinates?.[0];
  if (!coords?.length) return null;
  const [lng, lat] = coords[0];
  return { lat, lng };
}

const DEFAULT_LAT = 46.6;
const DEFAULT_LNG = 1.9;

export default function IrrigationPage() {
  const searchParams = useSearchParams();
  const zoneIdFromUrl = searchParams.get("zone");
  const { user } = useAuth();
  const { farms } = useFarms(user?.uid);
  const { modules } = useModules(user?.uid);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const { zones: allZones } = useZones(user?.uid, null);
  const { zones, updateZone } = useZones(user?.uid, selectedFarmId);

  useEffect(() => {
    if (!zoneIdFromUrl || !allZones.length) return;
    const zone = allZones.find((z) => z.id === zoneIdFromUrl);
    if (zone) setSelectedFarmId(zone.farmId);
  }, [zoneIdFromUrl, allZones]);

  useEffect(() => {
    if (!zoneIdFromUrl || zones.length === 0) return;
    const el = document.getElementById("zone-target");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [zoneIdFromUrl, zones.length]);
  const { sendCommand, pendingCommand, clearPending } = useSendCommand(user?.uid);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const humidityByZone = useAllZonesHumidity(
    user?.uid,
    zones.map((z) => ({ id: z.id, fieldModuleIds: z.fieldModuleIds ?? [] }))
  );

  const lat = zones[0] ? getZoneCenter(zones[0])?.lat ?? DEFAULT_LAT : DEFAULT_LAT;
  const lng = zones[0] ? getZoneCenter(zones[0])?.lng ?? DEFAULT_LNG : DEFAULT_LNG;

  useEffect(() => {
    getForecast(lat, lng, 2)
      .then(setForecast)
      .catch(() => setForecast(null));
  }, [lat, lng]);

  const firstLowAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user?.uid || zones.length === 0 || !forecast?.length) return;
    const runAuto = () => {
      const now = Date.now();
      zones.forEach((zone) => {
        if (zone.mode !== "auto" || !zone.pumpModuleId) return;
        const humidity = humidityByZone[zone.id];
        const wantIrrigate = shouldIrrigate({
          soilHumidityPercent: humidity,
          forecast,
          minHumidityThreshold: zone.autoRules?.minHumidityThreshold,
          rainThresholdMm: zone.autoRules?.rainThresholdMm,
        });
        const delayMin = Math.max(0, zone.autoRules?.pumpDelayMinutes ?? 0);
        const delayMs = delayMin * 60 * 1000;

        if (wantIrrigate) {
          const firstLow = firstLowAtRef.current[zone.id];
          if (firstLow === undefined) firstLowAtRef.current[zone.id] = now;
          const elapsed = now - (firstLowAtRef.current[zone.id] ?? now);
          if (elapsed >= delayMs) {
            sendCommand(zone.pumpModuleId, "PUMP_ON");
          }
        } else {
          delete firstLowAtRef.current[zone.id];
          sendCommand(zone.pumpModuleId, "PUMP_OFF");
        }
      });
    };
    runAuto();
    const intervalMin = Math.max(0.25, Math.min(60, zones[0]?.autoRules?.checkIntervalMinutes ?? 2));
    const intervalMs = intervalMin * 60 * 1000;
    const interval = setInterval(runAuto, intervalMs);
    return () => clearInterval(interval);
  }, [user?.uid, zones, forecast, humidityByZone, sendCommand]);

  const handleZoneModeChange = useCallback(
    (zoneId: string, mode: "manual" | "auto") => {
      updateZone(zoneId, { mode });
    },
    [updateZone]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pilotage</h1>
          <p className="text-muted-foreground">
            Contrôlez vos pompes et vannes par zone (manuel) ou laissez le mode automatique gérer.
          </p>
        </div>
        {farms.length > 1 && (
          <select
            value={selectedFarmId ?? ""}
            onChange={(e) => setSelectedFarmId(e.target.value || null)}
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

      {zones.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune zone. Créez des zones sur la page Carte et assignez une pompe.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => {
            const pumpModule = zone.pumpModuleId
              ? modules.find((m) => m.id === zone.pumpModuleId) ?? null
              : null;
            const center = getZoneCenter(zone);
            return (
              <div key={zone.id} id={zoneIdFromUrl === zone.id ? "zone-target" : undefined}>
                <ZoneControls
                  zone={zone}
                  modules={modules}
                  pumpModule={pumpModule}
                  userId={user?.uid}
                  forecast={forecast}
                  zoneCenter={center}
                  pendingCommand={pendingCommand}
                  onSendCommand={sendCommand}
                  onClearPending={clearPending}
                  onZoneModeChange={handleZoneModeChange}
                  onUpdateZoneAutoRules={(zoneId, autoRules) => updateZone(zoneId, { autoRules })}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
