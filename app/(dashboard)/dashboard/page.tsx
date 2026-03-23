"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get, ref } from "firebase/database";
import { useAuth } from "@/lib/hooks/useAuth";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertConfig, useAlertNotifications } from "@/lib/hooks/useAlerts";
import { useZones } from "@/lib/hooks/useZones";
import { useQuickAccess } from "@/lib/hooks/useQuickAccess";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { useLatestSensorMap } from "@/lib/hooks/useLatestSensorMap";
import { useLinkedGateways } from "@/lib/hooks/useLinkedGateways";
import { useWeeklyFlowEstimate } from "@/lib/hooks/useFlowEstimates";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getFirebaseDb } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickAccessEditor } from "@/components/QuickAccessEditor";
import { DashboardHeader } from "@/components/Dashboard/DashboardHeader";
import { LiveActivityWidget } from "@/components/Dashboard/LiveActivityWidget";
import { AlertsMaterialWidget } from "@/components/Dashboard/AlertsMaterialWidget";
import { HealthBarBadges } from "@/components/Dashboard/HealthBarBadges";
import {
  TopCriticalZonesWidget,
  type CriticalZoneItem,
} from "@/components/Dashboard/TopCriticalZonesWidget";
import { AgroMeteoEtWidget } from "@/components/Dashboard/AgroMeteoEtWidget";
import { PumpQuotaRingWidget } from "@/components/Dashboard/PumpQuotaRingWidget";
import { MaintenanceCompactWidget } from "@/components/Dashboard/MaintenanceCompactWidget";
import {
  Bell,
  Settings2,
  Map,
  Droplets,
  History,
  Wrench,
  MapPin,
  AlertTriangle,
  Radio,
  CheckCircle2,
} from "lucide-react";
import { isZoneItemId } from "@/lib/quickAccess";
import { formatRelativeTime } from "@/lib/time";
import type { Module } from "@/types";

const ICON_BY_ID: Record<string, React.ComponentType<{ className?: string }>> = {
  material: Wrench,
  map: Map,
  irrigation: Droplets,
  history: History,
  alerts: Bell,
} as const;

function getIconForItem(item: { id: string }): React.ComponentType<{ className?: string }> | null {
  if (isZoneItemId(item.id)) return MapPin;
  return ICON_BY_ID[item.id] ?? null;
}

const DEFAULT_LAT = 46.6;
const DEFAULT_LNG = 1.9;

function getZoneCenter(zone: { polygon?: { coordinates?: number[][][] } }): { lat: number; lng: number } | null {
  const coords = zone.polygon?.coordinates?.[0];
  if (!coords?.length) return null;
  const [lng, lat] = coords[0];
  return { lat, lng };
}

interface LowBatteryMaintenanceItem {
  id: string;
  name: string;
  battery: number;
  lastSeenLabel: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { modules, loading: modulesLoading } = useModules(user?.uid, {
    offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
  });
  const { zones } = useZones(user?.uid, null);
  const { notifications } = useAlertNotifications(user?.uid);
  const { gateways } = useLinkedGateways(user?.uid);
  const { items, setQuickAccess } = useQuickAccess(user?.uid);
  const [editorOpen, setEditorOpen] = useState(false);

  const pumpModules = modules.filter((m: Module) => m.type === "pump");
  const pumpRefs = pumpModules.map((m: Module) => ({
    moduleId: m.id,
    gatewayId: m.gatewayId,
    deviceId: m.deviceId,
  }));
  const pumpStates = useAllPumpStates(user?.uid, pumpRefs);
  const fieldModules = modules.filter((m: Module) => m.type === "field");
  const latestSensors = useLatestSensorMap(user?.uid, fieldModules);
  const [weeklyVolumeM3, setWeeklyVolumeM3] = useState(0);
  const weeklyFlowEstimateM3 = useWeeklyFlowEstimate(user?.uid);

  const firstZone = zones[0];
  const center = firstZone ? getZoneCenter(firstZone) : null;
  const lat = center?.lat ?? DEFAULT_LAT;
  const lng = center?.lng ?? DEFAULT_LNG;

