"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertNotifications } from "@/lib/hooks/useAlerts";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { useSendCommand } from "@/lib/hooks/useCommands";
import { Button } from "@/components/ui/button";
import { Bell, Square } from "lucide-react";

interface DashboardHeaderProps {
  onStopAll?: () => void;
}

export function DashboardHeader({ onStopAll }: DashboardHeaderProps) {
  const { user } = useAuth();
  const { farms } = useFarms(user?.uid);
  const { modules } = useModules(user?.uid);
  const { notifications } = useAlertNotifications(user?.uid);
  const pumpModules = modules.filter((m) => m.type === "pump");
  const pumpRefs = pumpModules.map((m) => ({
    moduleId: m.id,
    gatewayId: m.gatewayId,
    deviceId: m.deviceId,
  }));
  const pumpStates = useAllPumpStates(user?.uid, pumpRefs);
  const { sendCommand } = useSendCommand(user?.uid);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const anyPumpOrValveOn = pumpRefs.some(
    (p) => pumpStates[p.moduleId]?.pumpOn || pumpStates[p.moduleId]?.valveOpen
  );

  const handleStopAll = () => {
    pumpModules.forEach((mod) => {
      const state = pumpStates[mod.id];
      const opts =
        mod.gatewayId && mod.deviceId
          ? { gatewayId: mod.gatewayId, deviceId: mod.deviceId }
          : undefined;
      if (state?.pumpOn) sendCommand(mod.id, "PUMP_OFF", opts);
      if (state?.valveOpen) sendCommand(mod.id, "VALVE_CLOSE", opts);
    });
    onStopAll?.();
  };

  const farmName = farms[0]?.name ?? "Mon exploitation";
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
          Good morning, {farmName}
        </h1>
        <p className="text-muted-foreground font-medium">{dateStr}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="default" asChild className="h-11">
          <Link href="/alerts" className="inline-flex items-center gap-2 font-headline uppercase tracking-wide">
            <Bell className="h-4 w-4" />
            Alertes
            {unreadCount > 0 ? (
              <span className="rounded-full bg-surface-low px-2 py-0.5 text-xs text-foreground ring-1 ring-border/15">
                {unreadCount}
              </span>
            ) : null}
          </Link>
        </Button>
        {unreadCount === 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-low px-4 py-2 text-xs font-semibold uppercase tracking-widest text-foreground ring-1 ring-border/15">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Tous les systèmes sont opérationnels
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-low px-4 py-2 text-xs font-semibold uppercase tracking-widest text-foreground ring-1 ring-border/15">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            {unreadCount} module{unreadCount > 1 ? "s" : ""} nécessitent une attention
          </span>
        )}
        {anyPumpOrValveOn && (
          <Button
            variant="outline"
            size="default"
            className="h-11 text-destructive hover:bg-destructive/10 ring-1 ring-destructive/25"
            onClick={handleStopAll}
          >
            <Square className="h-4 w-4 mr-2" />
            Tout stopper
          </Button>
        )}
      </div>
    </header>
  );
}
