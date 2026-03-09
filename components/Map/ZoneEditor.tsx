"use client";

import { useState, useCallback } from "react";
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
import type { Zone } from "@/types";
import type { Farm } from "@/types";
import type { Module } from "@/types";

interface ZoneEditorProps {
  zones: Zone[];
  farms: Farm[];
  modules: Module[];
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  onAddZone: (farmId: string, name: string, polygon: Zone["polygon"]) => Promise<string | undefined>;
  onUpdateZone: (
    zoneId: string,
    updates: Partial<
      Pick<
        Zone,
        "name" | "polygon" | "pumpModuleId" | "fieldModuleIds" | "mode" | "autoRules"
      >
    >
  ) => Promise<void>;
  onRemoveZone: (zoneId: string) => Promise<void>;
  drawingZoneId: string | null;
  draftLatLngs: [number, number][];
  onStartDrawing: (zoneId: string) => void;
  onSaveDraft: (zoneId: string) => void;
  onCancelDrawing: () => void;
}

const emptyPolygon: Zone["polygon"] = {
  type: "Polygon",
  coordinates: [[]],
};

export function ZoneEditor({
  zones,
  farms,
  modules,
  selectedZoneId,
  onSelectZone,
  onAddZone,
  onUpdateZone,
  onRemoveZone,
  drawingZoneId,
  draftLatLngs,
  onStartDrawing,
  onSaveDraft,
  onCancelDrawing,
}: ZoneEditorProps) {
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneFarmId, setNewZoneFarmId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingZoneId, setRemovingZoneId] = useState<string | null>(null);

  const selectedZone = selectedZoneId
    ? zones.find((z) => z.id === selectedZoneId)
    : null;
  const pumpModules = modules.filter((m) => m.type === "pump");
  const fieldModules = modules.filter((m) => m.type === "field");

  const handleAddZone = async () => {
    const name = newZoneName.trim();
    const farmId = newZoneFarmId || farms[0]?.id;
    if (!name || !farmId) return;
    setAdding(true);
    try {
      await onAddZone(farmId, name, emptyPolygon);
      setNewZoneName("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Créer une zone</CardTitle>
          <CardDescription>
            Créez une zone puis cliquez sur &quot;Définir le contour&quot; et dessinez sur la carte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Nom de la zone</Label>
            <Input
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              placeholder="ex: Parcelle Nord"
              className="border-border"
            />
          </div>
          {farms.length > 0 && (
            <div className="space-y-2">
              <Label>Ferme</Label>
              <select
                value={newZoneFarmId}
                onChange={(e) => setNewZoneFarmId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Sélectionner</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button onClick={handleAddZone} disabled={adding || !newZoneName.trim()}>
            {adding ? "Création…" : "Créer la zone"}
          </Button>
        </CardContent>
      </Card>

      {zones.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Zones et modules</CardTitle>
            <CardDescription>
              Sélectionnez une zone pour assigner une pompe et des capteurs Champ.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                onClick={() =>
                  onSelectZone(selectedZoneId === zone.id ? null : zone.id)
                }
                className={`w-full rounded-lg border p-3 space-y-2 text-left transition-colors ${
                  selectedZoneId === zone.id
                    ? "border-primary bg-muted/50 ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{zone.name}</span>
                </div>
                {selectedZoneId === zone.id && (
                  <div onClick={(e) => e.stopPropagation()} className="pt-1">
                    {drawingZoneId === zone.id ? (
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          Cliquez sur la carte pour ajouter des points. Cliquez sur un point pour ouvrir le menu (déplacer, coordonnées GPS, supprimer). Glissez un point pour le déplacer. Au moins 3 points.
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => onSaveDraft(zone.id)}
                            disabled={draftLatLngs.length < 3}
                          >
                            Enregistrer le contour
                          </Button>
                          <Button size="sm" variant="outline" onClick={onCancelDrawing}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mb-2"
                        onClick={() => onStartDrawing(zone.id)}
                      >
                        Définir le contour sur la carte
                      </Button>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Module Pompe</Label>
                      <select
                        value={zone.pumpModuleId ?? ""}
                        onChange={(e) =>
                          onUpdateZone(zone.id, {
                            pumpModuleId: e.target.value || undefined,
                          })
                        }
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      >
                        <option value="">Aucun</option>
                        {pumpModules.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} {m.online ? "" : "(hors ligne)"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Modules Champ (capteurs)</Label>
                      <div className="flex flex-wrap gap-2">
                        {fieldModules.map((m) => {
                          const isAssigned = zone.fieldModuleIds.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className="flex items-center gap-1.5 text-sm cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => {
                                  const next = isAssigned
                                    ? zone.fieldModuleIds.filter((id) => id !== m.id)
                                    : [...zone.fieldModuleIds, m.id];
                                  onUpdateZone(zone.id, {
                                    fieldModuleIds: next,
                                  });
                                }}
                                className="rounded border-input"
                              />
                              {m.id}
                            </label>
                          );
                        })}
                        {fieldModules.length === 0 && (
                          <span className="text-muted-foreground text-sm">
                            Aucun module Champ
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        disabled={removingZoneId === zone.id}
                        onClick={async () => {
                          if (!confirm(`Supprimer la zone « ${zone.name} » ?`)) return;
                          setRemovingZoneId(zone.id);
                          try {
                            await onRemoveZone(zone.id);
                            onSelectZone(null);
                          } finally {
                            setRemovingZoneId(null);
                          }
                        }}
                      >
                        {removingZoneId === zone.id ? "Suppression…" : "Supprimer la zone"}
                      </Button>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
