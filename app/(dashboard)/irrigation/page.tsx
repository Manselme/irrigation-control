"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAlertConfig } from "@/lib/hooks/useAlerts";
import { useFarms } from "@/lib/hooks/useFarms";
import { useLinkedGateways } from "@/lib/hooks/useLinkedGateways";
import { useModules } from "@/lib/hooks/useModules";
import { useSendCommand } from "@/lib/hooks/useCommands";
import { useLatestSensorMap } from "@/lib/hooks/useLatestSensorMap";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { useZones } from "@/lib/hooks/useZones";
import { MapView } from "@/components/Map/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Zone, ValveSlot, Module, LinkedGateway } from "@/types";
import { resolveGatewaySendCommandOpts } from "@/lib/gatewayDevicePaths";
import { formatModulePumpPressure } from "@/lib/pumpPressure";

const DEFAULT_LAT = 46.6;
const DEFAULT_LNG = 1.9;

function getZoneCenter(zone: Zone): { lat: number; lng: number } | null {
  const coords = zone.polygon?.coordinates?.[0];
  if (!coords?.length) return null;
  const sums = coords.reduce(
    (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sums.lat / coords.length, lng: sums.lng / coords.length };
}

function getZoneSensorId(zone: Zone): string {
  return zone.fieldModuleIds?.[0] ?? "";
}

function getPrimaryPumpId(zone: Zone): string {
  return zone.pumpModuleId ?? zone.pumpModuleIds?.[0] ?? "";
}

/** Choix d’irrigation pour la zone (aligné sur les secteurs après enregistrement). */
function getValveSlot(zone: Zone): ValveSlot | null {
  const ss = zone.sectors;
  if (!ss?.length) return null;
  const s0 = ss[0].valveSlot;
  if (s0 === "A" || s0 === "B" || s0 === "AB") return s0;
  const found = ss.find(
    (s) => s.valveSlot === "A" || s.valveSlot === "B" || s.valveSlot === "AB"
  );
  return found?.valveSlot ?? null;
}

/** Clé unique pompe+vanne pour l'UI (ex. POMPE-xxx:A). */
function getZoneValveKey(zone: Zone): string {
  const p = getPrimaryPumpId(zone);
  const sl = getValveSlot(zone);
  if (!p || !sl) return "";
  return `${p}:${sl}`;
}

function parseValveKey(valveKey: string): { pumpId: string; slot: ValveSlot } | null {
  const i = valveKey.lastIndexOf(":");
  if (i <= 0) return null;
  const pumpId = valveKey.slice(0, i).trim();
  const slotRaw = valveKey.slice(i + 1).trim();
  if (!pumpId || (slotRaw !== "A" && slotRaw !== "B" && slotRaw !== "AB")) return null;
  return { pumpId, slot: slotRaw as ValveSlot };
}

/** Applique le même couple pompe/vanne à tous les secteurs (évite A sur sect.1 et B sur sect.2). */
function cloneSectorsWithValveSlot(zone: Zone, slot: ValveSlot): NonNullable<Zone["sectors"]> {
  if (zone.sectors?.length) {
    return zone.sectors.map((s) => ({ ...s, valveSlot: slot }));
  }
  return [
    {
      id: "sector-main",
      name: "Secteur principal",
      polygon: zone.polygon,
      valveModuleIds: [],
      valveSlot: slot,
    },
  ];
}

function cloneSectorsWithoutValveSlot(zone: Zone): NonNullable<Zone["sectors"]> {
  return (zone.sectors?.length ? zone.sectors : []).map((s) => {
    const next = { ...s };
    delete (next as { valveSlot?: ValveSlot }).valveSlot;
    return next;
  });
}

/**
 * Irrigation réelle pour cette zone : pompe en marche ET la vanne (A/B) de la zone est ouverte.
 * Sans slot défini (ancien modèle), on utilise l’agrégat valveOpen.
 */
function isZoneActivelyIrrigating(
  zone: Zone,
  pumpStates: Record<
    string,
    { pumpOn: boolean; valveOpen: boolean; valveAOpen: boolean; valveBOpen: boolean }
  >
): boolean {
  const pumpId = getPrimaryPumpId(zone);
  if (!pumpId) return false;
  const st = pumpStates[pumpId];
  if (!st?.pumpOn) return false;
  const slot = getValveSlot(zone);
  if (slot === "A") return st.valveAOpen;
  if (slot === "B") return st.valveBOpen;
  if (slot === "AB") return st.valveAOpen && st.valveBOpen;
  return st.valveOpen;
}

/** Ligne agrégée sol + irrigation pour une zone (liste triée stress). */
type IrrigationZoneRow = {
  zone: Zone;
  tension?: number;
  humidity?: number;
  stress: number;
  running: boolean;
};

function zoneStress(
  zone: Zone,
  latestSensorByModule: Record<string, { tension_cb?: number; humidity?: number } | null>,
  thresholdCb: number
): { tension?: number; humidity?: number; stress: number } {
  const sensorId = getZoneSensorId(zone);
  const sensor = sensorId ? latestSensorByModule[sensorId] : null;
  const tension = typeof sensor?.tension_cb === "number" ? sensor.tension_cb : undefined;
  const humidity = typeof sensor?.humidity === "number" ? sensor.humidity : undefined;
  const tensionScore = tension != null ? Math.max(0, Math.min(100, (tension / thresholdCb) * 100)) : 0;
  const humidityScore = humidity != null ? Math.max(0, Math.min(100, (50 - humidity) * 2)) : 0;
  return { tension, humidity, stress: Math.max(tensionScore, humidityScore) };
}

function IrrigationPageContent() {
  const { user } = useAuth();
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { farms } = useFarms(user?.uid);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const { modules, updateModule } = useModules(user?.uid, {
    offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
  });
  const { gateways } = useLinkedGateways(user?.uid);
  const { zones, addZone, updateZone, removeZone } = useZones(user?.uid, selectedFarmId);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newZoneName, setNewZoneName] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftLatLngs, setDraftLatLngs] = useState<[number, number][]>([]);
  const [creatingZone, setCreatingZone] = useState(false);

  const [durationMin, setDurationMin] = useState(60);
  const [timedWatering, setTimedWatering] = useState<{
    pumpId: string;
    slot: ValveSlot | null;
    endsAt: number;
  } | null>(null);
  const timedStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const modulesWithGatewayStatus = useMemo(
    () =>
      modules.map((m: Module) => ({
        ...m,
        online:
          m.type === "mother" && m.gatewayId != null
            ? (gateways.find((g: LinkedGateway) => g.gatewayId === m.gatewayId)?.online ?? false)
            : m.online,
      })),
    [modules, gateways]
  );

  const fieldModules = useMemo(
    () => modulesWithGatewayStatus.filter((m: Module) => m.type === "field"),
    [modulesWithGatewayStatus]
  );
  const pumpModules = useMemo(
    () => modulesWithGatewayStatus.filter((m: Module) => m.type === "pump"),
    [modulesWithGatewayStatus]
  );

  const latestSensorByModule = useLatestSensorMap(user?.uid, fieldModules);
  const allPumpRefs = useMemo(
    () =>
      pumpModules.map((p: Module) => ({
        moduleId: p.id,
        gatewayId: p.gatewayId,
        deviceId: p.deviceId,
        moduleType: p.type,
        factoryId: p.factoryId,
      })),
    [pumpModules]
  );
  const pumpStates = useAllPumpStates(user?.uid, allPumpRefs);

  const selectedZone = selectedZoneId ? zones.find((z: Zone) => z.id === selectedZoneId) ?? null : null;

  useEffect(() => {
    const z = searchParams.get("zone");
    if (z && zones.some((x: Zone) => x.id === z)) setSelectedZoneId(z);
  }, [searchParams, zones]);

  useEffect(() => {
    if (selectedZoneId && !zones.some((z: Zone) => z.id === selectedZoneId)) setSelectedZoneId(null);
  }, [selectedZoneId, zones]);

  const thresholdCb = alertConfig?.stressTensionThreshold ?? 60;
  const zoneRows = useMemo(
    () =>
      zones
        .map((zone: Zone) => {
          const st = zoneStress(zone, latestSensorByModule, thresholdCb);
          const running = isZoneActivelyIrrigating(zone, pumpStates);
          return { zone, ...st, running };
        })
        .sort((a: IrrigationZoneRow, b: IrrigationZoneRow) => b.stress - a.stress),
    [zones, latestSensorByModule, thresholdCb, pumpStates]
  );

  const zoneMapStyles = useMemo(() => {
    const styles: Record<string, { color: string; fillColor: string; fillOpacity: number; weight: number }> = {};
    zoneRows.forEach((r: IrrigationZoneRow) => {
      if (r.stress >= 70) styles[r.zone.id] = { color: "#b91c1c", fillColor: "#f87171", fillOpacity: 0.35, weight: 2 };
      else if (r.stress >= 40)
        styles[r.zone.id] = { color: "#b45309", fillColor: "#fbbf24", fillOpacity: 0.28, weight: 2 };
      else styles[r.zone.id] = { color: "#047857", fillColor: "#86efac", fillOpacity: 0.2, weight: 2 };
    });
    return styles;
  }, [zoneRows]);

  const pumpValveFillByModuleId = useMemo(() => {
    const acc: Record<string, { A?: string; B?: string }> = {};
    zoneRows.forEach((r: IrrigationZoneRow) => {
      const pumpId = getPrimaryPumpId(r.zone);
      const slot = getValveSlot(r.zone);
      if (!pumpId || !slot) return;
      const fill = zoneMapStyles[r.zone.id]?.fillColor;
      if (!fill) return;
      acc[pumpId] = acc[pumpId] ?? {};
      if (slot === "A" || slot === "AB") acc[pumpId].A = fill;
      if (slot === "B" || slot === "AB") acc[pumpId].B = fill;
    });
    return acc;
  }, [zoneRows, zoneMapStyles]);

  const assignedSensorIds = useMemo(
    () => new Set(zones.map((z: Zone) => getZoneSensorId(z)).filter(Boolean)),
    [zones]
  );

  const assignedValveKeys = useMemo(
    () => new Set(zones.map((z: Zone) => getZoneValveKey(z)).filter(Boolean)),
    [zones]
  );

  const freeSensors = useMemo(
    () =>
      fieldModules.filter((m: Module) => {
        if (selectedZone && getZoneSensorId(selectedZone) === m.id) return true;
        return !assignedSensorIds.has(m.id);
      }),
    [fieldModules, selectedZone, assignedSensorIds]
  );

  const valveOptions = useMemo(() => {
    const opts: Array<{ id: string; label: string; pumpId: string }> = [];
    pumpModules.forEach((pump: Module) => {
      (["A", "B", "AB"] as const).forEach((slot) => {
        const id = `${pump.id}:${slot}`;
        const label =
          slot === "AB"
            ? `${pump.name || pump.id} (Vannes A et B)`
            : `${pump.name || pump.id} (Vanne ${slot})`;
        if (selectedZone && getZoneValveKey(selectedZone) === id) {
          opts.push({ id, label, pumpId: pump.id });
          return;
        }
        if (!assignedValveKeys.has(id)) {
          opts.push({ id, label, pumpId: pump.id });
        }
      });
    });
    return opts;
  }, [pumpModules, selectedZone, assignedValveKeys]);

  const { sendCommand, pendingCommand } = useSendCommand(user?.uid);
  const sendForPump = useCallback(
    async (
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
      const mod = modulesWithGatewayStatus.find((m: Module) => m.id === moduleId);
      const opts = resolveGatewaySendCommandOpts(mod);
      return sendCommand(moduleId, type, opts);
    },
    [modulesWithGatewayStatus, sendCommand]
  );

  const startZone = useCallback(
    async (zone: Zone) => {
      const pumpId = getPrimaryPumpId(zone);
      const slot = getValveSlot(zone);
      if (!pumpId || !slot) {
        setNotice("Associez une pompe et une vanne (A, B ou A+B) à cette zone.");
        return;
      }
      try {
        if (slot === "A" || slot === "AB") {
          const ra = await sendForPump(pumpId, "VALVE_A_OPEN");
          if (ra === "failed" || ra === "timeout") {
            setNotice(
              ra === "timeout" ? "Pas de confirmation vanne A (délai)." : "Échec ouverture vanne A."
            );
            return;
          }
        }
        if (slot === "B" || slot === "AB") {
          const rb = await sendForPump(pumpId, "VALVE_B_OPEN");
          if (rb === "failed" || rb === "timeout") {
            setNotice(
              rb === "timeout" ? "Pas de confirmation vanne B (délai)." : "Échec ouverture vanne B."
            );
            return;
          }
        }
        const r1 = await sendForPump(pumpId, "PUMP_ON");
        if (r1 === "failed" || r1 === "timeout") {
          setNotice(
            r1 === "timeout"
              ? "Vannes ouvertes, mais pas de confirmation pompe (délai)."
              : "Vannes ouvertes, mais échec commande pompe."
          );
          return;
        }
        if (durationMin > 0) {
          setTimedWatering({ pumpId, slot, endsAt: Date.now() + durationMin * 60 * 1000 });
        } else setTimedWatering(null);
        setNotice("Irrigation démarrée.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setNotice(msg);
      }
    },
    [sendForPump, durationMin]
  );

  /** Ouvre uniquement les vannes de la zone (pas de PUMP_ON). */
  const openValvesOnlyZone = useCallback(
    async (zone: Zone) => {
      const pumpId = getPrimaryPumpId(zone);
      const slot = getValveSlot(zone);
      if (!pumpId) {
        setNotice("Associez une pompe à cette zone.");
        return;
      }
      try {
        if (slot === "A" || slot === "AB") {
          const ra = await sendForPump(pumpId, "VALVE_A_OPEN");
          if (ra === "failed" || ra === "timeout") {
            setNotice(
              ra === "timeout" ? "Pas de confirmation vanne A." : "Échec ouverture vanne A."
            );
            return;
          }
        }
        if (slot === "B" || slot === "AB") {
          const rb = await sendForPump(pumpId, "VALVE_B_OPEN");
          if (rb === "failed" || rb === "timeout") {
            setNotice(
              rb === "timeout" ? "Pas de confirmation vanne B." : "Échec ouverture vanne B."
            );
            return;
          }
        }
        if (!slot) {
          const r = await sendForPump(pumpId, "VALVE_OPEN");
          if (r === "failed" || r === "timeout") {
            setNotice(
              r === "timeout" ? "Pas de confirmation des vannes." : "Échec ouverture des vannes."
            );
            return;
          }
        }
        setNotice("Vannes ouvertes (pompe inchangée).");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setNotice(msg);
      }
    },
    [sendForPump]
  );

  /** Ferme uniquement les vannes (pas de PUMP_OFF). */
  const closeValvesOnlyZone = useCallback(
    async (zone: Zone) => {
      const pumpId = getPrimaryPumpId(zone);
      const slot = getValveSlot(zone);
      if (!pumpId) return;
      try {
        if (slot === "A" || slot === "AB") await sendForPump(pumpId, "VALVE_A_CLOSE");
        if (slot === "B" || slot === "AB") await sendForPump(pumpId, "VALVE_B_CLOSE");
        if (!slot) await sendForPump(pumpId, "VALVE_CLOSE");
        setNotice("Vannes fermées (pompe inchangée).");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setNotice(msg);
      }
    },
    [sendForPump]
  );

  const stopZone = useCallback(
    async (zone: Zone) => {
      const pumpId = getPrimaryPumpId(zone);
      const slot = getValveSlot(zone);
      if (!pumpId) return;
      try {
        await sendForPump(pumpId, "PUMP_OFF");
        if (slot === "A" || slot === "AB") await sendForPump(pumpId, "VALVE_A_CLOSE");
        if (slot === "B" || slot === "AB") await sendForPump(pumpId, "VALVE_B_CLOSE");
        if (!slot) await sendForPump(pumpId, "VALVE_CLOSE");
        setTimedWatering(null);
        setNotice("Irrigation stoppée.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setNotice(msg);
      }
    },
    [sendForPump]
  );

  useEffect(() => {
    if (timedStopRef.current) {
      clearTimeout(timedStopRef.current);
      timedStopRef.current = null;
    }
    if (!timedWatering) return;
    const delay = Math.max(0, timedWatering.endsAt - Date.now());
    const tw = timedWatering;
    timedStopRef.current = setTimeout(() => {
      void (async () => {
        const { pumpId, slot } = tw;
        await sendForPump(pumpId, "PUMP_OFF");
        if (slot === "A" || slot === "AB") await sendForPump(pumpId, "VALVE_A_CLOSE");
        if (slot === "B" || slot === "AB") await sendForPump(pumpId, "VALVE_B_CLOSE");
        if (!slot) await sendForPump(pumpId, "VALVE_CLOSE");
        setTimedWatering(null);
        setNotice("Durée écoulée: irrigation arrêtée.");
      })();
    }, delay);
    return () => {
      if (timedStopRef.current) clearTimeout(timedStopRef.current);
    };
  }, [timedWatering, sendForPump]);

  const center = useMemo(() => {
    const c = selectedZone ? getZoneCenter(selectedZone) : zones[0] ? getZoneCenter(zones[0]) : null;
    return [c?.lat ?? DEFAULT_LAT, c?.lng ?? DEFAULT_LNG] as [number, number];
  }, [selectedZone, zones]);

  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!isDrawing) return;
      setDraftLatLngs((prev) => [...prev, [lat, lng]]);
    },
    [isDrawing]
  );

  const onZoneSelect = useCallback(
    (zoneId: string, at?: { lat: number; lng: number }) => {
      if (isDrawing && at) {
        setDraftLatLngs((prev) => [...prev, [at.lat, at.lng]]);
        return;
      }
      setSelectedZoneId(zoneId);
    },
    [isDrawing]
  );

  const saveNewZone = useCallback(async () => {
    const farmId = selectedFarmId ?? farms[0]?.id;
    const name = newZoneName.trim();
    if (!farmId || !name || draftLatLngs.length < 3) return;
    setCreatingZone(true);
    try {
      const polygon = {
        type: "Polygon" as const,
        coordinates: [draftLatLngs.map(([lat, lng]) => [lng, lat])],
      };
      const zoneId = await addZone(farmId, name, polygon);
      if (zoneId) setSelectedZoneId(zoneId);
      setNotice("Zone créée.");
      setNewZoneName("");
      setDraftLatLngs([]);
      setIsDrawing(false);
    } finally {
      setCreatingZone(false);
    }
  }, [selectedFarmId, farms, newZoneName, draftLatLngs, addZone]);

  return (
    <div className="relative h-full w-full">
      {/* Full-bleed Map */}
      <div className="absolute inset-0 z-0">
        <MapView
          zones={zones}
          fieldModules={fieldModules}
          pumpModules={pumpModules}
          center={center}
          zoom={selectedZone ? 14 : 6}
          className="h-full w-full"
          selectedZoneId={selectedZoneId}
          onZoneSelect={onZoneSelect}
          onMapClick={onMapClick}
          draftLatLngs={draftLatLngs}
          zoneStyles={zoneMapStyles}
          pumpStatesByModuleId={pumpStates}
          pumpValveFillByModuleId={pumpValveFillByModuleId}
          flowLinks={[]}
        />
      </div>

      {/* Floating Toolbar (top center) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 glass-panel rounded-xl shadow-lg ring-1 ring-border/15">
        <Button
          size="sm"
          variant={isDrawing ? "default" : "ghost"}
          className="gap-2 font-headline font-bold text-sm"
          onClick={() => setIsDrawing((p) => !p)}
        >
          {isDrawing ? "Stop Draw" : "Draw Zone"}
        </Button>
        {isDrawing && (
          <>
            <div className="h-6 w-px bg-border/30 mx-1" />
            <Button
              size="sm"
              variant="ghost"
              className="font-headline font-medium text-sm"
              onClick={() => setDraftLatLngs((prev) => prev.slice(0, -1))}
              disabled={draftLatLngs.length === 0}
            >
              Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="font-headline font-medium text-sm hover:text-destructive hover:bg-destructive/10"
              onClick={() => { setIsDrawing(false); setDraftLatLngs([]); }}
            >
              Cancel
            </Button>
          </>
        )}
        {isDrawing && draftLatLngs.length > 0 && (
          <span className="px-2 text-[10px] font-bold text-muted-foreground">
            {draftLatLngs.length} pts
          </span>
        )}
      </div>

      {/* Zone creation bar (when drawing & ready to save) */}
      {isDrawing && draftLatLngs.length >= 3 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 glass-panel p-2 rounded-xl shadow-lg ring-1 ring-border/15">
          <Input
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            placeholder="Zone name…"
            className="h-8 w-40 text-xs"
          />
          <Button
            size="sm"
            onClick={saveNewZone}
            disabled={creatingZone || !newZoneName.trim()}
            className="text-[10px] uppercase tracking-widest"
          >
            {creatingZone ? "…" : "Create"}
          </Button>
        </div>
      )}

      {/* Floating Side Panel (right) — Glass */}
      <div className="absolute right-4 top-4 bottom-4 w-80 z-20 hidden lg:flex flex-col">
        <div className="glass-panel h-full flex flex-col rounded-2xl ring-1 ring-border/10 shadow-2xl overflow-hidden">
          {/* Panel Header */}
          <div className="p-4 border-b border-border/10 bg-surface-highest/30">
            {selectedZone ? (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-tighter">
                    {isZoneActivelyIrrigating(selectedZone, pumpStates) ? "Active Zone" : "Selected Zone"}
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSelectedZoneId(null)}>
                    Back
                  </Button>
                </div>
                <h2 className="font-headline text-xl font-black tracking-tight">{selectedZone.name}</h2>
              </>
            ) : (
              <>
                <h2 className="font-headline text-lg font-bold tracking-tight">Irrigation &amp; Zones</h2>
                <p className="text-xs text-muted-foreground">{zones.length} zones configured</p>
              </>
            )}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedZone ? (
              <>
                {/* Monitoring Grid */}
                {(() => {
                  const row = zoneRows.find((r: IrrigationZoneRow) => r.zone.id === selectedZone.id);
                  const battery = getZoneSensorId(selectedZone)
                    ? modulesWithGatewayStatus.find((m: Module) => m.id === getZoneSensorId(selectedZone))?.battery
                    : undefined;
                  const pid = getPrimaryPumpId(selectedZone);
                  const pm = pid ? modulesWithGatewayStatus.find((m: Module) => m.id === pid) : null;
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-surface-lowest p-3 ring-1 ring-border/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Soil Tension</p>
                        <p className="text-lg font-black font-headline text-primary">
                          {row?.tension != null ? Math.round(row.tension) : "—"} <span className="text-[10px] text-muted-foreground">cb</span>
                        </p>
                      </div>
                      <div className="rounded-xl bg-surface-lowest p-3 ring-1 ring-border/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Humidity</p>
                        <p className="text-lg font-black font-headline text-primary">
                          {row?.humidity != null ? Math.round(row.humidity) : "—"} <span className="text-[10px] text-muted-foreground">%</span>
                        </p>
                      </div>
                      <div className="rounded-xl bg-surface-lowest p-3 ring-1 ring-border/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Battery</p>
                        <p className="text-lg font-black font-headline">
                          {battery != null ? battery : "—"} <span className="text-[10px] text-muted-foreground">%</span>
                        </p>
                      </div>
                      <div className="rounded-xl bg-surface-lowest p-3 ring-1 ring-border/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Pressure</p>
                        <p className="text-lg font-black font-headline">
                          {pm ? formatModulePumpPressure(pm) : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Irrigation Controls */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">Irrigation Control</h3>
                    <div className="flex rounded-lg bg-surface-low p-0.5">
                      <button
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${selectedZone.mode !== "auto" ? "bg-white shadow-sm text-primary" : "text-muted-foreground"}`}
                        onClick={() => updateZone(selectedZone.id, { mode: "manual" })}
                      >
                        MANUAL
                      </button>
                      <button
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${selectedZone.mode === "auto" ? "bg-white shadow-sm text-primary" : "text-muted-foreground"}`}
                        onClick={() => updateZone(selectedZone.id, { mode: "auto" })}
                      >
                        AUTO
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const pumpId = getPrimaryPumpId(selectedZone);
                    const slot = getValveSlot(selectedZone);
                    const running = isZoneActivelyIrrigating(selectedZone, pumpStates);
                    const pending =
                      !!pumpId &&
                      !!pendingCommand &&
                      pendingCommand.moduleId === pumpId &&
                      pendingCommand.status === "pending";
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            className="gap-2 py-3 font-headline font-bold text-sm"
                            disabled={!pumpId || !slot || pending || running}
                            onClick={() => void startZone(selectedZone)}
                          >
                            {pending ? "…" : "Start"}
                          </Button>
                          <Button
                            variant="destructive"
                            className="gap-2 py-3 font-headline font-bold text-sm"
                            disabled={!pumpId || pending || !running}
                            onClick={() => void stopZone(selectedZone)}
                          >
                            {pending ? "…" : "Stop"}
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Manual Valve Override</label>
                          <div className="grid grid-cols-2 gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-[10px] font-bold"
                              disabled={!pumpId || pending}
                              onClick={() => void openValvesOnlyZone(selectedZone)}
                            >
                              Open Valves
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-[10px] font-bold"
                              disabled={!pumpId || pending}
                              onClick={() => void closeValvesOnlyZone(selectedZone)}
                            >
                              Close Valves
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Timer Options</label>
                          <div className="flex gap-1">
                            {[{ m: 30, l: "30m" }, { m: 60, l: "1h" }, { m: 120, l: "2h" }].map(({ m, l }) => (
                              <button
                                key={m}
                                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-colors ${
                                  durationMin === m
                                    ? "bg-primary/10 ring-1 ring-primary/20 text-primary"
                                    : "ring-1 ring-border/15 text-muted-foreground hover:bg-white"
                                }`}
                                onClick={() => setDurationMin(m)}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Equipment Assignment */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">Equipment</h3>
                  <div className="space-y-1">
                    <Label>Sensor</Label>
                    <select
                      className="flex h-8 w-full rounded-md bg-surface-lowest px-2 text-xs ring-1 ring-border/15 outline-none"
                      value={getZoneSensorId(selectedZone)}
                      onChange={async (e) => {
                        const sensorId = e.target.value;
                        await updateZone(selectedZone.id, { fieldModuleIds: sensorId ? [sensorId] : [] });
                        if (sensorId) {
                          const c = getZoneCenter(selectedZone);
                          if (c) await updateModule(sensorId, { position: c });
                        }
                      }}
                    >
                      <option value="">None</option>
                      {freeSensors.map((m: Module) => (
                        <option key={m.id} value={m.id}>{m.name || m.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Pump / Valve</Label>
                    <select
                      className="flex h-8 w-full rounded-md bg-surface-lowest px-2 text-xs ring-1 ring-border/15 outline-none"
                      value={getZoneValveKey(selectedZone)}
                      onChange={async (e) => {
                        const valveKey = e.target.value;
                        if (!valveKey) {
                          let sectors = cloneSectorsWithoutValveSlot(selectedZone);
                          if (sectors.length === 0) {
                            sectors = [{ id: "sector-main", name: "Secteur principal", polygon: selectedZone.polygon, valveModuleIds: [] }];
                          }
                          await updateZone(selectedZone.id, { pumpModuleIds: [], sectors });
                          return;
                        }
                        const v = parseValveKey(valveKey);
                        if (!v) return;
                        const sectors = cloneSectorsWithValveSlot(selectedZone, v.slot);
                        await updateZone(selectedZone.id, { pumpModuleId: v.pumpId, pumpModuleIds: [v.pumpId], sectors });
                        const c = getZoneCenter(selectedZone);
                        if (c) await updateModule(v.pumpId, { position: c });
                      }}
                    >
                      <option value="">None</option>
                      {valveOptions.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full text-[10px] uppercase tracking-widest"
                  onClick={async () => {
                    await removeZone(selectedZone.id);
                    setSelectedZoneId(null);
                    setNotice("Zone supprimée.");
                  }}
                >
                  Delete Zone
                </Button>
              </>
            ) : (
              /* Zone List */
              <div className="space-y-2">
                {zoneRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No zones yet. Draw one on the map.</p>
                ) : (
                  zoneRows.map((row: IrrigationZoneRow) => {
                    const pid = getPrimaryPumpId(row.zone);
                    const pmod = pid ? modulesWithGatewayStatus.find((m: Module) => m.id === pid) : null;
                    return (
                      <button
                        key={row.zone.id}
                        type="button"
                        onClick={() => setSelectedZoneId(row.zone.id)}
                        className="w-full rounded-xl bg-surface-lowest ring-1 ring-border/10 p-3 text-left hover:bg-white transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold font-headline">{row.zone.name}</p>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                            row.running
                              ? "text-primary ring-1 ring-primary/20"
                              : "text-muted-foreground ring-1 ring-border/15"
                          }`}>
                            {row.running ? "Active" : "Standby"}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Tension {row.tension != null ? `${Math.round(row.tension)} cb` : "—"} · Humidity{" "}
                          {row.humidity != null ? `${Math.round(row.humidity)}%` : "—"}
                          {pmod ? ` · ${formatModulePumpPressure(pmod)}` : ""}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Panel Footer */}
          {selectedZone && isZoneActivelyIrrigating(selectedZone, pumpStates) && (
            <div className="p-3 bg-primary text-white flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest">System Active</span>
              <span className="text-[10px] font-bold uppercase bg-white/20 px-2 py-0.5 rounded-full">Nominal</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile zone panel (below map) — shown on small screens */}
      <div className="absolute bottom-0 left-0 right-0 z-10 lg:hidden max-h-[50vh] overflow-y-auto glass-panel rounded-t-2xl ring-1 ring-border/10 p-4 shadow-2xl">
        {selectedZone ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-base font-bold">{selectedZone.name}</h2>
              <Button size="sm" variant="ghost" onClick={() => setSelectedZoneId(null)}>Back</Button>
            </div>
            {(() => {
              const pumpId = getPrimaryPumpId(selectedZone);
              const slot = getValveSlot(selectedZone);
              const running = isZoneActivelyIrrigating(selectedZone, pumpStates);
              const pending =
                !!pumpId && !!pendingCommand && pendingCommand.moduleId === pumpId && pendingCommand.status === "pending";
              return (
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={!pumpId || !slot || pending || running} onClick={() => void startZone(selectedZone)}>
                    Start
                  </Button>
                  <Button variant="destructive" disabled={!pumpId || pending || !running} onClick={() => void stopZone(selectedZone)}>
                    Stop
                  </Button>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-bold font-headline uppercase tracking-widest text-muted-foreground">Zones</p>
            {zoneRows.map((row: IrrigationZoneRow) => (
              <button
                key={row.zone.id}
                type="button"
                onClick={() => setSelectedZoneId(row.zone.id)}
                className="w-full rounded-lg bg-surface-lowest ring-1 ring-border/10 p-2 text-left"
              >
                <p className="text-xs font-bold">{row.zone.name}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notice toast */}
      {notice && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 glass-panel px-4 py-2 rounded-lg shadow-lg ring-1 ring-border/15">
          <p className="text-xs font-medium">{notice}</p>
        </div>
      )}
    </div>
  );
}

export default function IrrigationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">Chargement…</div>
      }
    >
      <IrrigationPageContent />
    </Suspense>
  );
}
