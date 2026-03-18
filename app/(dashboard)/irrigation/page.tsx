"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useLinkedGateways } from "@/lib/hooks/useLinkedGateways";
import { useAlertConfig } from "@/lib/hooks/useAlerts";
import { useZones } from "@/lib/hooks/useZones";
import { useSendCommand } from "@/lib/hooks/useCommands";
import { useAllZonesHumidity } from "@/lib/hooks/useZoneHumidity";
import { useLatestSensorMap } from "@/lib/hooks/useLatestSensorMap";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { getForecast } from "@/lib/weather";
import type { ForecastDay } from "@/lib/weather";
import { shouldIrrigate } from "@/lib/autoIrrigationRules";
import { checkModuleAlerts } from "@/lib/alertRules";
import { MapView } from "@/components/Map/MapView";
import { ZoneWatchCard } from "@/components/Irrigation/ZoneWatchCard";
import { IrrigationActionSheet } from "@/components/Irrigation/IrrigationActionSheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Module, Zone } from "@/types";
import { isPointInPolygon } from "@/lib/geo/polygon";

function getZoneCenter(zone: Zone): { lat: number; lng: number } | null {
  const coords = zone.polygon?.coordinates?.[0];
  if (!coords?.length) return null;
  const [lng, lat] = coords[0];
  return { lat, lng };
}

function getEffectiveSectors(zone: Zone): NonNullable<Zone["sectors"]> {
  if (Array.isArray(zone.sectors) && zone.sectors.length > 0) return zone.sectors;
  return [
    {
      id: "sector-main",
      name: "Secteur principal",
      polygon: zone.polygon,
      valveModuleIds: [],
    },
  ];
}

