"use client";

import { useEffect, useMemo, useState } from "react";
import type { Module, Zone } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AutoModeSwitch } from "@/components/Irrigation/AutoModeSwitch";
import { ManualToggles } from "@/components/Irrigation/ManualToggles";
import { useLastCommandState } from "@/lib/hooks/useCommands";
import { formatRelativeTime } from "@/lib/time";
import { resolveGatewaySendCommandOpts } from "@/lib/gatewayDevicePaths";

type ActionTab = "pilot" | "diagnostic" | "sectors";

interface IrrigationActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  zone: Zone | null;
  modules: Module[];
  selectedSectorId: string | null;
  onSectorSelect: (sectorId: string | null) => void;
  pendingCommand: { moduleId: string; type: string; status: string } | null;
  onSendCommand: (
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
  ) => void;
  onClearPending: () => void;
  onZoneModeChange: (zoneId: string, mode: "manual" | "auto") => void;
  onUpdateSectorValve: (
    zoneId: string,
    sectorId: string,
    action: "open" | "close"
  ) => void;
  sensorByModuleId: Record<
    string,
    {
      battery?: number;
      tension_cb?: number;
      humidity?: number;
      humidity_10cm?: number;
      humidity_30cm?: number;
      timestamp?: number;
    } | null
  >;
  timedDurationMinutes: number;
  onTimedDurationChange: (minutes: number) => void;
  onStartTimedWatering: () => void;
  timedWateringEndsAt: number | null;
  timedWateringPumpName: string | null;
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