  const criticalThreshold = alertConfig?.stressTensionThreshold ?? 60;
  const criticalCandidates = useMemo(
    () =>
      zones
        .map((zone) => {
          const tensions = (zone.fieldModuleIds ?? [])
            .map((id) => latestSensors[id]?.tension_cb)
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
          if (tensions.length === 0) return null;
          const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
          return {
            zoneId: zone.id,
            zoneName: zone.name,
            tensionCb: avgTension,
          };
        })
        .filter((z): z is CriticalZoneItem => z != null)
        .sort((a, b) => b.tensionCb - a.tensionCb),
    [zones, latestSensors]
  );

  const topCritical = criticalCandidates
    .filter((z) => z.tensionCb >= criticalThreshold)
    .slice(0, 3);
  const dryZonesCount = criticalCandidates.filter((z) => z.tensionCb >= criticalThreshold).length;
  const networkIncidents =
    gateways.filter((g) => !g.online).length +
    modules.filter((m: Module) => (m.type === "field" || m.type === "pump") && !m.online).length;

  useEffect(() => {
    let mounted = true;
    async function loadWeeklyVolume() {
      if (!user?.uid || pumpModules.length === 0) {
        if (mounted) setWeeklyVolumeM3(0);
        return;
      }
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      let totalVolume = 0;
      let fallbackMinutes = 0;
      for (const pump of pumpModules) {
        const path =
          pump.gatewayId && pump.deviceId
            ? `gateways/${pump.gatewayId}/pumpActivity/${pump.deviceId}`
            : `users/${user.uid}/pumpActivity/${pump.id}`;
        const snap = await get(ref(getFirebaseDb(), path));
        if (!snap.exists()) continue;
        const data = snap.val() as Record<string, number | { minutes?: number; volume_m3?: number }>;
        Object.entries(data).forEach(([date, value]) => {
          if (date < cutoff) return;
          if (typeof value === "number") {
            fallbackMinutes += value;
            return;
          }
          const minutes = Number(value?.minutes ?? 0);
          const volume = Number(value?.volume_m3 ?? 0);
          fallbackMinutes += Number.isFinite(minutes) ? minutes : 0;
          totalVolume += Number.isFinite(volume) ? volume : 0;
        });
      }
      if (totalVolume <= 0 && fallbackMinutes > 0) totalVolume = fallbackMinutes * 0.03;
      if (mounted) setWeeklyVolumeM3(totalVolume);
    }
    loadWeeklyVolume();
    return () => {
      mounted = false;
    };
  }, [user?.uid, pumpModules.map((m: Module) => `${m.id}:${m.gatewayId ?? ""}:${m.deviceId ?? ""}`).join(",")]);

  const weeklyVolumeM3Effective = weeklyFlowEstimateM3 ?? weeklyVolumeM3;

  const hasGateway = gateways.length > 0;
  const hasModules = modules.some((m: Module) => m.type === "pump" || m.type === "field");
  const hasZone = zones.length > 0;
  const hasPump = modules.some((m: Module) => m.type === "pump");
  const onboardingDone = hasGateway && hasModules && hasZone && hasPump;

