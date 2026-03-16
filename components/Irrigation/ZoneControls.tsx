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
  onSendCommand: (moduleId: string, type: "VALVE_OPEN" | "VALVE_CLOSE" | "PUMP_ON" | "PUMP_OFF") => void;
  onClearPending: () => void;
  onZoneModeChange: (zoneId: string, mode: "manual" | "auto") => void;
  onUpdateZoneAutoRules: (zoneId: string, autoRules: Zone["autoRules"]) => void;
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
  const pumpOnline = (pumpModule?.online ?? false) && !hasFailedCommand;
  const gatewayOpts =
    pumpModule?.gatewayId && pumpModule?.deviceId
      ? { gatewayId: pumpModule.gatewayId, deviceId: pumpModule.deviceId }
      : undefined;
  const { pumpOn, valveOpen } = useLastCommandState(userId, pumpId, gatewayOpts);

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
            <ManualToggles
              pumpModuleId={pumpId}
              pumpOnline={pumpOnline}
              pumpOn={pumpOn}
              valveOpen={valveOpen}
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
