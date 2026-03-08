"use client";

import { useState } from "react";
import type { ModuleType } from "@/types";
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
import type { Farm } from "@/types";

const MODULE_TYPES: { value: ModuleType; label: string }[] = [
  { value: "mother", label: "Module Mère" },
  { value: "pump", label: "Module Pompe" },
  { value: "field", label: "Module Champ" },
];

interface AddModuleFormProps {
  farms: Farm[];
  onAdd: (moduleId: string, type: ModuleType, farmId: string) => Promise<void>;
  existingIds: string[];
}

export function AddModuleForm({
  farms,
  onAdd,
  existingIds,
}: AddModuleFormProps) {
  const [moduleId, setModuleId] = useState("");
  const [type, setType] = useState<ModuleType>("field");
  const [farmId, setFarmId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const id = moduleId.trim();
    if (!id) {
      setError("Saisissez l'identifiant du module.");
      return;
    }
    if (existingIds.includes(id)) {
      setError("Ce module est déjà enregistré.");
      return;
    }
    if (!farmId && farms.length > 0) {
      setError("Sélectionnez une ferme.");
      return;
    }
    const targetFarmId = farmId || (farms[0]?.id ?? "");
    if (!targetFarmId) {
      setError("Créez d'abord une ferme.");
      return;
    }
    setLoading(true);
    try {
      await onAdd(id, type, targetFarmId);
      setModuleId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Ajouter un module</CardTitle>
        <CardDescription>
          Saisissez l&apos;identifiant unique du module et son type.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="moduleId">Identifiant du module</Label>
            <Input
              id="moduleId"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              placeholder="ex: ESP32-ABC123"
              className="border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as ModuleType)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {MODULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {farms.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="farmId">Ferme</Label>
              <select
                id="farmId"
                value={farmId}
                onChange={(e) => setFarmId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Sélectionner une ferme</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Ajout…" : "Ajouter le module"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