function getPolygonCenter(polygon: Zone["polygon"]): { lat: number; lng: number } | null {
  const coords = polygon?.coordinates?.[0];
  if (!coords?.length) return null;
  const count = coords.length;
  const sums = coords.reduce(
    (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sums.lat / count, lng: sums.lng / count };
}

const DEFAULT_LAT = 46.6;
const DEFAULT_LNG = 1.9;
type ViewMode = "list" | "map";

export default function IrrigationPage() {
  const searchParams = useSearchParams();
  const zoneIdFromUrl = searchParams.get("zone");
  const { user } = useAuth();
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { farms } = useFarms(user?.uid);
  const { modules, updateModule } = useModules(user?.uid, {
    offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
  });
  const { gateways } = useLinkedGateways(user?.uid);
  const { zones: allZones } = useZones(user?.uid, null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const { zones, addZone, updateZone, removeZone } = useZones(user?.uid, selectedFarmId);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [installMode, setInstallMode] = useState(false);
  const [timedDurationMinutes, setTimedDurationMinutes] = useState(60);
  const [timedWatering, setTimedWatering] = useState<{
    pumpId: string;
    endsAt: number;
  } | null>(null);
  const timedStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [addingZone, setAddingZone] = useState(false);
  const [drawingTarget, setDrawingTarget] = useState<
    { kind: "zone"; zoneId: string } | { kind: "sector"; zoneId: string; sectorId: string } | null
  >(null);
  const [draftLatLngs, setDraftLatLngs] = useState<[number, number][]>([]);
  const [armedModuleId, setArmedModuleId] = useState<string | null>(null);
  const [pairingStep, setPairingStep] = useState<1 | 2 | 3>(1);
  const [pairingNotice, setPairingNotice] = useState<string | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{
    moduleId: string;
    lat: number;
    lng: number;
    zoneId: string;
    sectorId: string | null;
  } | null>(null);
  const [zoneToDeleteId, setZoneToDeleteId] = useState<string | null>(null);
  const [sectorToDeleteId, setSectorToDeleteId] = useState<string | null>(null);
  const [quickStartZoneId, setQuickStartZoneId] = useState<string | null>(null);

  const modulesWithGatewayStatus = useMemo(
    () =>
      modules.map((m) => ({
        ...m,
        online:
          m.type === "mother" && m.gatewayId != null
            ? (gateways.find((g) => g.gatewayId === m.gatewayId)?.online ?? false)
            : m.online,
      })),
    [modules, gateways]
  );

  useEffect(() => {
    if (!zoneIdFromUrl || !allZones.length) return;
    const zone = allZones.find((z) => z.id === zoneIdFromUrl);
    if (!zone) return;
    setSelectedFarmId(zone.farmId);
  }, [zoneIdFromUrl, allZones]);

  useEffect(() => {
    if (!zoneIdFromUrl || zones.length === 0) return;
    if (zones.some((z) => z.id === zoneIdFromUrl)) {
      setSelectedZoneId(zoneIdFromUrl);
      setActionSheetOpen(true);
    }
  }, [zoneIdFromUrl, zones]);

  useEffect(() => {
    if (!selectedZoneId && zones.length > 0) {
      setSelectedZoneId(zones[0].id);
      return;
    }
    if (selectedZoneId && !zones.some((z) => z.id === selectedZoneId)) {
      setSelectedZoneId(zones[0]?.id ?? null);
    }
  }, [zones, selectedZoneId]);

  const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) ?? null : null;
  const selectedZoneSectors = selectedZone ? getEffectiveSectors(selectedZone) : [];

  useEffect(() => {
    if (!selectedZone) {
      setSelectedSectorId(null);
      return;
    }
    if (!selectedSectorId || !selectedZoneSectors.some((s) => s.id === selectedSectorId)) {
      setSelectedSectorId(selectedZoneSectors[0]?.id ?? null);
    }
  }, [selectedZone?.id, selectedSectorId, selectedZoneSectors]);

  const { sendCommand, pendingCommand, clearPending } = useSendCommand(user?.uid);
  const handleSendCommand = useCallback(
    (
      moduleId: string,
      type:
        | "VALVE_OPEN"
        | "VALVE_CLOSE"
        | "VALVE_A_OPEN"
        | "VALVE_A_CLOSE"
        | "VALVE_B_OPEN"
        | "VALVE_B_CLOSE"
        | "PUMP_ON"
        | "PUMP_OFF"
    ) => {
      const mod = modulesWithGatewayStatus.find((m) => m.id === moduleId);
      const opts =
        mod?.gatewayId && mod?.deviceId
          ? { gatewayId: mod.gatewayId, deviceId: mod.deviceId }
          : undefined;
      sendCommand(moduleId, type, opts);
    },
    [modulesWithGatewayStatus, sendCommand]
  );

  const fieldModules = useMemo(
    () => modulesWithGatewayStatus.filter((m) => m.type === "field"),
    [modulesWithGatewayStatus]
  );
  const pumpModules = useMemo(
    () => modulesWithGatewayStatus.filter((m) => m.type === "pump"),
    [modulesWithGatewayStatus]
  );
  const latestSensorByModule = useLatestSensorMap(user?.uid, fieldModules);
  const humidityByZone = useAllZonesHumidity(
    user?.uid,
    zones.map((z) => ({ id: z.id, fieldModuleIds: z.fieldModuleIds ?? [] })),
    modulesWithGatewayStatus
  );
  const allPumpRefs = useMemo(
    () =>
      modulesWithGatewayStatus
        .filter((m) => m.type === "pump")
        .map((p) => ({
          moduleId: p.id,
          gatewayId: p.gatewayId,
          deviceId: p.deviceId,
        })),
    [modulesWithGatewayStatus]
  );
  const pumpStates = useAllPumpStates(user?.uid, allPumpRefs);

  const thresholdCb = alertConfig?.stressTensionThreshold ?? 60;
  const zoneMetrics = useMemo(() => {
    return zones
      .map((zone) => {
        const zoneFieldModules = (zone.fieldModuleIds ?? [])
          .map((id) => modulesWithGatewayStatus.find((m) => m.id === id))
          .filter((m): m is Module => m != null);
        const tensionValues = zoneFieldModules
          .map((m) => latestSensorByModule[m.id]?.tension_cb)
          .filter((v): v is number => typeof v === "number");
        const avgTension =
          tensionValues.length > 0
            ? tensionValues.reduce((sum, v) => sum + v, 0) / tensionValues.length
            : undefined;
        const avgHumidity = humidityByZone[zone.id];
        const tensionScore =
          avgTension != null ? Math.max(0, Math.min(100, (avgTension / thresholdCb) * 100)) : 0;
        const humidityScore =
          avgHumidity != null ? Math.max(0, Math.min(100, (50 - avgHumidity) * 2)) : 0;
        const thirstScore = Math.max(tensionScore, humidityScore);

        const pumpIds = zone.pumpModuleIds?.length
          ? zone.pumpModuleIds
          : zone.pumpModuleId
            ? [zone.pumpModuleId]
            : [];
        const isIrrigating = pumpIds.some((id) => pumpStates[id]?.pumpOn);
        const hasAlert = zoneFieldModules.some((mod) =>
          checkModuleAlerts(mod, alertConfig ?? {}, latestSensorByModule[mod.id] ?? null)
        );

        const status: "irrigating" | "idle" | "alert" = hasAlert
          ? "alert"
          : isIrrigating
            ? "irrigating"
            : "idle";
        return {
          zone,
          avgHumidity,
          avgTension,
          thirstScore,
          status,
          primaryPumpId: pumpIds[0] ?? null,
        };
      })
      .sort((a, b) => b.thirstScore - a.thirstScore);
  }, [zones, modulesWithGatewayStatus, latestSensorByModule, humidityByZone, thresholdCb, pumpStates, alertConfig]);

  const zoneMapStyles = useMemo(() => {
    const styles: Record<string, { color: string; fillColor: string; fillOpacity: number; weight: number }> = {};
    zoneMetrics.forEach((entry) => {
      if (entry.status === "irrigating") {
        styles[entry.zone.id] = { color: "#1d4ed8", fillColor: "#60a5fa", fillOpacity: 0.3, weight: 2 };
        return;
      }
      if (entry.thirstScore >= 70) {
        styles[entry.zone.id] = { color: "#b91c1c", fillColor: "#f87171", fillOpacity: 0.4, weight: 2 };
      } else if (entry.thirstScore >= 40) {
        styles[entry.zone.id] = { color: "#b45309", fillColor: "#fbbf24", fillOpacity: 0.32, weight: 2 };
      } else {
        styles[entry.zone.id] = { color: "#047857", fillColor: "#86efac", fillOpacity: 0.22, weight: 2 };
      }
    });
    return styles;
  }, [zoneMetrics]);

  const flowLinks = useMemo(() => {
    if (!selectedZone) return [] as Array<{
      from: [number, number];
      to: [number, number];
      active?: boolean;
      label?: string;
    }>;
    const pumpId = selectedZone.pumpModuleIds?.[0] ?? selectedZone.pumpModuleId;
    const pump = pumpId ? pumpModules.find((p) => p.id === pumpId) : null;
    if (!pump?.position) return [];
    const pumpPos: [number, number] = [pump.position.lat, pump.position.lng];
    const links: Array<{ from: [number, number]; to: [number, number]; active?: boolean; label?: string }> = [];
    const zoneCenter = getPolygonCenter(selectedZone.polygon);
    if (zoneCenter) {
      const active = pumpStates[pump.id]?.pumpOn ?? false;
      links.push({
        from: [zoneCenter.lat, zoneCenter.lng],
        to: pumpPos,
        active,
        label: selectedZone.name,
      });
    }
    const sectors = getEffectiveSectors(selectedZone);
    sectors.forEach((sector) => {
      const c = getPolygonCenter(sector.polygon);
      if (!c) return;
      const slot = sector.valveSlot ?? "A";
      const st = pumpStates[pump.id];
      const active =
        slot === "A"
          ? st?.valveAOpen ?? st?.valveOpen ?? false
          : st?.valveBOpen ?? st?.valveOpen ?? false;
      links.push({
        from: [c.lat, c.lng],
        to: pumpPos,
        active,
        label: `${sector.name} (${slot})`,
      });
    });
    return links;
  }, [selectedZone, pumpModules, pumpStates]);

  const assignedModuleIds = useMemo(() => {
    const ids = new Set<string>();
    zones.forEach((zone) => {
      (zone.fieldModuleIds ?? []).forEach((id) => ids.add(id));
      (zone.pumpModuleIds ?? []).forEach((id) => ids.add(id));
      (zone.valveModuleIds ?? []).forEach((id) => ids.add(id));
      (zone.sectors ?? []).forEach((sector) =>
        (sector.valveModuleIds ?? []).forEach((id) => ids.add(id))
      );
      if (zone.pumpModuleId) ids.add(zone.pumpModuleId);
    });
    return ids;
  }, [zones]);
  const orphanModules = useMemo(
    () =>
      modulesWithGatewayStatus.filter(
        (m) => (m.type === "pump" || m.type === "field") && !assignedModuleIds.has(m.id)
      ),
    [modulesWithGatewayStatus, assignedModuleIds]
  );

  const detachModuleFromAllZones = useCallback(
    async (moduleId: string) => {
      const updates: Promise<void>[] = [];
      zones.forEach((zone) => {
        const nextFields = (zone.fieldModuleIds ?? []).filter((id) => id !== moduleId);
        const nextPumps = (zone.pumpModuleIds ?? []).filter((id) => id !== moduleId);
        const nextValves = (zone.valveModuleIds ?? []).filter((id) => id !== moduleId);
        const nextSectors =
          zone.sectors?.map((sector) => ({
            ...sector,
            valveModuleIds: (sector.valveModuleIds ?? []).filter((id) => id !== moduleId),
          })) ?? zone.sectors;
        const nextPumpSingle = zone.pumpModuleId === moduleId ? nextPumps[0] : zone.pumpModuleId;
        const changed =
          nextFields.length !== (zone.fieldModuleIds ?? []).length ||
          nextPumps.length !== (zone.pumpModuleIds ?? []).length ||
          nextValves.length !== (zone.valveModuleIds ?? []).length ||
          JSON.stringify(nextSectors ?? []) !== JSON.stringify(zone.sectors ?? []) ||
          nextPumpSingle !== zone.pumpModuleId;
        if (!changed) return;
        updates.push(
          updateZone(zone.id, {
            fieldModuleIds: nextFields,
            pumpModuleIds: nextPumps,
            valveModuleIds: nextValves,
            sectors: nextSectors,
            pumpModuleId: nextPumpSingle,
          })
        );
      });
      await Promise.all(updates);
    },
    [zones, updateZone]
  );

  const assignModuleToMapPosition = useCallback(
    (moduleId: string, latClick: number, lngClick: number) => {
      const module = modulesWithGatewayStatus.find((m) => m.id === moduleId);
      if (!module) return;

      let targetZone: Zone | null = null;
      let targetSectorId: string | null = null;
      for (const zone of zones) {
        const sectors = getEffectiveSectors(zone);
        const sector = sectors.find((s) =>
          isPointInPolygon([lngClick, latClick], s.polygon.coordinates)
        );
        if (sector) {
          targetZone = zone;
          targetSectorId = sector.id;
          break;
        }
        if (isPointInPolygon([lngClick, latClick], zone.polygon.coordinates)) {
          targetZone = zone;
          break;
        }
      }
      if (!targetZone) {
        setPairingNotice("Cliquez a l'interieur d'une zone pour placer le module.");
        return;
      }
      setPendingPlacement({
        moduleId,
        lat: latClick,
        lng: lngClick,
        zoneId: targetZone.id,
        sectorId: targetSectorId,
      });
      setPairingStep(3);
      setPairingNotice(`Position capturee dans "${targetZone.name}". Validez l'affectation.`);
    },
    [modulesWithGatewayStatus, zones]
  );

  const confirmPlacement = useCallback(async () => {
    if (!pendingPlacement) return;
    const { moduleId, lat, lng, zoneId, sectorId } = pendingPlacement;
    const module = modulesWithGatewayStatus.find((m) => m.id === moduleId);
    const zone = zones.find((z) => z.id === zoneId);
    if (!module || !zone) {
      setPendingPlacement(null);
      return;
    }
    try {
      await detachModuleFromAllZones(moduleId);
      if (module.type === "field") {
        const nextFields = Array.from(new Set([...(zone.fieldModuleIds ?? []), module.id]));
        await updateZone(zone.id, { fieldModuleIds: nextFields });
      }
      if (module.type === "pump") {
        const nextPumps = Array.from(
          new Set([...(zone.pumpModuleIds ?? (zone.pumpModuleId ? [zone.pumpModuleId] : [])), module.id])
        );
        await updateZone(zone.id, {
          pumpModuleIds: nextPumps,
          pumpModuleId: nextPumps[0],
        });
      }
      await updateModule(module.id, { position: { lat, lng } });
      setSelectedZoneId(zone.id);
      if (sectorId) setSelectedSectorId(sectorId);
      setPendingPlacement(null);
      setArmedModuleId(null);
      setPairingStep(1);
      setPairingNotice("Module affecte avec succes.");
    } catch {
      setPairingNotice("Echec de l'affectation. Reessayez.");
    }
  }, [pendingPlacement, modulesWithGatewayStatus, zones, detachModuleFromAllZones, updateZone, updateModule]);

  const handleStartStopForZone = useCallback(
    (zone: Zone) => {
      const pumpIds = zone.pumpModuleIds?.length
        ? zone.pumpModuleIds
        : zone.pumpModuleId
          ? [zone.pumpModuleId]
          : [];
      const pumpId = pumpIds[0];
      if (!pumpId) return;
      const isOn = pumpStates[pumpId]?.pumpOn ?? false;
      handleSendCommand(pumpId, isOn ? "PUMP_OFF" : "PUMP_ON");
      if (!isOn) {
        setTimedWatering(null);
      }
    },
    [pumpStates, handleSendCommand]
  );

  const handleStartNowForZone = useCallback(
    (zone: Zone) => {
      const pumpId = zone.pumpModuleIds?.[0] ?? zone.pumpModuleId ?? null;
      if (!pumpId) return;
      handleSendCommand(pumpId, "PUMP_ON");
    },
    [handleSendCommand]
  );

  const handleMapClick = useCallback(
    (latClick: number, lngClick: number) => {
      if (drawingTarget) {
        setDraftLatLngs((prev) => [...prev, [latClick, lngClick]]);
        return;
      }
      if (installMode && armedModuleId) {
        if (pairingStep !== 2) {
          setPairingNotice("Passez a l'etape 2 pour cliquer la carte.");
          return;
        }
        assignModuleToMapPosition(armedModuleId, latClick, lngClick);
      } else if (installMode && !armedModuleId) {
        setPairingNotice("Etape 1: choisissez d'abord un module orphelin.");
      }
    },
    [drawingTarget, installMode, armedModuleId, assignModuleToMapPosition, pairingStep]
  );

  const handleDraftPointMove = useCallback((index: number, latMove: number, lngMove: number) => {
    setDraftLatLngs((prev) => {
      const next = [...prev];
      if (index >= 0 && index < next.length) next[index] = [latMove, lngMove];
      return next;
    });
  }, []);

  const handleDraftPointRemove = useCallback((index: number) => {
    setDraftLatLngs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const startZoneDrawing = useCallback(
    (zoneId: string) => {
      const zone = zones.find((z) => z.id === zoneId);
      setDrawingTarget({ kind: "zone", zoneId });
      if (zone?.polygon?.coordinates?.[0]?.length) {
        setDraftLatLngs(zone.polygon.coordinates[0].map(([lngP, latP]) => [latP, lngP] as [number, number]));
      } else {
        setDraftLatLngs([]);
      }
    },
    [zones]
  );

  const startSectorDrawing = useCallback(
    (zoneId: string, sectorId: string) => {
      const zone = zones.find((z) => z.id === zoneId);
      const sector = zone ? getEffectiveSectors(zone).find((s) => s.id === sectorId) : null;
      setDrawingTarget({ kind: "sector", zoneId, sectorId });
      if (sector?.polygon?.coordinates?.[0]?.length) {
        setDraftLatLngs(sector.polygon.coordinates[0].map(([lngP, latP]) => [latP, lngP] as [number, number]));
      } else {
        setDraftLatLngs([]);
      }
    },
    [zones]
  );

  const addSector = useCallback(async () => {
    if (!selectedZone) return;
    const sectors = getEffectiveSectors(selectedZone);
    const nextId = `sector-${Date.now().toString(36)}`;
    const next = [
      ...sectors,
      {
        id: nextId,
        name: `Secteur ${sectors.length + 1}`,
        polygon: { type: "Polygon" as const, coordinates: [[]] },
        valveModuleIds: [],
        valveSlot: sectors.length % 2 === 0 ? ("A" as "A" | "B") : ("B" as "A" | "B"),
      },
    ];
    await updateZone(selectedZone.id, { sectors: next });
    setSelectedSectorId(nextId);
    setDrawingTarget({ kind: "sector", zoneId: selectedZone.id, sectorId: nextId });
    setDraftLatLngs([]);
  }, [selectedZone, updateZone]);

  const handleSaveDraft = useCallback(async () => {
    if (!drawingTarget || draftLatLngs.length < 3) return;
    const polygon = {
      type: "Polygon" as const,
      coordinates: [draftLatLngs.map(([latP, lngP]) => [lngP, latP])],
    };
    if (drawingTarget.kind === "zone") {
      await updateZone(drawingTarget.zoneId, { polygon });
    } else {
      const zone = zones.find((z) => z.id === drawingTarget.zoneId);
      if (!zone) return;
      const nextSectors = getEffectiveSectors(zone).map((sector) =>
        sector.id === drawingTarget.sectorId ? { ...sector, polygon } : sector
      );
      await updateZone(zone.id, { sectors: nextSectors });
    }
    setDrawingTarget(null);
    setDraftLatLngs([]);
  }, [drawingTarget, draftLatLngs, updateZone, zones]);

  const handleCancelDrawing = useCallback(() => {
    setDrawingTarget(null);
    setDraftLatLngs([]);
  }, []);

  const handleCreateZone = useCallback(async () => {
    const name = newZoneName.trim();
    const farmId = selectedFarmId || farms[0]?.id;
    if (!name || !farmId) return;
    setAddingZone(true);
    try {
      const zoneId = await addZone(farmId, name, { type: "Polygon", coordinates: [[]] });
      if (zoneId) {
        setSelectedZoneId(zoneId);
        setDrawingTarget({ kind: "zone", zoneId });
        setDraftLatLngs([]);
      }
      setNewZoneName("");
    } finally {
      setAddingZone(false);
    }
  }, [newZoneName, selectedFarmId, farms, addZone]);

  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const lat = zones[0] ? getZoneCenter(zones[0])?.lat ?? DEFAULT_LAT : DEFAULT_LAT;
  const lng = zones[0] ? getZoneCenter(zones[0])?.lng ?? DEFAULT_LNG : DEFAULT_LNG;
  const selectedCenter = selectedZone ? getZoneCenter(selectedZone) : null;
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
        const zonePumps = zone.pumpModuleIds?.length
          ? zone.pumpModuleIds
          : zone.pumpModuleId
            ? [zone.pumpModuleId]
            : [];
        if (zone.mode !== "auto" || zonePumps.length === 0) return;
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
          if (elapsed >= delayMs) zonePumps.forEach((pumpId) => handleSendCommand(pumpId, "PUMP_ON"));
        } else {
          delete firstLowAtRef.current[zone.id];
          zonePumps.forEach((pumpId) => handleSendCommand(pumpId, "PUMP_OFF"));
        }
      });
    };
    runAuto();
    const interval = setInterval(runAuto, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.uid, zones, forecast, humidityByZone, handleSendCommand]);

  const startTimedWatering = useCallback(() => {
    if (!selectedZone) return;
    const pumpId = selectedZone.pumpModuleIds?.[0] ?? selectedZone.pumpModuleId ?? null;
    if (!pumpId) return;
    handleSendCommand(pumpId, "PUMP_ON");
    const endsAt = Date.now() + timedDurationMinutes * 60 * 1000;
    setTimedWatering({ pumpId, endsAt });
  }, [selectedZone, timedDurationMinutes, handleSendCommand]);

  useEffect(() => {
    if (timedStopRef.current) {
      clearTimeout(timedStopRef.current);
      timedStopRef.current = null;
    }
    if (!timedWatering) return;
    const delay = Math.max(0, timedWatering.endsAt - Date.now());
    timedStopRef.current = setTimeout(() => {
      handleSendCommand(timedWatering.pumpId, "PUMP_OFF");
      setTimedWatering(null);
    }, delay);
    return () => {
      if (timedStopRef.current) {
        clearTimeout(timedStopRef.current);
        timedStopRef.current = null;
      }
    };
  }, [timedWatering, handleSendCommand]);

  const quickStartZone = useMemo(
    () => (quickStartZoneId ? zones.find((z) => z.id === quickStartZoneId) ?? null : null),
    [quickStartZoneId, zones]
  );

  const armedModule = useMemo(
    () => modulesWithGatewayStatus.find((m) => m.id === armedModuleId) ?? null,
    [modulesWithGatewayStatus, armedModuleId]
  );
  const isPairingCaptureMode = installMode && pairingStep === 2 && !!armedModuleId;

  const handleToggleInstallMode = useCallback(() => {
    setInstallMode((prev) => {
      const next = !prev;
      if (!next) {
        setArmedModuleId(null);
        setPendingPlacement(null);
        setPairingStep(1);
        setPairingNotice(null);
        setDrawingTarget(null);
        setDraftLatLngs([]);
      }
      return next;
    });
  }, []);

  const confirmDeleteZone = useCallback(async () => {
    if (!zoneToDeleteId) return;
    await removeZone(zoneToDeleteId);
    if (selectedZoneId === zoneToDeleteId) {
      setSelectedZoneId(null);
      setSelectedSectorId(null);
      setActionSheetOpen(false);
    }
    setZoneToDeleteId(null);
    setPairingNotice("Zone supprimee. Les modules sont desormais orphelins.");
  }, [zoneToDeleteId, removeZone, selectedZoneId]);

  const confirmDeleteSector = useCallback(async () => {
    if (!selectedZone || !sectorToDeleteId) return;
    const sectors = getEffectiveSectors(selectedZone);
    if (sectors.length <= 1) {
      setPairingNotice("Impossible de supprimer le dernier secteur.");
      setSectorToDeleteId(null);
      return;
    }
    const nextSectors = sectors.filter((s) => s.id !== sectorToDeleteId);
    await updateZone(selectedZone.id, { sectors: nextSectors });
    if (selectedSectorId === sectorToDeleteId) setSelectedSectorId(nextSectors[0]?.id ?? null);
    setSectorToDeleteId(null);
    setPairingNotice("Secteur supprime.");
  }, [selectedZone, sectorToDeleteId, updateZone, selectedSectorId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Irrigation & Zones</h1>
          <p className="text-muted-foreground">
            Priorisez les zones qui ont soif, puis pilotez en un geste.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {farms.length > 1 && (
            <select
              value={selectedFarmId ?? ""}
              onChange={(e) => setSelectedFarmId(e.target.value || null)}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Tous les espaces</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
            >
              Liste
            </Button>
            <Button
              size="sm"
              variant={viewMode === "map" ? "default" : "ghost"}
              onClick={() => setViewMode("map")}
            >
              Carte
            </Button>
          </div>
          <Button size="sm" variant={installMode ? "default" : "outline"} onClick={handleToggleInstallMode}>
            {installMode ? "Fermer installation" : "Mode installation"}
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {zoneMetrics.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-muted-foreground">
              Aucune zone configuree pour l&apos;instant.
            </div>
          ) : (
            zoneMetrics.map((entry) => (
              <ZoneWatchCard
                key={entry.zone.id}
                userId={user?.uid}
                zone={entry.zone}
                status={entry.status}
                thirstScore={entry.thirstScore}
                tensionCb={entry.avgTension}
                humidity={entry.avgHumidity}
                hasPump={!!entry.primaryPumpId}
                isPumpRunning={entry.primaryPumpId ? (pumpStates[entry.primaryPumpId]?.pumpOn ?? false) : false}
                onStartStop={() => handleStartStopForZone(entry.zone)}
                onSelect={() => {
                  setSelectedZoneId(entry.zone.id);
                  setActionSheetOpen(true);
                }}
              />
            ))
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="h-[72vh] overflow-hidden rounded-xl border border-slate-200 bg-white">
            <MapView
              zones={zones}
              fieldModules={fieldModules}
              pumpModules={pumpModules}
              center={[selectedCenter?.lat ?? lat, selectedCenter?.lng ?? lng]}
              zoom={selectedCenter ? 14 : 6}
              className="h-full w-full"
              selectedZoneId={selectedZoneId}
              selectedSectorId={selectedSectorId}
              enablePopups={!isPairingCaptureMode && !drawingTarget}
              onZoneSelect={(zoneId, at) => {
                if (drawingTarget && at) {
                  setDraftLatLngs((prev) => [...prev, [at.lat, at.lng]]);
                  return;
                }
                if (isPairingCaptureMode && armedModuleId && at) {
                  setSelectedZoneId(zoneId);
                  assignModuleToMapPosition(armedModuleId, at.lat, at.lng);
                  return;
                }
                setSelectedZoneId(zoneId);
                setActionSheetOpen(true);
              }}
              onSectorSelect={(zoneId, sectorId, at) => {
                if (drawingTarget && at) {
                  setDraftLatLngs((prev) => [...prev, [at.lat, at.lng]]);
                  return;
                }
                if (isPairingCaptureMode && armedModuleId && at) {
                  setSelectedZoneId(zoneId);
                  setSelectedSectorId(sectorId);
                  assignModuleToMapPosition(armedModuleId, at.lat, at.lng);
                  return;
                }
                setSelectedZoneId(zoneId);
                setSelectedSectorId(sectorId);
                setActionSheetOpen(true);
              }}
              onZoneLongPress={(zoneId) => {
                setQuickStartZoneId(zoneId);
              }}
              onMapClick={handleMapClick}
              draftLatLngs={draftLatLngs}
              onDraftPointMove={drawingTarget ? handleDraftPointMove : undefined}
              onDraftPointRemove={drawingTarget ? handleDraftPointRemove : undefined}
              zoneStyles={zoneMapStyles}
              pumpStatesByModuleId={pumpStates}
              flowLinks={flowLinks}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Clic long sur une zone pour un arrosage immediat (avec confirmation).
          </p>
        </section>
      )}

      {installMode && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">Installation & maintenance</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCreateZone} disabled={addingZone || !newZoneName.trim()}>
                {addingZone ? "Creation..." : "Creer zone"}
              </Button>
              <Input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="w-52"
                placeholder="Ex: Champ Nord"
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <Label>Assistant d&apos;appairage (3 etapes)</Label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded border px-2 py-1 ${pairingStep === 1 ? "border-primary bg-primary/10" : "border-slate-200"}`}>
                  1. Module
                </div>
                <div className={`rounded border px-2 py-1 ${pairingStep === 2 ? "border-primary bg-primary/10" : "border-slate-200"}`}>
                  2. Carte
                </div>
                <div className={`rounded border px-2 py-1 ${pairingStep === 3 ? "border-primary bg-primary/10" : "border-slate-200"}`}>
                  3. Valider
                </div>
              </div>
              {pairingStep === 1 && (
                <>
                  <select
                    value={armedModuleId ?? ""}
                    onChange={(e) => {
                      setArmedModuleId(e.target.value || null);
                      setPairingNotice(null);
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Choisir un module orphelin</option>
                    {orphanModules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id} ({m.type === "pump" ? "Pompe" : "Capteur"})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!armedModuleId) {
                          setPairingNotice("Selectionnez un module avant de continuer.");
                          return;
                        }
                        setPairingStep(2);
                        setPairingNotice("Etape 2: cliquez sur la carte dans une zone.");
                      }}
                    >
                      Continuer
                    </Button>
                  </div>
                </>
              )}
              {pairingStep >= 2 && (
                <div className="rounded-md border border-slate-200 p-2 text-xs">
                  <p>
                    Module selectionne: <span className="font-medium">{armedModule?.name || armedModule?.id || "Aucun"}</span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPairingStep(1)}>
                      Changer le module
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setArmedModuleId(null);
                        setPendingPlacement(null);
                        setPairingStep(1);
                        setPairingNotice("Assistant annule.");
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}
              {pairingNotice ? <p className="text-xs text-muted-foreground">{pairingNotice}</p> : null}
            </div>

            {selectedZone && (
              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <p className="text-sm font-medium">Edition de {selectedZone.name}</p>
                <div className="space-y-1">
                  <Label className="text-xs">Secteur à redessiner</Label>
                  <select
                    value={selectedSectorId ?? ""}
                    onChange={(e) => setSelectedSectorId(e.target.value || null)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Aucun secteur</option>
                    {selectedZoneSectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startZoneDrawing(selectedZone.id)}>
                    Redessiner zone
                  </Button>
                  <Button size="sm" variant="outline" onClick={addSector}>
                    + Secteur
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setZoneToDeleteId(selectedZone.id)}>
                    Supprimer zone
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedSectorId}
                    onClick={() =>
                      selectedSectorId
                        ? startSectorDrawing(selectedZone.id, selectedSectorId)
                        : undefined
                    }
                  >
                    Dessiner secteur
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!selectedSectorId}
                    onClick={() => setSectorToDeleteId(selectedSectorId)}
                  >
                    Supprimer secteur
                  </Button>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="mb-2 text-xs font-medium text-slate-600">Redessiner un secteur existant</p>
                  <div className="space-y-2">
                    {selectedZoneSectors.map((sector) => (
                      <div key={`draw-${sector.id}`} className="flex items-center justify-between gap-2 text-xs">
                        <span>{sector.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSectorId(sector.id);
                            startSectorDrawing(selectedZone.id, sector.id);
                          }}
                        >
                          Redessiner
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="mb-2 text-xs font-medium text-slate-600">
                    Affectation vanne A/B par secteur
                  </p>
                  <div className="space-y-2">
                    {getEffectiveSectors(selectedZone).map((sector) => (
                      <div key={sector.id} className="flex items-center justify-between gap-2 text-xs">
                        <span>{sector.name}</span>
                        <div className="inline-flex rounded border">
                          <Button
                            size="sm"
                            variant={sector.valveSlot === "A" || !sector.valveSlot ? "default" : "ghost"}
                            onClick={async () => {
                              const nextSectors = getEffectiveSectors(selectedZone).map((s) =>
                                s.id === sector.id ? { ...s, valveSlot: "A" as const } : s
                              );
                              await updateZone(selectedZone.id, { sectors: nextSectors });
                            }}
                          >
                            A
                          </Button>
                          <Button
                            size="sm"
                            variant={sector.valveSlot === "B" ? "default" : "ghost"}
                            onClick={async () => {
                              const nextSectors = getEffectiveSectors(selectedZone).map((s) =>
                                s.id === sector.id ? { ...s, valveSlot: "B" as const } : s
                              );
                              await updateZone(selectedZone.id, { sectors: nextSectors });
                            }}
                          >
                            B
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {drawingTarget ? (
                  <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                    <p className="text-xs text-amber-800">
                      Cliquez sur la carte pour poser les points (minimum 3).
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveDraft} disabled={draftLatLngs.length < 3}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelDrawing}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      )}

      <IrrigationActionSheet
        open={actionSheetOpen && !!selectedZone}
        onOpenChange={setActionSheetOpen}
        userId={user?.uid}
        zone={selectedZone}
        modules={modulesWithGatewayStatus}
        selectedSectorId={selectedSectorId}
        onSectorSelect={setSelectedSectorId}
        pendingCommand={pendingCommand}
        onSendCommand={handleSendCommand}
        onClearPending={clearPending}
        onZoneModeChange={(zoneId, mode) => updateZone(zoneId, { mode })}
        onUpdateSectorValve={async (zoneId, _sectorId, action) => {
          const zone = zones.find((z) => z.id === zoneId);
          const pumpId = zone?.pumpModuleIds?.[0] ?? zone?.pumpModuleId;
          if (!pumpId) return;
          const sector = zone ? getEffectiveSectors(zone).find((s) => s.id === _sectorId) : null;
          const slot = sector?.valveSlot;
          if (slot === "A") {
            handleSendCommand(pumpId, action === "open" ? "VALVE_A_OPEN" : "VALVE_A_CLOSE");
            await updateModule(pumpId, {
              valves: {
                ...(modulesWithGatewayStatus.find((m) => m.id === pumpId)?.valves ?? {}),
                A: {
                  ...(modulesWithGatewayStatus.find((m) => m.id === pumpId)?.valves?.A ?? {}),
                  status: action === "open" ? "ON" : "OFF",
                },
              },
            });
            return;
          }
          if (slot === "B") {
            handleSendCommand(pumpId, action === "open" ? "VALVE_B_OPEN" : "VALVE_B_CLOSE");
            await updateModule(pumpId, {
              valves: {
                ...(modulesWithGatewayStatus.find((m) => m.id === pumpId)?.valves ?? {}),
                B: {
                  ...(modulesWithGatewayStatus.find((m) => m.id === pumpId)?.valves?.B ?? {}),
                  status: action === "open" ? "ON" : "OFF",
                },
              },
            });
            return;
          }
          handleSendCommand(pumpId, action === "open" ? "VALVE_OPEN" : "VALVE_CLOSE");
        }}
        sensorByModuleId={latestSensorByModule}
        timedDurationMinutes={timedDurationMinutes}
        onTimedDurationChange={setTimedDurationMinutes}
        onStartTimedWatering={startTimedWatering}
        timedWateringEndsAt={timedWatering?.endsAt ?? null}
        timedWateringPumpName={
          timedWatering
            ? modulesWithGatewayStatus.find((m) => m.id === timedWatering.pumpId)?.name ??
              timedWatering.pumpId
            : null
        }
      />

      <Dialog open={!!quickStartZone} onOpenChange={(open) => !open && setQuickStartZoneId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arrosage immediat</DialogTitle>
            <DialogDescription>
              Demarrer l&apos;irrigation de {quickStartZone?.name} maintenant ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickStartZoneId(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (quickStartZone) handleStartNowForZone(quickStartZone);
                setQuickStartZoneId(null);
              }}
            >
              Demarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingPlacement}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPlacement(null);
            setPairingStep(2);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l&apos;affectation</DialogTitle>
            <DialogDescription>
              Associer{" "}
              {pendingPlacement
                ? modulesWithGatewayStatus.find((m) => m.id === pendingPlacement.moduleId)?.name ??
                  pendingPlacement.moduleId
                : "ce module"}{" "}
              a la zone{" "}
              {pendingPlacement
                ? zones.find((z) => z.id === pendingPlacement.zoneId)?.name ?? pendingPlacement.zoneId
                : ""}{" "}
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingPlacement(null);
                setPairingStep(2);
              }}
            >
              Annuler
            </Button>
            <Button onClick={confirmPlacement}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!zoneToDeleteId} onOpenChange={(open) => !open && setZoneToDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la zone</DialogTitle>
            <DialogDescription>
              Cette action supprime la zone. Les modules restent dans le parc materiel et deviennent orphelins.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneToDeleteId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDeleteZone}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sectorToDeleteId} onOpenChange={(open) => !open && setSectorToDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le secteur</DialogTitle>
            <DialogDescription>
              Le secteur sera retire de la zone. Les modules associes restent disponibles.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectorToDeleteId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSector}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

