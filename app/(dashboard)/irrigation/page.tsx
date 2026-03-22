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
import type { Zone } from "@/types";
import { resolveGatewaySendCommandOpts } from "@/lib/gatewayDevicePaths";

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

function getValveSlot(zone: Zone): "A" | "B" | null {
  const s = zone.sectors?.[0]?.valveSlot;
  if (s === "A" || s === "B") return s;
  const hasPump = !!(zone.pumpModuleId || (zone.pumpModuleIds && zone.pumpModuleIds.length > 0));
  if (hasPump) return "A";
  return null;
}

/** Clé unique pompe+vanne pour l'UI (ex. POMPE-xxx:A). */
function getZoneValveKey(zone: Zone): string {
  const p = getPrimaryPumpId(zone);
  const sl = getValveSlot(zone);
  if (!p || !sl) return "";
  return `${p}:${sl}`;
}

function parseValveKey(valveKey: string): { pumpId: string; slot: "A" | "B" } | null {
  const [pumpIdRaw, slotRaw] = valveKey.split(":");
  const pumpId = (pumpIdRaw || "").trim();
  if (!pumpId || (slotRaw !== "A" && slotRaw !== "B")) return null;
  return { pumpId, slot: slotRaw };
}

function cloneSectorsWithValveSlot(zone: Zone, slot: "A" | "B"): NonNullable<Zone["sectors"]> {
  if (zone.sectors?.length) {
    return zone.sectors.map((s, i) =>
      i === 0 ? { ...s, valveSlot: slot } : { ...s }
    );
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
  const list = (zone.sectors?.length ? zone.sectors : []).map((s) => ({ ...s }));
  if (list[0]) {
    const s0 = { ...list[0] };
    delete (s0 as { valveSlot?: "A" | "B" }).valveSlot;
    list[0] = s0;
  }
  return list;
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
  return st.valveOpen;
}

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
    slot: "A" | "B" | null;
    endsAt: number;
  } | null>(null);
  const timedStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fieldModules = useMemo(
    () => modulesWithGatewayStatus.filter((m) => m.type === "field"),
    [modulesWithGatewayStatus]
  );
  const pumpModules = useMemo(
    () => modulesWithGatewayStatus.filter((m) => m.type === "pump"),
    [modulesWithGatewayStatus]
  );

  const latestSensorByModule = useLatestSensorMap(user?.uid, fieldModules);
  const allPumpRefs = useMemo(
    () =>
      pumpModules.map((p) => ({
        moduleId: p.id,
        gatewayId: p.gatewayId,
        deviceId: p.deviceId,
        moduleType: p.type,
        factoryId: p.factoryId,
      })),
    [pumpModules]
  );
  const pumpStates = useAllPumpStates(user?.uid, allPumpRefs);

  const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) ?? null : null;

  useEffect(() => {
    const z = searchParams.get("zone");
    if (z && zones.some((x) => x.id === z)) setSelectedZoneId(z);
  }, [searchParams, zones]);

  useEffect(() => {
    if (selectedZoneId && !zones.some((z) => z.id === selectedZoneId)) setSelectedZoneId(null);
  }, [selectedZoneId, zones]);

  const thresholdCb = alertConfig?.stressTensionThreshold ?? 60;
  const zoneRows = useMemo(
    () =>
      zones
        .map((zone) => {
          const st = zoneStress(zone, latestSensorByModule, thresholdCb);
          const running = isZoneActivelyIrrigating(zone, pumpStates);
          return { zone, ...st, running };
        })
        .sort((a, b) => b.stress - a.stress),
    [zones, latestSensorByModule, thresholdCb, pumpStates]
  );

  const zoneMapStyles = useMemo(() => {
    const styles: Record<string, { color: string; fillColor: string; fillOpacity: number; weight: number }> = {};
    zoneRows.forEach((r) => {
      if (r.stress >= 70) styles[r.zone.id] = { color: "#b91c1c", fillColor: "#f87171", fillOpacity: 0.35, weight: 2 };
      else if (r.stress >= 40)
        styles[r.zone.id] = { color: "#b45309", fillColor: "#fbbf24", fillOpacity: 0.28, weight: 2 };
      else styles[r.zone.id] = { color: "#047857", fillColor: "#86efac", fillOpacity: 0.2, weight: 2 };
    });
    return styles;
  }, [zoneRows]);

  const pumpValveFillByModuleId = useMemo(() => {
    const acc: Record<string, { A?: string; B?: string }> = {};
    zoneRows.forEach((r) => {
      const pumpId = getPrimaryPumpId(r.zone);
      const slot = getValveSlot(r.zone);
      if (!pumpId || !slot) return;
      const fill = zoneMapStyles[r.zone.id]?.fillColor;
      if (!fill) return;
      acc[pumpId] = acc[pumpId] ?? {};
      if (slot === "A") acc[pumpId].A = fill;
      else acc[pumpId].B = fill;
    });
    return acc;
  }, [zoneRows, zoneMapStyles]);

  const assignedSensorIds = useMemo(
    () => new Set(zones.map((z) => getZoneSensorId(z)).filter(Boolean)),
    [zones]
  );

  const assignedValveKeys = useMemo(
    () => new Set(zones.map((z) => getZoneValveKey(z)).filter(Boolean)),
    [zones]
  );

  const freeSensors = useMemo(
    () =>
      fieldModules.filter((m) => {
        if (selectedZone && getZoneSensorId(selectedZone) === m.id) return true;
        return !assignedSensorIds.has(m.id);
      }),
    [fieldModules, selectedZone, assignedSensorIds]
  );

  const valveOptions = useMemo(() => {
    const opts: Array<{ id: string; label: string; pumpId: string }> = [];
    pumpModules.forEach((pump) => {
      (["A", "B"] as const).forEach((slot) => {
        const id = `${pump.id}:${slot}`;
        if (selectedZone && getZoneValveKey(selectedZone) === id) {
          opts.push({ id, label: `${pump.name || pump.id} (Vanne ${slot})`, pumpId: pump.id });
          return;
        }
        if (!assignedValveKeys.has(id)) {
          opts.push({ id, label: `${pump.name || pump.id} (Vanne ${slot})`, pumpId: pump.id });
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
      const mod = modulesWithGatewayStatus.find((m) => m.id === moduleId);
      const opts = resolveGatewaySendCommandOpts(mod);
      await sendCommand(moduleId, type, opts);
    },
    [modulesWithGatewayStatus, sendCommand]
  );

  const startZone = useCallback(
    async (zone: Zone) => {
      const pumpId = getPrimaryPumpId(zone);
      const slot = getValveSlot(zone);
      if (!pumpId || !slot) {
        setNotice("Associez une pompe et une vanne (A ou B) à cette zone.");
        return;
      }
      try {
        const r1 = await sendForPump(pumpId, "PUMP_ON");
        if (r1 === "failed" || r1 === "timeout") {
          setNotice(
            r1 === "timeout"
              ? "Pas de confirmation de la passerelle (délai). Vérifiez la mère et le module pompe."
              : "La passerelle a signalé un échec pour la pompe."
          );
          return;
        }
        const r2 =
          slot === "A" ? await sendForPump(pumpId, "VALVE_A_OPEN") : await sendForPump(pumpId, "VALVE_B_OPEN");
        if (r2 === "failed" || r2 === "timeout") {
          setNotice(
            r2 === "timeout"
              ? "Pompe OK, mais pas de confirmation pour la vanne (délai)."
              : "Pompe OK, mais la vanne a échoué côté passerelle."
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

  const stopZone = useCallback(
    async (zone: Zone) => {
      const pumpId = getPrimaryPumpId(zone);
      const slot = getValveSlot(zone);
      if (!pumpId) return;
      if (slot === "A") await sendForPump(pumpId, "VALVE_A_CLOSE");
      else if (slot === "B") await sendForPump(pumpId, "VALVE_B_CLOSE");
      else await sendForPump(pumpId, "VALVE_CLOSE");
      await sendForPump(pumpId, "PUMP_OFF");
      setTimedWatering(null);
      setNotice("Irrigation stoppée.");
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
        if (slot === "A") await sendForPump(pumpId, "VALVE_A_CLOSE");
        else if (slot === "B") await sendForPump(pumpId, "VALVE_B_CLOSE");
        else await sendForPump(pumpId, "VALVE_CLOSE");
        await sendForPump(pumpId, "PUMP_OFF");
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Irrigation &amp; Zones</h1>
          <p className="text-muted-foreground">Édition simplifiée et pilotage direct.</p>
        </div>
        {farms.length > 1 ? (
          <select
            value={selectedFarmId ?? ""}
            onChange={(e) => setSelectedFarmId(e.target.value || null)}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Tous les espaces</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[65%,35%]">
        <div className="min-w-0">
          <div className="h-[74vh] overflow-hidden rounded-xl border border-slate-200 bg-white">
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
        </div>

        <aside className="min-w-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 lg:h-[74vh]">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Création &amp; affectation</p>
            <div className="space-y-2">
              <Label>Nom de la zone</Label>
              <Input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Ex: Champ de maïs"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={isDrawing ? "default" : "outline"} onClick={() => setIsDrawing((p) => !p)}>
                  {isDrawing ? "Arrêter dessin" : "Dessiner sur la carte"}
                </Button>
                <Button
                  size="sm"
                  onClick={saveNewZone}
                  disabled={creatingZone || !newZoneName.trim() || draftLatLngs.length < 3}
                >
                  {creatingZone ? "Création…" : "+ Nouvelle zone"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraftLatLngs((prev) => prev.slice(0, -1))}
                  disabled={draftLatLngs.length === 0}
                >
                  Annuler point
                </Button>
              </div>
              {isDrawing ? (
                <p className="text-xs text-muted-foreground">Cliquez sur la carte : {draftLatLngs.length} points</p>
              ) : null}
            </div>
          </div>

          <div className="my-4 border-t" />

          {selectedZone ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{selectedZone.name}</h2>
                <Button size="sm" variant="outline" onClick={() => setSelectedZoneId(null)}>
                  Retour zones
                </Button>
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Matériel associé</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Capteur</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                      <option value="">Aucun capteur</option>
                      {freeSensors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Pompe / vanne</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={getZoneValveKey(selectedZone)}
                      onChange={async (e) => {
                        const valveKey = e.target.value;
                        if (!valveKey) {
                          let sectors = cloneSectorsWithoutValveSlot(selectedZone);
                          if (sectors.length === 0) {
                            sectors = [
                              {
                                id: "sector-main",
                                name: "Secteur principal",
                                polygon: selectedZone.polygon,
                                valveModuleIds: [],
                              },
                            ];
                          }
                          await updateZone(selectedZone.id, { pumpModuleIds: [], sectors });
                          return;
                        }
                        const v = parseValveKey(valveKey);
                        if (!v) return;
                        const sectors = cloneSectorsWithValveSlot(selectedZone, v.slot);
                        await updateZone(selectedZone.id, {
                          pumpModuleId: v.pumpId,
                          pumpModuleIds: [v.pumpId],
                          sectors,
                        });
                        const c = getZoneCenter(selectedZone);
                        if (c) await updateModule(v.pumpId, { position: c });
                      }}
                    >
                      <option value="">Aucune vanne</option>
                      {valveOptions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Santé du sol</p>
                {(() => {
                  const row = zoneRows.find((r) => r.zone.id === selectedZone.id);
                  const battery = getZoneSensorId(selectedZone)
                    ? modulesWithGatewayStatus.find((m) => m.id === getZoneSensorId(selectedZone))?.battery
                    : undefined;
                  const stress = row?.stress ?? 0;
                  const barClass =
                    stress >= 70 ? "bg-red-500" : stress >= 40 ? "bg-amber-500" : "bg-emerald-500";
                  return (
                    <div className="mt-2 space-y-2 text-sm">
                      <p>Tension : {row?.tension != null ? `${Math.round(row.tension)} cb` : "—"}</p>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full ${barClass}`}
                          style={{ width: `${Math.max(8, Math.min(100, stress))}%` }}
                        />
                      </div>
                      <p>Batterie capteur : {battery != null ? `${battery}%` : "—"}</p>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Contrôle irrigation</p>
                {(() => {
                  const pumpId = getPrimaryPumpId(selectedZone);
                  const slot = getValveSlot(selectedZone);
                  const running = isZoneActivelyIrrigating(selectedZone, pumpStates);
                  const pending =
                    !!pumpId &&
                    !!pendingCommand &&
                    pendingCommand.moduleId === pumpId &&
                    pendingCommand.status === "pending";
                  const linkedLabel = pumpId
                    ? `${modulesWithGatewayStatus.find((m) => m.id === pumpId)?.name || pumpId}${slot ? ` (Vanne ${slot})` : ""}`
                    : "Aucune";
                  return (
                    <div className="mt-2 space-y-3">
                      <p className="text-sm text-muted-foreground">Lié à : {linkedLabel}</p>
                      <Button
                        className="w-full"
                        size="lg"
                        variant={running ? "destructive" : "default"}
                        disabled={!pumpId || !slot || pending}
                        onClick={() => {
                          void (running ? stopZone(selectedZone) : startZone(selectedZone));
                        }}
                      >
                        {pending ? "Envoi…" : running ? "STOPPER" : "DÉMARRER"}
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={durationMin === 30 ? "default" : "outline"}
                          onClick={() => setDurationMin(30)}
                        >
                          30 min
                        </Button>
                        <Button
                          size="sm"
                          variant={durationMin === 60 ? "default" : "outline"}
                          onClick={() => setDurationMin(60)}
                        >
                          1 h
                        </Button>
                        <Button
                          size="sm"
                          variant={durationMin === 120 ? "default" : "outline"}
                          onClick={() => setDurationMin(120)}
                        >
                          2 h
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Mode auto</p>
                  <Button
                    size="sm"
                    variant={selectedZone.mode === "auto" ? "default" : "outline"}
                    onClick={() =>
                      updateZone(selectedZone.id, {
                        mode: selectedZone.mode === "auto" ? "manual" : "auto",
                      })
                    }
                  >
                    {selectedZone.mode === "auto" ? "Auto : ON" : "Auto : OFF"}
                  </Button>
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await removeZone(selectedZone.id);
                  setSelectedZoneId(null);
                  setNotice("Zone supprimée.");
                }}
              >
                Supprimer la zone
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Zones</p>
              {zoneRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune zone pour le moment.</p>
              ) : (
                zoneRows.map((row) => (
                  <button
                    key={row.zone.id}
                    type="button"
                    onClick={() => setSelectedZoneId(row.zone.id)}
                    className="w-full rounded-lg border p-3 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.zone.name}</p>
                      <span className={`text-xs ${row.running ? "text-indigo-700" : "text-slate-500"}`}>
                        {row.running ? "En cours" : "À l'arrêt"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tension {row.tension != null ? `${Math.round(row.tension)} cb` : "—"} · Humidité{" "}
                      {row.humidity != null ? `${Math.round(row.humidity)}%` : "—"}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}

          {notice ? <p className="mt-4 text-xs text-muted-foreground">{notice}</p> : null}
        </aside>
      </section>
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
