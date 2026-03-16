"use client";

import { useState } from "react";
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

const GATEWAY_ID_REGEX = /^MERE-[0-9A-Fa-f]{8}$/;

interface AddGatewayFormProps {
  farms: Farm[];
  onAdd: (gatewayId: string, farmId: string, name?: string) => Promise<void>;
  existingGatewayIds: string[];
}

export function AddGatewayForm({
  farms,
  onAdd,
  existingGatewayIds,
}: AddGatewayFormProps) {
  const [gatewayId, setGatewayId] = useState("");
  const [farmId, setFarmId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const id = gatewayId.trim().toUpperCase();
    if (!GATEWAY_ID_REGEX.test(id)) {
      setError("ID invalide. Format : MERE- puis 8 caractères hex (ex. MERE-A842E35C).");
      return;
    }
    if (existingGatewayIds.includes(id)) {
      setError("Cette passerelle est déjà ajoutée.");
      return;
    }
    const targetFarmId = (farmId || farms[0]?.id) ?? "";
    if (!targetFarmId) {
      setError("Créez d'abord une ferme.");
      return;
    }
    setLoading(true);
    try {
      await onAdd(id, targetFarmId, name.trim() || undefined);
      setGatewayId("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Ajouter une Passerelle</CardTitle>
        <CardDescription>
          Saisissez l&apos;ID affiché sur le portail WiFi de la Mère (ex. MERE-A842E35C) après avoir configuré le WiFi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gatewayId">ID de la Passerelle</Label>
            <Input
              id="gatewayId"
              value={gatewayId}
              onChange={(e) =>
                setGatewayId(
                  e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 13)
                )
              }
              placeholder="MERE-A842E35C"
              className="border-border font-mono"
              maxLength={13}
            />
          </div>
          {farms.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="gatewayFarmId">Ferme</Label>
              <select
                id="gatewayFarmId"
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
          <div className="space-y-2">
            <Label htmlFor="gatewayName">Nom (optionnel)</Label>
            <Input
              id="gatewayName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Passerelle principale"
              className="border-border"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || farms.length === 0}>
            {loading ? "Ajout…" : "Ajouter la passerelle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
