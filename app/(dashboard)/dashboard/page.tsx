"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertConfig, useAlertNotifications } from "@/lib/hooks/useAlerts";
import { useZones } from "@/lib/hooks/useZones";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { usePumpLiveLitersRtdb } from "@/lib/hooks/usePumpLiveLitersRtdb";
import { isIrrigationFlowing } from "@/lib/hooks/usePumpSessionVolumes";
import { useLatestSensorMap } from "@/lib/hooks/useLatestSensorMap";
import { useLinkedGateways } from "@/lib/hooks/useLinkedGateways";
import { fetchWeeklyVolumeLitersForPump } from "@/lib/pumpActivityTotals";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useFarms } from "@/lib/hooks/useFarms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TopCriticalZonesWidget, type CriticalZoneItem } from "@/components/Dashboard/TopCriticalZonesWidget";
import { AgroMeteoEtWidget } from "@/components/Dashboard/AgroMeteoEtWidget";
import { LiveActivityWidget } from "@/components/Dashboard/LiveActivityWidget";
import { MaintenanceCompactWidget } from "@/components/Dashboard/MaintenanceCompactWidget";
import { AlertsMaterialWidget } from "@/components/Dashboard/AlertsMaterialWidget";
import {
  AlertTriangle,
  Radio,
  Droplets,
  CheckCircle2,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import { formatVolumeLiters } from "@/lib/waterVolume";
import type { Module } from "@/types";

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
  const { farms } = useFarms(user?.uid);
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { modules, loading: modulesLoading } = useModules(user?.uid, {
    offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
  });
  const { zones } = useZones(user?.uid, null);
  const { notifications } = useAlertNotifications(user?.uid);
  const { gateways } = useLinkedGateways(user?.uid);

  const pumpModules = modules.filter((m: Module) => m.type === "pump");
  const pumpRefs = pumpModules.map((m: Module) => ({
    moduleId: m.id,
    gatewayId: m.gatewayId,
    deviceId: m.deviceId,
    moduleType: m.type,
    factoryId: m.factoryId,
  }));
  const pumpStates = useAllPumpStates(user?.uid, pumpRefs);
  const anySessionFlowing = useMemo(
    () => pumpModules.some((m: Module) => isIrrigationFlowing(pumpStates[m.id])),
    [pumpModules, pumpStates]
  );
  const fieldModules = modules.filter((m: Module) => m.type === "field");
  const latestSensors = useLatestSensorMap(user?.uid, fieldModules);
  const [weeklyVolumeLiters, setWeeklyVolumeLiters] = useState(0);

  const pumpModulesKey = pumpModules
    .map((m: Module) => `${m.id}:${m.gatewayId ?? ""}:${m.deviceId ?? ""}`)
    .join(",");
  const pumpModulesRef = useRef(pumpModules);
  pumpModulesRef.current = pumpModules;

  const loadWeeklyVolume = useCallback(async () => {
    const pumps = pumpModulesRef.current;
    if (!user?.uid || pumps.length === 0) {
      setWeeklyVolumeLiters(0);
      return;
    }
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let totalLiters = 0;
    for (const pump of pumps) {
      totalLiters += await fetchWeeklyVolumeLitersForPump(user.uid, pump, cutoff);
    }
    setWeeklyVolumeLiters(totalLiters);
  }, [user?.uid, pumpModulesKey]);

  const { overlayLiters } = usePumpLiveLitersRtdb(user?.uid, pumpModules, pumpStates, () => {
    void loadWeeklyVolume();
  });

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
    void loadWeeklyVolume();
    const tick = window.setInterval(() => void loadWeeklyVolume(), 60_000);
    return () => window.clearInterval(tick);
  }, [loadWeeklyVolume]);

  /**
   * 7 j : pumpActivity + gateways + `pumpLiveLitersAccum` (litres L persistés),
   * + léger complément entre deux écritures RTDB pour un affichage fluide.
   */
  const globalVolumeLitersLive = weeklyVolumeLiters + overlayLiters;

  const hasGateway = gateways.length > 0;
  const hasModules = modules.some((m: Module) => m.type === "pump" || m.type === "field");
  const hasZone = zones.length > 0;
  const hasPump = modules.some((m: Module) => m.type === "pump");
  const onboardingDone = hasGateway && hasModules && hasZone && hasPump;

  const firstOfflineGateway = gateways.find((g) => !g.online);
  const farmName = farms[0]?.name ?? "Mon exploitation";
  const greetingName =
    (profile?.firstName ?? "").trim() ||
    (profile?.displayName ?? "").trim() ||
    (user?.displayName ?? "").trim() ||
    "Manager";

  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {/* Welcome Header + KPI Badges (Stitch-style inline) */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Good morning, {greetingName}
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            {dateStr} &bull; Site: {farmName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-3 bg-surface-lowest px-4 py-2 rounded ring-1 ring-border/15">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Network</p>
              <p className="text-sm font-headline font-bold">
                {networkIncidents === 0 ? "All Online" : `${networkIncidents} Offline`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-surface-lowest px-4 py-2 rounded ring-1 ring-border/15">
            <AlertTriangle className={`h-4 w-4 ${dryZonesCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${dryZonesCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>Stress</p>
              <p className={`text-sm font-headline font-bold ${dryZonesCount > 0 ? "text-destructive" : ""}`}>
                {dryZonesCount === 0 ? "Optimal" : `${dryZonesCount} Critical`}
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-3 bg-surface-lowest px-4 py-2 rounded ring-1 ring-border/15 ${
              anySessionFlowing ? "ring-primary/40" : ""
            }`}
          >
            <Droplets className={`h-4 w-4 ${anySessionFlowing ? "text-primary" : "text-primary/80"}`} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Volume (7 j)</p>
              <p className="text-sm font-headline font-bold leading-tight">
                {formatVolumeLiters(globalVolumeLitersLive)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Bento Grid: 4-col left + 8-col right */}
      <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-12">
        {/* Left Sidebar: Onboarding + Priority Actions */}
        <div className="min-w-0 space-y-4 md:col-span-4">
          {!onboardingDone && (
            <section className="rounded-lg bg-surface-lowest p-5 ring-1 ring-border/15">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest">Onboarding Progress</h3>
                <span className="text-sm font-bold text-primary">
                  {[hasGateway, hasModules, hasZone, hasPump].filter(Boolean).length * 25}%
                </span>
              </div>
              <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface-low">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${[hasGateway, hasModules, hasZone, hasPump].filter(Boolean).length * 25}%` }}
                />
              </div>
              <ul className="space-y-2">
                {[
                  { done: hasGateway, label: "Gateway Sync", href: "/material" },
                  { done: hasModules, label: "Add Modules", href: "/material" },
                  { done: hasZone, label: "Zone Mapping", href: "/irrigation" },
                  { done: hasPump, label: "Pump Integration", href: "/irrigation" },
                ].map((step) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="flex items-center gap-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="h-4 w-4 rounded-full ring-1 ring-border/30" />
                      )}
                      {step.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Priority Actions */}
          <div className="space-y-3">
            {topCritical[0] && (
              <div className="rounded-r-lg border-l-4 border-destructive bg-destructive/5 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-destructive">High Stress Alert</span>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <h4 className="font-headline text-base font-bold mb-1">
                  {topCritical[0].zoneName} (Critical)
                </h4>
                <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                  Soil tension at {Math.round(topCritical[0].tensionCb)} cb. Irrigation recommended.
                </p>
                <Button size="sm" variant="destructive" className="w-full text-[10px] uppercase tracking-widest" asChild>
                  <Link href={`/irrigation?zone=${topCritical[0].zoneId}`}>Start Irrigation</Link>
                </Button>
              </div>
            )}
            {firstOfflineGateway && (
              <div className="rounded-r-lg border-l-4 border-amber-600 bg-surface-low p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Connectivity Issue</span>
                  <Radio className="h-4 w-4 text-amber-600" />
                </div>
                <h4 className="font-headline text-base font-bold mb-1">
                  {firstOfflineGateway.gatewayId} (Offline)
                </h4>
                <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                  Offline since {formatRelativeTime(firstOfflineGateway.lastSeen)}.
                </p>
                <Button size="sm" variant="outline" className="w-full text-[10px] uppercase tracking-widest" asChild>
                  <Link href="/material">Diagnose</Link>
                </Button>
              </div>
            )}
            {!topCritical[0] && !firstOfflineGateway && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-4 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                No critical incidents detected.
              </div>
            )}
          </div>
        </div>

        {/* Main Grid Area (8-col): 2x2 + full-width alerts */}
        <div className="grid min-w-0 grid-cols-1 gap-5 md:col-span-8 lg:grid-cols-2">
          {modulesLoading ? (
            <>
              <Skeleton className="h-[220px] w-full rounded-lg" />
              <Skeleton className="h-[220px] w-full rounded-lg" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
              <Skeleton className="h-[160px] w-full rounded-lg lg:col-span-2" />
            </>
          ) : (
            <>
              <TopCriticalZonesWidget zones={topCritical} />
              <AgroMeteoEtWidget lat={lat} lng={lng} />
              <LiveActivityWidget userId={user?.uid} pumpModules={pumpModules} pumpStates={pumpStates} />
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
              <AlertsMaterialWidget notifications={notifications} maxItems={4} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
