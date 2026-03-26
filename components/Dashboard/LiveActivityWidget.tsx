"use client";

import { Button } from "@/components/ui/button";
import { useSendCommand } from "@/lib/hooks/useCommands";
import type { PumpState } from "@/lib/hooks/useAllPumpStates";
import { isIrrigationFlowing } from "@/lib/hooks/usePumpSessionVolumes";
import type { Module } from "@/types";
import { formatModulePumpPressure } from "@/lib/pumpPressure";
import { Square } from "lucide-react";

interface LiveActivityWidgetProps {
  userId: string | undefined;
  pumpModules: Module[];
  pumpStates: Record<string, PumpState>;
}

export function LiveActivityWidget({
  userId,
  pumpModules,
  pumpStates,
}: LiveActivityWidgetProps) {
  const { sendCommand } = useSendCommand(userId);

  const active = pumpModules.filter((m) => isIrrigationFlowing(pumpStates[m.id]));

  const handleStop = (moduleId: string) => {
    const state = pumpStates[moduleId];
    const mod = pumpModules.find((m) => m.id === moduleId);
    const opts =
      mod?.gatewayId && mod?.deviceId
        ? { gatewayId: mod.gatewayId, deviceId: mod.deviceId }
        : undefined;
    if (state?.pumpOn) sendCommand(moduleId, "PUMP_OFF", opts);
    if (state?.valveOpen || state?.valveAOpen || state?.valveBOpen) {
      sendCommand(moduleId, "VALVE_CLOSE", opts);
    }
  };

  return (
    <section className="rounded-xl bg-surface-lowest p-5 ring-1 ring-border/15">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Live Pump Activity
        </h3>
        {active.length > 0 && (
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> SYSTEM LIVE
          </span>
        )}
      </div>
      {pumpModules.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pump modules configured.</p>
      ) : (
        <div className="space-y-4">
          {pumpModules.map((m) => {
            const isActive = isIrrigationFlowing(pumpStates[m.id]);
            return (
              <div
                key={m.id}
                className={`flex items-center justify-between ${!isActive ? "opacity-40" : ""}`}
              >
                <div>
                  <p className="text-xs font-bold font-headline">{m.name || `Pump ${m.id.slice(0, 8)}`}</p>
                  <p className="text-[10px] text-muted-foreground">{formatModulePumpPressure(m)}</p>
                </div>
                {isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[9px] font-black uppercase text-destructive ring-1 ring-destructive/20 hover:bg-destructive/10"
                    onClick={() => handleStop(m.id)}
                  >
                    <Square className="mr-1 h-3 w-3" /> Stop
                  </Button>
                ) : (
                  <span className="text-[9px] font-black text-muted-foreground px-2 py-0.5 ring-1 ring-border/20 rounded">
                    STANDBY
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
