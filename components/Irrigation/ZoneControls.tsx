"use client";

import { useMemo, useState, useEffect } from "react";
import type { Zone } from "@/types";
import type { Module } from "@/types";
import { ManualToggles } from "./ManualToggles";
import { AutoModeSwitch } from "./AutoModeSwitch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSuggestion } from "@/lib/irrigationSuggestions";
import type { ForecastDay } from "@/lib/weather";
import { useZoneHumidity } from "@/lib/hooks/useZoneHumidity";
import { useLastCommandState } from "@/lib/hooks/useCommands";
import { CloudRain, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoneControlsProps {
  zone: Zone;
  modules: Module[];
  pumpModule: Module | null;
  userId: string | undefined;
  forecast: ForecastDay[] | null;
  zoneCenter: { lat: number; lng: number } | null;
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
  onUpdateZoneAutoRules: (zoneId: string, autoRules: Zone["autoRules"]) => void;
  onUpdateZoneModules: (
    zoneId: string,
    links: { pumpModuleId?: string; fieldModuleIds: string[] }
  ) => Promise<void>;
}

export function ZoneControls({
  zone,
  modules,
  pumpModule,
  userId,
  forecast,
  zoneCenter,
  pendingCommand,
  onSendCommand,
  onClearPending,
  onZoneModeChange,
  onUpdateZoneAutoRules,
  onUpdateZoneModules,
}: ZoneControlsProps) {
  const humidity = useZoneHumidity(userId, zone.fieldModuleIds ?? [], modules);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoHumidity, setAutoHumidity] = useState(String(zone.autoRules?.minHumidityThreshold ?? "30"));
  const [autoRain, setAutoRain] = useState(String(zone.autoRules?.rainThresholdMm ?? "10"));
  const [autoInterval, setAutoInterval] = useState(String(zone.autoRules?.checkIntervalMinutes ?? "2"));
  const [autoDelay, setAutoDelay] = useState(String(zone.autoRules?.pumpDelayMinutes ?? "0"));
  useEffect(() => {
    setAutoHumidity(String(zone.autoRules?.minHumidityThreshold ?? "30"));
    setAutoRain(String(zone.autoRules?.rainThresholdMm ?? "10"));
    setAutoInterval(String(zone.autoRules?.checkIntervalMinutes ?? "2"));
    setAutoDelay(String(zone.autoRules?.pumpDelayMinutes ?? "0"));
  }, [zone.id, zone.autoRules]);
  const suggestion = useMemo(
    () => getSuggestion(humidity, forecast),
    [humidity, forecast]
  );
  const pumpId = zone.pumpModuleId ?? null;
  const hasFailedCommand =
    pumpId &&
    pendingCommand &&
    pendingCommand.moduleId === pumpId &&
    (pendingCommand.status === "failed" || pendingCommand.status === "timeout");
  const pumpOnline = pumpModule?.online ?? false;
  const gatewayOpts =
    pumpModule?.gatewayId && pumpModule?.deviceId
      ? { gatewayId: pumpModule.gatewayId, deviceId: pumpModule.deviceId }
      : undefined;
  const { pumpOn, valveOpen, valveAOpen, valveBOpen } = useLastCommandState(userId, pumpId, gatewayOpts);
  const [selectedPumpId, setSelectedPumpId] = useState(zone.pumpModuleId ?? "");
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>(zone.fieldModuleIds ?? []);
  const [linksSaving, setLinksSaving] = useState(false);

  useEffect(() => {
    setSelectedPumpId(zone.pumpModuleId ?? "");
    setSelectedFieldIds(zone.fieldModuleIds ?? []);
  }, [zone.id, zone.pumpModuleId, zone.fieldModuleIds]);

  const pumpOptions = useMemo(
    () => modules.filter((m) => m.type === "pump" && m.farmId === zone.farmId),
    [modules, zone.farmId]
  );
  const fieldOptions = useMemo(
    () => modules.filter((m) => m.type === "field" && m.farmId === zone.farmId),
    [modules, zone.farmId]
  );

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{zone.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AutoModeSwitch
          mode={zone.mode}
          onModeChange={(mode) => onZoneModeChange(zone.id, mode)}
        />

        <div className="rounded-md border border-border p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Affectation des modules</p>
          <div className="space-y-1">
            <Label className="text-xs">Pompe de la zone</Label>
            <select
              value={selectedPumpId}
              onChange={(e) => setSelectedPumpId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Aucune pompe</option>
              {pumpOptions.map((pump) => (
                <option key={pump.id} value={pump.id}>
                  {pump.name || pump.id} {pump.online ? "(en ligne)" : "(hors ligne)"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Capteurs de champ associés</Label>
            {fieldOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun capteur disponible dans cet espace.</p>
            ) : (
              <div className="grid gap-1">
                {fieldOptions.map((field) => {
                  const checked = selectedFieldIds.includes(field.id);
                  return (
                    <label
                      key={field.id}
                      className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm"
                    >
                      <span>{field.name || field.id}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSelectedFieldIds((prev) =>
                            isChecked ? [...prev, field.id] : prev.filter((id) => id !== field.id)
                          );
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <Button
            size="sm"
            disabled={linksSaving}
            onClick={async () => {
              setLinksSaving(true);
              await onUpdateZoneModules(zone.id, {
                pumpModuleId: selectedPumpId || undefined,
                fieldModuleIds: selectedFieldIds,
              });
              setLinksSaving(false);
            }}
          >
            {linksSaving ? "Enregistrement…" : "Enregistrer affectation"}
          </Button>
        </div>

        {zone.mode === "manual" && (
          <>
            <div
              className={cn(
                "rounded-md border border-border p-3 text-sm",
                suggestion.discouraged && "border-amber-500/50 bg-amber-50/50"
              )}
            >
              <p className="flex items-center gap-2 text-muted-foreground">
                {suggestion.discouraged ? (
                  <CloudRain className="h-4 w-4 text-amber-600" />
                ) : (
                  <Droplets className="h-4 w-4" />
                )}
                {suggestion.text}
              </p>
            </div>
            {hasFailedCommand ? (
              <p className="text-xs text-destructive">
                Dernière commande non confirmée (échec ou délai). Les contrôles restent disponibles ; vérifiez la
                passerelle ou réessayez.
              </p>
            ) : null}
            <ManualToggles
              pumpModuleId={pumpId}
              pumpOnline={pumpOnline}
              pumpOn={pumpOn}
              valveOpen={valveOpen}
              valveAOpen={valveAOpen}
              valveBOpen={valveBOpen}
              pendingCommand={pendingCommand}
              onSendCommand={onSendCommand}
              onClearPending={onClearPending}
            />
          </>
        )}

        {zone.mode === "auto" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Le système pilote l&apos;irrigation selon l&apos;humidité du sol et la météo.
            </p>
            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Paramètres (prototypage)</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Seuil humidité min (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={autoHumidity}
                    onChange={(e) => setAutoHumidity(e.target.value)}
                    className="h-8 text-sm border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pluie max (mm)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={autoRain}
                    onChange={(e) => setAutoRain(e.target.value)}
                    className="h-8 text-sm border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vérification (min)</Label>
                  <Input
                    type="number"
                    min={0.25}
                    max={60}
                    step={0.25}
                    value={autoInterval}
                    onChange={(e) => setAutoInterval(e.target.value)}
                    className="h-8 text-sm border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Délai pompe (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={autoDelay}
                    onChange={(e) => setAutoDelay(e.target.value)}
                    className="h-8 text-sm border-border"
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={autoSaving}
                onClick={async () => {
                  setAutoSaving(true);
                  const raw = {
                    ...zone.autoRules,
                    minHumidityThreshold: autoHumidity !== "" ? Number(autoHumidity) : undefined,
                    rainThresholdMm: autoRain !== "" ? Number(autoRain) : undefined,
                    checkIntervalMinutes: autoInterval !== "" ? Number(autoInterval) : undefined,
                    pumpDelayMinutes: autoDelay !== "" ? Number(autoDelay) : undefined,
                  };
                  const autoRules = Object.fromEntries(
                    Object.entries(raw).filter(([, v]) => v !== undefined)
                  ) as Zone["autoRules"];
                  await onUpdateZoneAutoRules(zone.id, autoRules);
                  setAutoSaving(false);
                }}
              >
                {autoSaving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