export function IrrigationActionSheet({
  open,
  onOpenChange,
  userId,
  zone,
  modules,
  selectedSectorId,
  onSectorSelect,
  pendingCommand,
  onSendCommand,
  onClearPending,
  onZoneModeChange,
  onUpdateSectorValve,
  sensorByModuleId,
  timedDurationMinutes,
  onTimedDurationChange,
  onStartTimedWatering,
  timedWateringEndsAt,
  timedWateringPumpName,
}: IrrigationActionSheetProps) {
  const [activeTab, setActiveTab] = useState<ActionTab>("pilot");
  const [nowTs, setNowTs] = useState(Date.now());

  const zonePumpIds = useMemo(() => {
    if (!zone) return [];
    if (zone.pumpModuleIds?.length) return zone.pumpModuleIds;
    if (zone.pumpModuleId) return [zone.pumpModuleId];
    return [];
  }, [zone]);

  const zonePumpModules = useMemo(
    () =>
      zonePumpIds
        .map((id) => modules.find((m) => m.id === id))
        .filter((m): m is Module => m != null),
    [zonePumpIds, modules]
  );
  const mainPump = zonePumpModules[0] ?? null;
  const gatewayOpts = resolveGatewaySendCommandOpts(mainPump);
  const { pumpOn, valveOpen, valveAOpen, valveBOpen, lastPumpOnAt } = useLastCommandState(
    userId,
    mainPump?.id ?? null,
    gatewayOpts
  );
  const sectors = zone ? getEffectiveSectors(zone) : [];
  const diagnosticModules = useMemo(() => {
    if (!zone) return [];
    const ids = Array.from(
      new Set([
        ...(zone.fieldModuleIds ?? []),
        ...(zone.pumpModuleIds ?? []),
        ...(zone.valveModuleIds ?? []),
        ...(zone.pumpModuleId ? [zone.pumpModuleId] : []),
      ])
    );
    return ids
      .map((id) => modules.find((m) => m.id === id))
      .filter((m): m is Module => m != null);
  }, [zone, modules]);

  useEffect(() => {
    if (!zone || !timedWateringEndsAt) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [zone, timedWateringEndsAt]);

  if (!zone) return null;

  const remainingMs = timedWateringEndsAt ? Math.max(0, timedWateringEndsAt - nowTs) : 0;
  const remainingMin = Math.ceil(remainingMs / 60000);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed bottom-0 left-0 right-0 top-auto z-50 h-[82vh] w-full translate-x-0 translate-y-0 rounded-t-2xl border border-border bg-background p-0 sm:left-auto sm:right-4 sm:top-20 sm:h-[78vh] sm:max-w-xl sm:rounded-xl sm:translate-x-0 sm:translate-y-0">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="text-base sm:text-lg">{zone.name}</DialogTitle>
          <DialogDescription>
            Centre d'action de la zone: pilotage, diagnostic et secteurs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b border-border px-4 py-3">
          <Button
            size="sm"
            variant={activeTab === "pilot" ? "default" : "outline"}
            onClick={() => setActiveTab("pilot")}
          >
            Piloter
          </Button>
          <Button
            size="sm"
            variant={activeTab === "diagnostic" ? "default" : "outline"}
            onClick={() => setActiveTab("diagnostic")}
          >
            Diagnostic
          </Button>
          <Button
            size="sm"
            variant={activeTab === "sectors" ? "default" : "outline"}
            onClick={() => setActiveTab("sectors")}
          >
            Secteurs
          </Button>
        </div>

        <div className="h-[calc(82vh-132px)] overflow-y-auto px-4 py-4 sm:h-[calc(78vh-132px)]">
          {activeTab === "pilot" && (
            <div className="space-y-4">
              <AutoModeSwitch
                mode={zone.mode}
                onModeChange={(mode) => onZoneModeChange(zone.id, mode)}
              />

              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm font-medium">Commande manuelle</p>
                <ManualToggles
                  pumpModuleId={mainPump?.id ?? null}
                  pumpOnline={mainPump?.online ?? false}
                  pumpOn={pumpOn}
                  valveOpen={valveOpen}
                  valveAOpen={valveAOpen}
                  valveBOpen={valveBOpen}
                  pendingCommand={pendingCommand}
                  onSendCommand={onSendCommand}
                  onClearPending={onClearPending}
                  timedDurationMinutes={timedDurationMinutes}
                  timedEndsAt={timedWateringEndsAt}
                  onTimedDurationChange={onTimedDurationChange}
                  onStartTimedWatering={onStartTimedWatering}
                />
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>
                    Etat courant: {pumpOn ? "En cours d'irrigation" : "A l'arret"}.
                  </p>
                  <p>Vannes: A {valveAOpen ? "ON" : "OFF"} - B {valveBOpen ? "ON" : "OFF"}.</p>
                  <p>
                    Timer actif:{" "}
                    {timedWateringEndsAt
                      ? `${remainingMin} min restantes sur ${timedWateringPumpName ?? "pompe"}`
                      : "aucun"}
                    .
                  </p>
                  <p>
                    Dernier demarrage confirme:{" "}
                    {lastPumpOnAt ? formatRelativeTime(lastPumpOnAt) : "indisponible"}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "diagnostic" && (
            <div className="space-y-3">
              {diagnosticModules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun module lie a cette zone.</p>
              ) : (
                diagnosticModules.map((mod) => {
                  const sensor = sensorByModuleId[mod.id] ?? null;
                  return (
                    <div key={mod.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{mod.name || mod.id}</p>
                        <span
                          className={
                            mod.online ? "text-xs text-emerald-700" : "text-xs text-muted-foreground"
                          }
                        >
                          {mod.online ? "En ligne" : "Hors ligne"}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <p>Batterie: {sensor?.battery ?? mod.battery ?? "--"}%</p>
                        <p>Tension sol: {sensor?.tension_cb ?? "--"} cb</p>
                        <p>Humidite: {sensor?.humidity ?? "--"}%</p>
                        <p>Derniere vue: {formatRelativeTime(mod.lastSeen)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "sectors" && (
            <div className="space-y-3">
              {sectors.map((sector) => (
                <div key={sector.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{sector.name}</p>
                    <Button
                      size="sm"
                      variant={selectedSectorId === sector.id ? "default" : "outline"}
                      onClick={() => onSectorSelect(sector.id)}
                    >
                      {selectedSectorId === sector.id ? "Selectionne" : "Selectionner"}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Activez la vanne/pompe de ce secteur individuellement
                    {sector.valveSlot ? ` (Vanne ${sector.valveSlot})` : ""}.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateSectorValve(zone.id, sector.id, "open")}
                      disabled={!mainPump}
                    >
                      Ouvrir secteur
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateSectorValve(zone.id, sector.id, "close")}
                      disabled={!mainPump}
                    >
                      Fermer secteur
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

