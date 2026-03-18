"use client";

import { useMemo, useState } from "react";
import { Battery, Cpu, Droplets, Radio, Settings2, Trash2, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useLinkedGateways } from "@/lib/hooks/useLinkedGateways";
import { useAlertConfig } from "@/lib/hooks/useAlerts";
import { AddGatewayForm } from "@/components/AddGatewayForm";
import { AddModuleForm } from "@/components/AddModuleForm";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatRelativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Module } from "@/types";
import { PumpHydraulicConfigSheet } from "@/components/Material/PumpHydraulicConfigSheet";

type TabId = "all" | "gateway" | "pump" | "field";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "Toutes" },
  { id: "gateway", label: "Passerelles" },
  { id: "pump", label: "Pompes" },
  { id: "field", label: "Capteurs" },
];

export default function MaterialPage() {
  const { user } = useAuth();
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { farms, addFarm } = useFarms(user?.uid);
  const { gateways, addGateway, removeGateway } = useLinkedGateways(user?.uid);
  const { modules, loading, addModule, removeModule, updateModule } = useModules(user?.uid, {
    offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
  });
  const [tab, setTab] = useState<TabId>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<"gateway" | "module">("module");
  const [configPumpId, setConfigPumpId] = useState<string | null>(null);
  const [farmName, setFarmName] = useState("Mon espace");
  const [addingFarm, setAddingFarm] = useState(false);

  const rows = useMemo(() => {
    const gatewayRows = gateways.map((g) => ({
      id: g.gatewayId,
      kind: "gateway" as const,
      icon: Radio,
      factory: g.gatewayId,
      battery: undefined as number | undefined,
      online: !!g.online,
      lastSeen: g.lastSeen,
      remove: () => removeGateway(g.gatewayId),
    }));
    const moduleRows = modules.map((m) => ({
      id: m.id,
      kind: m.type,
      module: m,
      icon: m.type === "pump" ? Droplets : Cpu,
      factory: m.deviceId ?? m.factoryId ?? "—",
      battery: m.battery,
      online: m.online,
      lastSeen: m.lastSeen,
      remove: () => removeModule(m.id),
    }));
    const merged = [...gatewayRows, ...moduleRows];
    if (tab === "all") return merged;
    if (tab === "gateway") return merged.filter((r) => r.kind === "gateway");
    if (tab === "pump") return merged.filter((r) => r.kind === "pump");
    return merged.filter((r) => r.kind === "field");
  }, [gateways, modules, tab, removeGateway, removeModule]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parc Matériel</h1>
          <p className="text-muted-foreground">
            Vue technique condensée des passerelles, pompes et capteurs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSheetType("gateway");
              setSheetOpen(true);
            }}
          >
            + Ajouter passerelle
          </Button>
          <Button
            onClick={() => {
              setSheetType("module");
              setSheetOpen(true);
            }}
          >
            + Ajouter module
          </Button>
        </div>
      </div>

      {farms.length === 0 && (
        <div className="rounded-lg border bg-white p-3">
          <p className="mb-2 text-sm text-muted-foreground">Créez votre premier espace.</p>
          <div className="flex gap-2">
            <input
              className="h-9 rounded-md border px-3 text-sm"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
            />
            <Button
              disabled={addingFarm}
              onClick={async () => {
                if (!farmName.trim()) return;
                setAddingFarm(true);
                await addFarm(farmName.trim());
                setAddingFarm(false);
              }}
            >
              {addingFarm ? "Création…" : "Créer"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">ID</th>
              <th className="px-3 py-2 text-left font-medium">ID usine / Device</th>
              <th className="px-3 py-2 text-left font-medium">Batterie</th>
              <th className="px-3 py-2 text-left font-medium">Statut</th>
              <th className="px-3 py-2 text-left font-medium">Dernière vue</th>
              <th className="px-3 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                  Aucun équipement pour ce filtre.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const Icon = row.icon;
                return (
                  <tr key={`${row.kind}-${row.id}`} className="border-b">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4 text-slate-600" />
                        {row.kind === "gateway"
                          ? "Passerelle"
                          : row.kind === "pump"
                            ? "Pompe"
                            : "Capteur"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">{row.id}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.factory}</td>
                    <td className="px-3 py-2">
                      {row.battery == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            row.battery < 20 && "text-amber-600"
                          )}
                        >
                          <Battery className="h-4 w-4" />
                          {row.battery}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          row.online ? "text-emerald-600" : "text-slate-500"
                        )}
                      >
                        {row.online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                        {row.online ? "En ligne" : "Hors ligne"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatRelativeTime(row.lastSeen)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {row.kind === "pump" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setConfigPumpId(row.id)}
                            aria-label={`Configurer ${row.id}`}
                          >
                            <Settings2 className="h-4 w-4 text-sky-600" />
                          </Button>
                        ) : null}
                        <Button size="icon" variant="ghost" onClick={row.remove} aria-label={`Supprimer ${row.id}`}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{sheetType === "gateway" ? "Ajouter une passerelle" : "Ajouter un module"}</SheetTitle>
            <SheetDescription>
              {sheetType === "gateway"
                ? "Saisissez l’ID de la mère ou scannez son QR."
                : "Scannez un QR module ou saisissez son ID usine."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {sheetType === "gateway" ? (
              <AddGatewayForm
                farms={farms}
                onAdd={async (...args) => {
                  await addGateway(...args);
                  setSheetOpen(false);
                }}
                existingGatewayIds={gateways.map((g) => g.gatewayId)}
              />
            ) : (
              <AddModuleForm
                farms={farms}
                gateways={gateways}
                onAdd={async (...args) => {
                  await addModule(...args);
                  setSheetOpen(false);
                }}
                existingIds={modules.map((m) => m.id)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PumpHydraulicConfigSheet
        open={!!configPumpId}
        onOpenChange={(open) => !open && setConfigPumpId(null)}
        pump={(configPumpId ? modules.find((m) => m.id === configPumpId) : null) as Module | null}
        onSave={async (moduleId, updates) => {
          await updateModule(moduleId, updates);
        }}
      />
    </div>
  );
}

