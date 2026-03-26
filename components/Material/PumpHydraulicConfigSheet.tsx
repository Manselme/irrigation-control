"use client";

import { useEffect, useState } from "react";
import type { Module } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface PumpHydraulicConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pump: Module | null;
  onSave: (
    moduleId: string,
    updates: Pick<Module, "hydraulicSettings" | "valves">
  ) => Promise<void>;
}

export function PumpHydraulicConfigSheet({
  open,
  onOpenChange,
  pump,
  onSave,
}: PumpHydraulicConfigSheetProps) {
  const [pipeDiameterMm, setPipeDiameterMm] = useState("");
  const [referencePressureBar, setReferencePressureBar] = useState("");
  const [valveAName, setValveAName] = useState("");
  const [valveBName, setValveBName] = useState("");
  const [flowRateLitersPerMinute, setFlowRateLitersPerMinute] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPipeDiameterMm(
      pump?.hydraulicSettings?.pipeDiameterMm != null
        ? String(pump.hydraulicSettings.pipeDiameterMm)
        : ""
    );
    setReferencePressureBar(
      pump?.hydraulicSettings?.referencePressureBar != null
        ? String(pump.hydraulicSettings.referencePressureBar)
        : ""
    );
    setFlowRateLitersPerMinute(
      pump?.hydraulicSettings?.flowRateLitersPerMinute != null
        ? String(pump.hydraulicSettings.flowRateLitersPerMinute)
        : ""
    );
    setValveAName(pump?.valves?.A?.name ?? "Vanne A");
    setValveBName(pump?.valves?.B?.name ?? "Vanne B");
  }, [pump?.id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Configuration hydraulique</SheetTitle>
          <SheetDescription>
            Parametrez le débit et le calculateur hydraulique pour {pump?.name || pump?.id || "la pompe"}.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="flowRateLitersPerMinute">Débit pompe (litres / minute)</Label>
            <Input
              id="flowRateLitersPerMinute"
              type="number"
              min={0.1}
              step={0.5}
              value={flowRateLitersPerMinute}
              onChange={(e) => setFlowRateLitersPerMinute(e.target.value)}
              placeholder="ex. 120"
            />
            <p className="text-[11px] text-muted-foreground">
              Utilisé pour estimer le volume d&apos;eau (litres) pendant une marche pompe et pour les jours sans
              volume renvoyé par le matériel (seulement les minutes).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pipeDiameterMm">Diametre interne (mm)</Label>
            <Input
              id="pipeDiameterMm"
              type="number"
              min={1}
              value={pipeDiameterMm}
              onChange={(e) => setPipeDiameterMm(e.target.value)}
              placeholder="63"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referencePressureBar">Pression de reference (bar)</Label>
            <Input
              id="referencePressureBar"
              type="number"
              min={0}
              step={0.1}
              value={referencePressureBar}
              onChange={(e) => setReferencePressureBar(e.target.value)}
              placeholder="3.2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valveAName">Nom logique vanne A</Label>
            <Input
              id="valveAName"
              value={valveAName}
              onChange={(e) => setValveAName(e.target.value)}
              placeholder="Secteur Nord"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valveBName">Nom logique vanne B</Label>
            <Input
              id="valveBName"
              value={valveBName}
              onChange={(e) => setValveBName(e.target.value)}
              placeholder="Secteur Sud"
            />
          </div>
          <Button
            disabled={!pump || saving}
            onClick={async () => {
              if (!pump) return;
              setSaving(true);
              try {
                const nextHydraulic: Record<string, unknown> = {
                  ...pump.hydraulicSettings,
                  pipeDiameterMm:
                    pipeDiameterMm.trim() !== "" ? Number(pipeDiameterMm) : undefined,
                  referencePressureBar:
                    referencePressureBar.trim() !== "" ? Number(referencePressureBar) : undefined,
                  flowRateLitersPerMinute:
                    flowRateLitersPerMinute.trim() !== ""
                      ? Number(flowRateLitersPerMinute)
                      : undefined,
                  updatedAt: Date.now(),
                };
                const hydraulicSettings = Object.fromEntries(
                  Object.entries(nextHydraulic).filter(([, v]) => v !== undefined)
                ) as Module["hydraulicSettings"];
                await onSave(pump.id, {
                  hydraulicSettings,
                  valves: {
                    A: { ...(pump.valves?.A ?? {}), name: valveAName || "Vanne A" },
                    B: { ...(pump.valves?.B ?? {}), name: valveBName || "Vanne B" },
                  },
                });
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

