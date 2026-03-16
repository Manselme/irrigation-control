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
import type { LinkedGateway } from "@/types";
import { QrScannerModal } from "@/components/QrScannerModal";

const MODULE_TYPES: { value: ModuleType; label: string }[] = [
  { value: "pump", label: "Module Pompe" },
  { value: "field", label: "Module Champ" },
];

const FACTORY_ID_REGEX = /^[0-9A-Fa-f]{8}$/;
const DEVICE_ID_REGEX = /^(CHAMP|POMPE)-[0-9A-Fa-f]{8}$/i;

interface AddModuleFormProps {
  farms: Farm[];
  gateways?: LinkedGateway[];
  onAdd: (
    moduleId: string,
    type: ModuleType,
    farmId: string,
    factoryId?: string,
    options?: { gatewayId?: string; deviceId?: string }
  ) => Promise<void>;
  existingIds: string[];
}

export function AddModuleForm({
  farms,
  gateways = [],
  onAdd,
  existingIds,
}: AddModuleFormProps) {
  const [moduleId, setModuleId] = useState("");
  const [type, setType] = useState<ModuleType>("field");
  const [farmId, setFarmId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [gatewayId, setGatewayId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const gatewaysForFarm =
    farmId ? gateways.filter((g) => g.farmId === farmId) : gateways;

  const handleQrScan = (scannedId: string) => {
    const normalized = scannedId.trim().toUpperCase();
    if (DEVICE_ID_REGEX.test(normalized)) {
      setDeviceId(normalized);
    } else if (FACTORY_ID_REGEX.test(normalized)) {
      setFactoryId(normalized);
      if (type === "field") setDeviceId("CHAMP-" + normalized);
      else if (type === "pump") setDeviceId("POMPE-" + normalized);
    }
    setQrScanOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const targetFarmId = (farmId || farms[0]?.id) ?? "";
    if (!targetFarmId) {
      setError("Créez d'abord une ferme.");
      return;
    }

    const useV2 = (type === "pump" || type === "field") && gatewaysForFarm.length > 0;
    if (useV2) {
      const gid = gatewayId || gatewaysForFarm[0]?.gatewayId;
      const did = deviceId.trim().toUpperCase();
      if (!gid) {
        setError("Sélectionnez une passerelle pour cette ferme.");
        return;
      }
      if (!DEVICE_ID_REGEX.test(did)) {
        setError("ID module : CHAMP-xxxxxxxx ou POMPE-xxxxxxxx (8 caractères hex).");
        return;
      }
      if (existingIds.includes(did)) {
        setError("Ce module est déjà enregistré.");
        return;
      }
      setLoading(true);
      try {
        await onAdd(did, type, targetFarmId, undefined, { gatewayId: gid, deviceId: did });
        setDeviceId("");
        setGatewayId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'ajout.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const id = moduleId.trim();
    if (!id) {
      setError("Saisissez l'identifiant du module ou utilisez une passerelle + ID module (CHAMP-xxx / POMPE-xxx).");
      return;
    }
    if (existingIds.includes(id)) {
      setError("Ce module est déjà enregistré.");
      return;
    }
    const needFactoryId = type === "pump" || type === "field";
    const fid = factoryId.trim();
    if (needFactoryId && !useV2) {
      if (!FACTORY_ID_REGEX.test(fid)) {
        setError("ID d'usine : 8 caractères hexadécimaux (ex. A842E34A). Scannez le QR ou saisissez.");
        return;
      }
    }
    setLoading(true);
    try {
      await onAdd(id, type, targetFarmId, needFactoryId ? fid : undefined);
      setModuleId("");
      setFactoryId("");
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
          Capteur (Champ) ou Pompe : choisissez la passerelle puis l&apos;ID du module (CHAMP-xxx / POMPE-xxx), ou scannez le QR.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as ModuleType);
                setDeviceId("");
              }}
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
          {(type === "pump" || type === "field") && gatewaysForFarm.length > 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="gatewayId">Passerelle</Label>
                <select
                  id="gatewayId"
                  value={gatewayId}
                  onChange={(e) => setGatewayId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Sélectionner une passerelle</option>
                  {gatewaysForFarm.map((g) => (
                    <option key={g.gatewayId} value={g.gatewayId}>
                      {g.name || g.gatewayId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deviceId">ID module (CHAMP-xxx / POMPE-xxx)</Label>
                <div className="flex gap-2">
                  <Input
                    id="deviceId"
                    value={deviceId}
                    onChange={(e) =>
                      setDeviceId(
                        e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 14)
                      )
                    }
                    placeholder="ex. CHAMP-99887766"
                    className="border-border font-mono"
                    maxLength={14}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQrScanOpen(true)}
                  >
                    Scanner QR
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Scannez le QR sur le boîtier ou saisissez CHAMP- ou POMPE- suivi de 8 caractères hex.
                </p>
              </div>
            </>
          )}
          {(type === "pump" || type === "field") && gatewaysForFarm.length === 0 && gateways.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune passerelle pour cette ferme. Ajoutez une passerelle et associez-la à cette ferme.
            </p>
          )}
          {(type === "pump" || type === "field") && gateways.length === 0 && (
            <div className="space-y-2">
              <Label htmlFor="moduleId">Identifiant du module</Label>
              <Input
                id="moduleId"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                placeholder="ex. ESP32-ABC123"
                className="border-border"
              />
              <Label htmlFor="factoryId">ID d&apos;usine (8 caractères hex)</Label>
              <div className="flex gap-2">
                <Input
                  id="factoryId"
                  value={factoryId}
                  onChange={(e) =>
                    setFactoryId(
                      e.target.value.toUpperCase().replace(/[^0-9A-Fa-f]/g, "").slice(0, 8)
                    )
                  }
                  placeholder="ex: A842E34A"
                  className="border-border font-mono"
                  maxLength={8}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQrScanOpen(true)}
                >
                  Scanner QR
                </Button>
              </div>
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
      <QrScannerModal
        open={qrScanOpen}
        onOpenChange={setQrScanOpen}
        onScan={handleQrScan}
      />
    </Card>
  );
}
