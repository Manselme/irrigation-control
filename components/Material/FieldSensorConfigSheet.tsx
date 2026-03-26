"use client";

import type { Module } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FieldSensorConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldModule: Module | null;
}

export function FieldSensorConfigSheet({
  open,
  onOpenChange,
  fieldModule,
}: FieldSensorConfigSheetProps) {
  const hasPos =
    fieldModule?.position?.lat != null &&
    fieldModule?.position?.lng != null &&
    Number.isFinite(fieldModule.position.lat) &&
    Number.isFinite(fieldModule.position.lng);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Module champ — position</SheetTitle>
          <SheetDescription>
            Coordonnées issues des capteurs passerelle (lat/lng dans{" "}
            <span className="font-mono text-[11px]">gateways/…/sensors/…</span>) lorsque le fix GPS est
            actif sur le module terrain.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          {fieldModule?.gatewayId ? (
            <p className="text-muted-foreground">
              Passerelle : <span className="font-mono text-foreground">{fieldModule.gatewayId}</span>
            </p>
          ) : null}
          {fieldModule?.deviceId ? (
            <p className="text-muted-foreground">
              Device ID : <span className="font-mono text-foreground">{fieldModule.deviceId}</span>
            </p>
          ) : null}
          {hasPos ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="font-medium text-foreground">Latitude / longitude (WGS84)</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {fieldModule!.position!.lat.toFixed(6)}, {fieldModule!.position!.lng.toFixed(6)}
              </p>
            </div>
          ) : fieldModule?.gatewayId ? (
            <div className="rounded-lg border border-dashed border-border/60 p-3 text-muted-foreground">
              Pas encore de coordonnées GPS (pas de fix, ou module hors ligne). Vérifiez le BN-220 sur le
              module champ et la liaison LoRa.
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 p-3 text-muted-foreground">
              Associez ce module à une passerelle pour afficher la position reçue par LoRa.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
