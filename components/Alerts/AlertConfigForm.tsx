"use client";

import { useState, useEffect } from "react";
import type { AlertConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AlertConfigFormProps {
  config: AlertConfig;
  onUpdate: (updates: Partial<AlertConfig>) => Promise<void>;
}

export function AlertConfigForm({ config, onUpdate }: AlertConfigFormProps) {
  const [battery, setBattery] = useState(String(config.batteryThreshold ?? ""));
  const [offline, setOffline] = useState(
    String(config.offlineMinutesThreshold ?? "")
  );
  const [pressure, setPressure] = useState(
    String(config.pressureDropThreshold ?? "")
  );
  const [pressureHigh, setPressureHigh] = useState(
    String(config.pressureHighThreshold ?? "")
  );
  const [autoStop, setAutoStop] = useState(Boolean(config.autoStopOnLowPressure));
  const [autoStopDelay, setAutoStopDelay] = useState(String(config.autoStopLowPressureDelaySec ?? "5"));
  const [autoStopCloseValves, setAutoStopCloseValves] = useState(
    config.autoStopCloseValves ?? true
  );
  const [autoStopHigh, setAutoStopHigh] = useState(Boolean(config.autoStopOnHighPressure));
  const [autoStopHighDelay, setAutoStopHighDelay] = useState(
    String(config.autoStopHighPressureDelaySec ?? "1")
  );
  const [autoStopOpenValves, setAutoStopOpenValves] = useState(
    config.autoStopOpenValves ?? true
  );
  const [stress, setStress] = useState(String(config.stressTensionThreshold ?? "60"));
  const [rearm, setRearm] = useState(String(config.rearmMinutes ?? "1"));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setBattery(String(config.batteryThreshold ?? ""));
    setOffline(String(config.offlineMinutesThreshold ?? ""));
    setPressure(String(config.pressureDropThreshold ?? ""));
    setPressureHigh(String(config.pressureHighThreshold ?? ""));
    setAutoStop(Boolean(config.autoStopOnLowPressure));
    setAutoStopDelay(String(config.autoStopLowPressureDelaySec ?? "5"));
    setAutoStopCloseValves(config.autoStopCloseValves ?? true);
    setAutoStopHigh(Boolean(config.autoStopOnHighPressure));
    setAutoStopHighDelay(String(config.autoStopHighPressureDelaySec ?? "1"));
    setAutoStopOpenValves(config.autoStopOpenValves ?? true);
    setStress(String(config.stressTensionThreshold ?? "60"));
    setRearm(String(config.rearmMinutes ?? "1"));
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        batteryThreshold: battery ? Number(battery) : undefined,
        offlineMinutesThreshold: offline ? Number(offline) : undefined,
        pressureDropThreshold: pressure ? Number(pressure) : undefined,
        pressureHighThreshold: pressureHigh ? Number(pressureHigh) : undefined,
        autoStopOnLowPressure: autoStop ? true : undefined,
        autoStopLowPressureDelaySec: autoStop ? Number(autoStopDelay || "5") : undefined,
        autoStopCloseValves: autoStop ? autoStopCloseValves : undefined,
        autoStopOnHighPressure: autoStopHigh ? true : undefined,
        autoStopHighPressureDelaySec: autoStopHigh ? Number(autoStopHighDelay || "1") : undefined,
        autoStopOpenValves: autoStopHigh ? autoStopOpenValves : undefined,
        stressTensionThreshold: stress ? Number(stress) : undefined,
        rearmMinutes: rearm !== "" ? Number(rearm) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Seuils d&apos;alerte</CardTitle>
        <CardDescription>
          Définissez les seuils pour recevoir des notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="battery">Batterie (alerte si &lt; %)</Label>
          <Input
            id="battery"
            type="number"
            min={0}
            max={100}
            value={battery}
            onChange={(e) => setBattery(e.target.value)}
            placeholder="ex: 10"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offline">Module hors ligne (alerte après min)</Label>
          <Input
            id="offline"
            type="number"
            min={1}
            value={offline}
            onChange={(e) => setOffline(e.target.value)}
            placeholder="ex: 5"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pressure">Chute de pression (pompe)</Label>
          <Input
            id="pressure"
            type="number"
            min={0}
            value={pressure}
            onChange={(e) => setPressure(e.target.value)}
            placeholder="optionnel"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pressureHigh">Surpression (pompe)</Label>
          <Input
            id="pressureHigh"
            type="number"
            min={0}
            value={pressureHigh}
            onChange={(e) => setPressureHigh(e.target.value)}
            placeholder="optionnel (ex: 8)"
            className="border-border"
          />
        </div>
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-sm font-medium">Sécurité pression (Auto‑STOP)</p>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Couper la pompe si pression &lt; seuil</span>
            <input
              type="checkbox"
              checked={autoStop}
              onChange={(e) => setAutoStop(e.target.checked)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="autoStopDelay">Délai (s)</Label>
              <Input
                id="autoStopDelay"
                type="number"
                min={0}
                value={autoStopDelay}
                onChange={(e) => setAutoStopDelay(e.target.value)}
                disabled={!autoStop}
                className="border-border"
              />
            </div>
            <div className="space-y-1">
              <Label>Fermer aussi les vannes</Label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoStopCloseValves}
                  onChange={(e) => setAutoStopCloseValves(e.target.checked)}
                  disabled={!autoStop}
                />
                Oui
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Requiert un seuil « Chute de pression » au-dessus. Si la pompe est en marche et que la
            pression reste sous le seuil pendant le délai, la pompe est coupée automatiquement.
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-sm font-medium">Sécurité surpression</p>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Ouvrir les vannes puis couper la pompe si pression &gt; seuil</span>
            <input
              type="checkbox"
              checked={autoStopHigh}
              onChange={(e) => setAutoStopHigh(e.target.checked)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="autoStopHighDelay">Délai (s)</Label>
              <Input
                id="autoStopHighDelay"
                type="number"
                min={0}
                value={autoStopHighDelay}
                onChange={(e) => setAutoStopHighDelay(e.target.value)}
                disabled={!autoStopHigh}
                className="border-border"
              />
            </div>
            <div className="space-y-1">
              <Label>Ouvrir les vannes</Label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoStopOpenValves}
                  onChange={(e) => setAutoStopOpenValves(e.target.checked)}
                  disabled={!autoStopHigh}
                />
                Oui (VALVE_OPEN)
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Requiert un seuil « Surpression ». Si la pompe est en marche et que la pression reste au‑dessus
            du seuil pendant le délai, le site ouvre les vannes puis coupe la pompe.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stress">Stress hydrique (cb)</Label>
          <Input
            id="stress"
            type="number"
            min={0}
            value={stress}
            onChange={(e) => setStress(e.target.value)}
            placeholder="60"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rearm">Délai avant réarmement (min)</Label>
          <Input
            id="rearm"
            type="number"
            min={0}
            value={rearm}
            onChange={(e) => setRearm(e.target.value)}
            placeholder="1"
            className="border-border"
          />
          <p className="text-xs text-muted-foreground">
            Temps pendant lequel la condition doit être OK avant de pouvoir déclencher à nouveau une alerte (prototypage : 0 = immédiat).
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </CardContent>
    </Card>
  );
}
