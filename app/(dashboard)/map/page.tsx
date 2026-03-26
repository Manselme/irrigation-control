"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertConfig } from "@/lib/hooks/useAlerts";
import { useZones } from "@/lib/hooks/useZones";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { MapView } from "@/components/Map/MapView";
import { ZoneEditor } from "@/components/Map/ZoneEditor";
import type { Farm, Module, Zone } from "@/types";

export default function MapPage() {
  const { user } = useAuth();
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { farms } = useFarms(user?.uid);
  const { modules } = useModules(user?.uid, {
    offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
  });
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [drawingZoneId, setDrawingZoneId] = useState<string | null>(null);
  const [draftLatLngs, setDraftLatLngs] = useState<[number, number][]>([]);

  const { zones, addZone, updateZone, removeZone } = useZones(
    user?.uid,
    selectedFarmId
  );

  useEffect(() => {
    const ids = new Set(zones.map((z: Zone) => z.id));
    if (drawingZoneId && !ids.has(drawingZoneId)) {
      setDrawingZoneId(null);
      setDraftLatLngs([]);
    }
    if (selectedZoneId && !ids.has(selectedZoneId)) {
      setSelectedZoneId(null);
    }
  }, [zones, drawingZoneId, selectedZoneId]);

  const fieldModules = modules.filter((m: Module) => m.type === "field");
  const pumpModules = modules.filter((m: Module) => m.type === "pump");
  const pumpRefs = useMemo(
    () =>
      pumpModules.map((m: Module) => ({
        moduleId: m.id,
        gatewayId: m.gatewayId,
        deviceId: m.deviceId,
        moduleType: m.type,
        factoryId: m.factoryId,
      })),
    [pumpModules]
  );
  const pumpStates = useAllPumpStates(user?.uid, pumpRefs);

  const handleStartDrawing = useCallback((zoneId: string) => {
    const zone = zones.find((z: Zone) => z.id === zoneId);
    setDrawingZoneId(zoneId);
    if (zone?.polygon?.coordinates?.[0]?.length) {
      setDraftLatLngs(
        zone.polygon.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
      );
    } else {
      setDraftLatLngs([]);
    }
  }, [zones]);

  const handleSaveDraft = useCallback(
    (zoneId: string) => {
      if (draftLatLngs.length < 3) return;
      const polygon = {
        type: "Polygon" as const,
        coordinates: [draftLatLngs.map(([lat, lng]) => [lng, lat])],
      };
      updateZone(zoneId, { polygon });
      setDrawingZoneId(null);
      setDraftLatLngs([]);
    },
    [draftLatLngs, updateZone]
  );

  const handleCancelDrawing = useCallback(() => {
    setDrawingZoneId(null);
    setDraftLatLngs([]);
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (!drawingZoneId) return;
    setDraftLatLngs((prev) => [...prev, [lat, lng]]);
  }, [drawingZoneId]);

  const handleDraftPointMove = useCallback((index: number, lat: number, lng: number) => {
    setDraftLatLngs((prev) => {
      const next = [...prev];
      if (index >= 0 && index < next.length) next[index] = [lat, lng];
      return next;
    });
  }, []);

  const handleDraftPointRemove = useCallback((index: number) => {
    setDraftLatLngs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Carte</h1>
          <p className="text-muted-foreground">
            Visualisez vos zones et modules Champ (position GPS).
          </p>
        </div>
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
            {farms.map((f: Farm) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="h-[400px] lg:h-[500px] rounded-lg border border-border overflow-hidden">
            <MapView
              zones={zones}
              fieldModules={fieldModules}
              pumpModules={pumpModules}
              pumpStatesByModuleId={pumpStates}
              className="h-full w-full"
              onMapClick={drawingZoneId ? handleMapClick : undefined}
              draftLatLngs={draftLatLngs}
              onDraftPointMove={drawingZoneId ? handleDraftPointMove : undefined}
              onDraftPointRemove={drawingZoneId ? handleDraftPointRemove : undefined}
            />
          </div>
        </div>
        <div>
          <ZoneEditor
            zones={zones}
            farms={farms}
            modules={modules}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
            onAddZone={addZone}
            onUpdateZone={updateZone}
            onRemoveZone={removeZone}
            drawingZoneId={drawingZoneId}
            draftLatLngs={draftLatLngs}
            onStartDrawing={handleStartDrawing}
            onSaveDraft={handleSaveDraft}
            onCancelDrawing={handleCancelDrawing}
          />
        </div>
      </div>
    </div>
  );
}
