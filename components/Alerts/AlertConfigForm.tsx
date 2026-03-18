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
  const [stress, setStress] = useState(String(config.stressTensionThreshold ?? "60"));
  const [rearm, setRearm] = useState(String(config.rearmMinutes ?? "1"));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setBattery(String(config.batteryThreshold ?? ""));
    setOffline(String(config.offlineMinutesThreshold ?? ""));
    setPressure(String(config.pressureDropThreshold ?? ""));
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