  const firstOfflineGateway = gateways.find((g) => !g.online);
  const livePumpOnCount = Object.values(pumpStates).filter((s) => s.pumpOn).length;
  const quotaWeeklyM3 = 120;
  const greetingName =
    (profile?.firstName ?? "").trim() ||
    (profile?.displayName ?? "").trim() ||
    (user?.displayName ?? "").trim() ||
    "utilisateur";

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col">
      <DashboardHeader />
      <p className="mb-3 text-sm text-muted-foreground">Bonjour {greetingName}</p>
      <HealthBarBadges
        networkIncidents={networkIncidents}
        dryZonesCount={dryZonesCount}
        weeklyVolumeM3={weeklyVolumeM3Effective}
      />
      {!onboardingDone && (
        <Card className="mb-6 border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Démarrage guidé</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Link className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href="/material">
              1. Connecter la Passerelle
              <p className="mt-1 text-xs text-slate-600">{hasGateway ? "Terminée" : "À faire"}</p>
            </Link>
            <Link className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href="/material">
              2. Ajouter des Modules
              <p className="mt-1 text-xs text-slate-600">{hasModules ? "Terminée" : "À faire"}</p>
            </Link>
            <Link className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href="/irrigation">
              3. Définir une Zone
              <p className="mt-1 text-xs text-slate-600">{hasZone ? "Terminée" : "À faire"}</p>
            </Link>
            <Link className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href="/irrigation">
              4. Premier Test ON/OFF
              <p className="mt-1 text-xs text-slate-600">{hasPump ? "Terminée" : "À faire"}</p>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {topCritical[0] && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-900">
                  {topCritical[0].zoneName}: Stress critique ({Math.round(topCritical[0].tensionCb)} cb)
                </p>
              </div>
              <Button size="sm" asChild>
                <Link href={`/irrigation?zone=${topCritical[0].zoneId}`}>Irriguer</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {firstOfflineGateway && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-amber-700" />
                <p className="text-sm text-amber-900">
                  {firstOfflineGateway.gatewayId} hors-ligne ({formatRelativeTime(firstOfflineGateway.lastSeen)})
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/material">Dépanner</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {!topCritical[0] && !firstOfflineGateway && (
          <Card className="md:col-span-2 border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              Priorités du jour: aucun incident critique détecté.
            </CardContent>
          </Card>
        )}
      </div>

      {modulesLoading ? (
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <Skeleton className="h-[320px] w-full" />
          </div>
          <div className="space-y-4 xl:col-span-4">
            <Skeleton className="h-[220px] w-full" />
            <Skeleton className="h-[220px] w-full" />
          </div>
          <div className="xl:col-span-6">
            <Skeleton className="h-[280px] w-full" />
          </div>
          <div className="xl:col-span-6">
            <Skeleton className="h-[280px] w-full" />
          </div>
          <div className="xl:col-span-6">
            <Skeleton className="h-[260px] w-full" />
          </div>
          <div className="xl:col-span-6">
            <Skeleton className="h-[260px] w-full" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <TopCriticalZonesWidget zones={topCritical} />
          </div>
          <div className="space-y-4 xl:col-span-4">
            <PumpQuotaRingWidget
              weeklyVolumeM3={weeklyVolumeM3Effective}
              quotaM3={quotaWeeklyM3}
              livePumpOnCount={livePumpOnCount}
            />
            <MaintenanceCompactWidget
              lowBatteries={modules
                .map((module: Module) => {
                  const batteryCandidate = latestSensors[module.id]?.battery;
                  const battery =
                    typeof batteryCandidate === "number" && Number.isFinite(batteryCandidate)
                      ? batteryCandidate
                      : module.battery;
                  if (typeof battery !== "number" || battery >= 20) return null;
                  return {
                    id: module.id,
                    name: module.name || module.id,
                    battery: Math.round(battery),
                    lastSeenLabel: formatRelativeTime(module.lastSeen),
                  };
                })
                .filter(
                  (item: LowBatteryMaintenanceItem | null): item is LowBatteryMaintenanceItem =>
                    item != null
                )}
            />
          </div>
          <div className="xl:col-span-6">
            <AgroMeteoEtWidget lat={lat} lng={lng} />
          </div>
          <div className="xl:col-span-6">
            <LiveActivityWidget userId={user?.uid} pumpModules={pumpModules} pumpStates={pumpStates} />
          </div>
          <div className="xl:col-span-6">
            <AlertsMaterialWidget notifications={notifications} maxItems={5} />
          </div>
          <div className="xl:col-span-6">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6 shrink-0">
                <CardTitle className="text-base font-medium text-muted-foreground">
                  Accès rapide
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setEditorOpen(true)}
                  aria-label="Personnaliser"
                >
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                </Button>
              </CardHeader>
              <CardContent className="px-6 pb-8">
                <div className="flex flex-col gap-3">
                  {items.map((item) => {
                    const Icon = getIconForItem(item);
                    return (
                      <Button
                        key={item.id}
                        variant="outline"
                        size="lg"
                        className="gap-3 h-14 w-full justify-start px-5 text-base font-medium"
                        asChild
                      >
                        <Link href={item.href}>
                          {Icon && <Icon className="h-7 w-7 shrink-0" />}
                          {item.label}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <QuickAccessEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        items={items}
        onSave={setQuickAccess}
        userId={user?.uid}
      />
    </div>
  );
}

