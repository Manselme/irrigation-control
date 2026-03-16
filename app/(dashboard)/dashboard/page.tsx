"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertConfig, useAlertNotifications } from "@/lib/hooks/useAlerts";
import { useZones } from "@/lib/hooks/useZones";
import { useQuickAccess } from "@/lib/hooks/useQuickAccess";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { useAllZonesHumidity } from "@/lib/hooks/useZoneHumidity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuickAccessEditor } from "@/components/QuickAccessEditor";
import { DashboardHeader } from "@/components/Dashboard/DashboardHeader";
import { WeatherWidget } from "@/components/Dashboard/WeatherWidget";
import { LiveActivityWidget } from "@/components/Dashboard/LiveActivityWidget";
import { ZonesToWatchWidget } from "@/components/Dashboard/ZonesToWatchWidget";
import { ConsumptionWidget } from "@/components/Dashboard/ConsumptionWidget";
import { AlertsMaterialWidget } from "@/components/Dashboard/AlertsMaterialWidget";
import { Bell, Settings2, Map, Droplets, History, Wrench, MapPin } from "lucide-react";
import { isZoneItemId } from "@/lib/quickAccess";

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

export default function DashboardPage() {
  const { user } = useAuth();
  const { config: alertConfig } = useAlertConfig(user?.uid);
  const { modules } = useModules(user?.uid, {
    offlineThresholdMinutes: alertConfig?.offlineMinutesThreshold ?? 5,
  });
  const { zones } = useZones(user?.uid, null);
  const { notifications } = useAlertNotifications(user?.uid);
  const { items, setQuickAccess } = useQuickAccess(user?.uid);
  const [editorOpen, setEditorOpen] = useState(false);

  const pumpModules = modules.filter((m) => m.type === "pump");
  const pumpIds = pumpModules.map((m) => m.id);
  const pumpRefs = pumpModules.map((m) => ({
    moduleId: m.id,
    gatewayId: m.gatewayId,
    deviceId: m.deviceId,
  }));
  const pumpStates = useAllPumpStates(user?.uid, pumpRefs);
  const humidityByZone = useAllZonesHumidity(
    user?.uid,
    zones.map((z) => ({ id: z.id, fieldModuleIds: z.fieldModuleIds ?? [] })),
    modules
  );

  const firstZone = zones[0];
  const center = firstZone ? getZoneCenter(firstZone) : null;
  const lat = center?.lat ?? DEFAULT_LAT;
  const lng = center?.lng ?? DEFAULT_LNG;
  const humidities = zones.map((z) => humidityByZone[z.id]).filter((h): h is number => h != null);
  const avgHumidity =
    humidities.length > 0
      ? humidities.reduce((a, b) => a + b, 0) / humidities.length
      : undefined;

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)]">
      <DashboardHeader />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] flex-1 min-h-0">
        <div className="space-y-6">
          <WeatherWidget lat={lat} lng={lng} humidity={avgHumidity} />
          <LiveActivityWidget
            userId={user?.uid}
            pumpModules={pumpModules}
            pumpStates={pumpStates}
          />
          <ZonesToWatchWidget zones={zones} humidityByZone={humidityByZone} />
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
        <div className="space-y-6">
          <ConsumptionWidget userId={user?.uid} pumpModuleIds={pumpIds} />
          <AlertsMaterialWidget notifications={notifications} maxItems={5} />
        </div>
      </div>
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
