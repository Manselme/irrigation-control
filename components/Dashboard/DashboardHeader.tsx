"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useModules } from "@/lib/hooks/useModules";
import { useAlertNotifications } from "@/lib/hooks/useAlerts";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { useSendCommand } from "@/lib/hooks/useCommands";
import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";

interface DashboardHeaderProps {
  onStopAll?: () => void;
}

export function DashboardHeader({ onStopAll }: DashboardHeaderProps) {
  const { user } = useAuth();
  const { farms } = useFarms(user?.uid);
  const { modules } = useModules(user?.uid);
  const { notifications } = useAlertNotifications(user?.uid);
  const pumpModules = modules.filter((m) => m.type === "pump");
  const pumpIds = pumpModules.map((m) => m.id);
  const pumpStates = useAllPumpStates(user?.uid, pumpIds);
  const { sendCommand } = useSendCommand(user?.uid);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const anyPumpOrValveOn = pumpIds.some(
    (id) => pumpStates[id]?.pumpOn || pumpStates[id]?.valveOpen
  );

  const handleStopAll = () => {
    pumpIds.forEach((moduleId) => {
      const state = pumpStates[moduleId];
      if (state?.pumpOn) sendCommand(moduleId, "PUMP_OFF");
      if (state?.valveOpen) sendCommand(moduleId, "VALVE_CLOSE");
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
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight capitalize">
          Bonjour, {farmName}
        </h1>
        <p className="text-muted-foreground text-sm capitalize">{dateStr}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {unreadCount === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Tous les systèmes sont opérationnels
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {unreadCount} module{unreadCount > 1 ? "s" : ""} nécessitent une attention
          </span>
        )}
        {anyPumpOrValveOn && (
          <Button
            variant="outline"
            size="default"
            className="border-destructive/30 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
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
