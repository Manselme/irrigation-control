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
import type { LinkedGateway, Module } from "@/types";
import { FieldSensorConfigSheet } from "@/components/Material/FieldSensorConfigSheet";
import { PumpHydraulicConfigSheet } from "@/components/Material/PumpHydraulicConfigSheet";
import { formatModulePumpPressure } from "@/lib/pumpPressure";

type TabId = "all" | "gateway" | "pump" | "field";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "All" },
  { id: "gateway", label: "Gateways" },
  { id: "pump", label: "Pumps" },
  { id: "field", label: "Sensors" },
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
  const [configFieldId, setConfigFieldId] = useState<string | null>(null);
  const [farmName, setFarmName] = useState("Mon espace");
  const [addingFarm, setAddingFarm] = useState(false);

  const rows = useMemo(() => {
    const gatewayRows = gateways.map((g: LinkedGateway) => ({
      id: g.gatewayId,
      kind: "gateway" as const,
      icon: Radio,
      factory: g.gatewayId,
      battery: undefined as number | undefined,
      online: !!g.online,
      lastSeen: g.lastSeen,
      remove: () => removeGateway(g.gatewayId),
    }));
    const moduleRows = modules.map((m: Module) => ({
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">Fleet Inventory</h1>
          <div className="flex gap-1 p-1 bg-surface-low rounded-xl w-fit">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                  tab === t.id
                    ? "bg-surface-lowest text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <Button
          className="flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-widest text-sm shadow-lg hover:shadow-xl transition-all"
          onClick={() => {
            setSheetType("module");
            setSheetOpen(true);
          }}
        >
          + Add Material
        </Button>
      </div>

      {farms.length === 0 && (
        <div className="rounded-xl bg-surface-lowest p-5 ring-1 ring-border/10">
          <p className="mb-3 text-sm text-muted-foreground">Créez votre premier espace pour commencer.</p>
          <div className="flex gap-2">
            <input
              className="h-9 rounded-lg bg-white px-4 text-sm ring-1 ring-border/15 focus:ring-primary"
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

      {/* 12-column grid: Table (8col) + Side panel (4col) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Table Section */}
        <section className="col-span-12 lg:col-span-8 space-y-4">
          <div className="overflow-hidden rounded-xl bg-surface-low ring-1 ring-border/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-highest">
                  <th className="px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Type</th>
                  <th className="px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Device ID</th>
                  <th className="px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Factory ID</th>
                  <th className="px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Battery</th>
                  <th className="px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Pressure</th>
                  <th className="px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Status</th>
                  <th className="px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Last Seen</th>
                  <th className="px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/5">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-6 text-sm text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-6 text-sm text-muted-foreground">
                      Aucun équipement pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => {
                    const Icon = row.icon;
                    return (
                      <tr
                        key={`${row.kind}-${row.id}`}
                        className={cn(
                          "hover:bg-surface-highest/30 transition-colors cursor-pointer",
                          i % 2 === 1 && "bg-surface/50"
                        )}
                      >
                        <td className="px-5 py-4">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-headline font-bold text-sm">{row.id}</p>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-muted-foreground">{row.factory}</td>
                        <td className="px-5 py-4">
                          {row.battery == null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-12 bg-border/20 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    row.battery < 20 ? "bg-destructive" : "bg-primary"
                                  )}
                                  style={{ width: `${Math.min(row.battery, 100)}%` }}
                                />
                              </div>
                              <span className={cn(
                                "text-xs font-bold",
                                row.battery < 20 ? "text-destructive" : "text-foreground"
                              )}>
                                {row.battery}%
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {row.kind === "pump" && "module" in row && row.module ? (
                            <span className="font-headline font-bold">
                              {formatModulePumpPressure(row.module)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {row.online ? (
                            <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full inline-flex items-center gap-1">
                              <Wifi className="h-3 w-3" /> Online
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-surface-highest text-muted-foreground text-[10px] font-bold uppercase tracking-wider rounded-full inline-flex items-center gap-1">
                              <WifiOff className="h-3 w-3" /> Offline
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {formatRelativeTime(row.lastSeen)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {row.kind === "pump" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setConfigPumpId(row.id)}
                                aria-label={`Configurer ${row.id}`}
                              >
                                <Settings2 className="h-4 w-4 text-primary" />
                              </Button>
                            ) : row.kind === "field" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => setConfigFieldId(row.id)}
                                aria-label={`Position GPS ${row.id}`}
                              >
                                <Settings2 className="h-4 w-4 text-primary" />
                              </Button>
                            ) : null}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={row.remove}
                              aria-label={`Supprimer ${row.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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
          {/* Table footer */}
          <div className="flex items-center justify-between px-2">
            <p className="text-xs text-muted-foreground font-medium">
              Showing {rows.length} device{rows.length !== 1 ? "s" : ""}
            </p>
          </div>
        </section>

        {/* Side Panel */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">
          {/* Quick Add */}
          <div className="bg-surface-low rounded-2xl p-6 ring-1 ring-border/10">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-xs font-bold uppercase tracking-wider"
                onClick={() => {
                  setSheetType("gateway");
                  setSheetOpen(true);
                }}
              >
                <Radio className="h-4 w-4" />
                Add Gateway
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-xs font-bold uppercase tracking-wider"
                onClick={() => {
                  setSheetType("module");
                  setSheetOpen(true);
                }}
              >
                <Cpu className="h-4 w-4" />
                Add Module
              </Button>
            </div>
          </div>

          {/* Fleet Stats */}
          <div className="bg-surface-low rounded-2xl p-6 ring-1 ring-border/10">
            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">Fleet Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-lowest rounded-lg">
                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Gateways</p>
                <p className="text-xl font-bold font-headline">{gateways.length}</p>
              </div>
              <div className="p-3 bg-surface-lowest rounded-lg">
                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Modules</p>
                <p className="text-xl font-bold font-headline">{modules.length}</p>
              </div>
              <div className="p-3 bg-surface-lowest rounded-lg">
                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Online</p>
                <p className="text-xl font-bold font-headline text-primary">
                  {rows.filter((r) => r.online).length}
                </p>
              </div>
              <div className="p-3 bg-surface-lowest rounded-lg">
                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Offline</p>
                <p className="text-xl font-bold font-headline text-destructive">
                  {rows.filter((r) => !r.online).length}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{sheetType === "gateway" ? "Ajouter une passerelle" : "Ajouter un module"}</SheetTitle>
            <SheetDescription>
              {sheetType === "gateway"
                ? "Saisissez l'ID de la mère ou scannez son QR."
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
                existingIds={modules.map((m: Module) => m.id)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PumpHydraulicConfigSheet
        open={!!configPumpId}
        onOpenChange={(open) => !open && setConfigPumpId(null)}
        pump={(configPumpId ? modules.find((m: Module) => m.id === configPumpId) : null) as Module | null}
        onSave={async (moduleId, updates) => {
          await updateModule(moduleId, updates);
        }}
      />
      <FieldSensorConfigSheet
        open={!!configFieldId}
        onOpenChange={(open) => !open && setConfigFieldId(null)}
        fieldModule={
          configFieldId ? (modules.find((m: Module) => m.id === configFieldId) ?? null) : null
        }
      />
    </div>
  );
}
