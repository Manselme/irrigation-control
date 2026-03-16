"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useLinkedGateways } from "@/lib/hooks/useLinkedGateways";
import { useAlertConfig } from "@/lib/hooks/useAlerts";
import { AddGatewayForm } from "@/components/AddGatewayForm";
import { AddModuleForm } from "@/components/AddModuleForm";
import { ModuleList } from "@/components/ModuleList";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export default function MaterialPage() {
  const { user } = useAuth();
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { farms, loading: farmsLoading, addFarm } = useFarms(user?.uid);
  const { gateways, loading: gatewaysLoading, addGateway } = useLinkedGateways(user?.uid);
  const { modules, loading: modulesLoading, addModule, removeModule } =
    useModules(user?.uid, {
      offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
    });
  const modulesWithGatewayStatus = useMemo(
    () =>
      modules.map((m) => ({
        ...m,
        // Seuls les modules Mère héritent de l'état de la passerelle.
        // Pour les pompes et champs, 'online' reste celui calculé côté useModules.
        online:
          m.type === "mother" && m.gatewayId != null
            ? (gateways.find((g) => g.gatewayId === m.gatewayId)?.online ?? false)
            : m.online,
      })),
    [modules, gateways]
  );
  const [farmName, setFarmName] = useState("Ma ferme");
  const [addingFarm, setAddingFarm] = useState(false);

  const handleAddFarm = async () => {
    if (!farmName.trim()) return;
    setAddingFarm(true);
    try {
      await addFarm(farmName.trim());
      setFarmName("Ma ferme");
    } finally {
      setAddingFarm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Matériel</h1>
        <p className="text-muted-foreground">
          Gérez vos passerelles et modules (Pompe, Champ) et leur affectation aux fermes.
        </p>
      </div>

      {farms.length === 0 && !farmsLoading && (
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row gap-3 items-start">
          <input
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm w-full sm:max-w-[200px]"
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
            placeholder="Nom de la ferme"
          />
          <Button onClick={handleAddFarm} disabled={addingFarm}>
            {addingFarm ? "Création…" : "Créer ma première ferme"}
          </Button>
        </div>
      )}

      <AddGatewayForm
        farms={farms}
        onAdd={addGateway}
        existingGatewayIds={gateways.map((g) => g.gatewayId)}
      />

      {gateways.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">État des passerelles (module Mère)</CardTitle>
            <CardDescription>
              Les passerelles en ligne envoient un heartbeat toutes les 30 s. Hors ligne si aucun signal depuis 2 min.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {gateways.map((g) => (
                <li
                  key={g.gatewayId}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{g.name || g.gatewayId}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      g.online
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {g.online ? "En ligne" : "Hors ligne"}
                  </span>
                </li>
              ))}
            </ul>
            {gateways.some((g) => !g.online) && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                <p className="font-medium text-amber-800 dark:text-amber-200">Passerelle hors ligne — à vérifier :</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-amber-700 dark:text-amber-300">
                  <li>L’ID sur le site doit être <strong>exactement</strong> celui affiché sur la Mère (portail 192.168.4.1 ou écran).</li>
                  <li>Mère sous tension, connectée au WiFi (configuré via le portail AgriFlow-Setup).</li>
                  <li>Firebase : <strong>Authentification anonyme</strong> activée (Console → Authentication → Sign-in method → Anonymous).</li>
                  <li>Règles Realtime Database déployées (<code className="rounded bg-amber-100 px-1 dark:bg-amber-900">firebase deploy --only database</code>).</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AddModuleForm
        farms={farms}
        gateways={gateways}
        onAdd={addModule}
        existingIds={modules.map((m) => m.id)}
      />
      <ModuleList
        modules={modulesWithGatewayStatus}
        loading={modulesLoading}
        onRemove={removeModule}
        userId={user?.uid}
      />
    </div>
  );
}
