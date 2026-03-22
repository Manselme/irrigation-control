"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { useSendCommand } from "@/lib/hooks/useCommands";
import { resolveGatewaySendCommandOpts } from "@/lib/gatewayDevicePaths";
import type { Module } from "@/types";
import { Square } from "lucide-react";

interface LiveActivityWidgetProps {
  userId: string | undefined;
  pumpModules: Module[];
  pumpStates: Record<string, { pumpOn: boolean; valveOpen: boolean }>;
}

export function LiveActivityWidget({
  userId,
  pumpModules,
  pumpStates,
}: LiveActivityWidgetProps) {
  const { sendCommand } = useSendCommand(userId);

  const active = pumpModules.filter(
    (m) => pumpStates[m.id]?.pumpOn || pumpStates[m.id]?.valveOpen
  );

  const handleStop = (moduleId: string) => {
    void (async () => {
      const state = pumpStates[moduleId];
    const mod = pumpModules.find((m) => m.id === moduleId);
    const opts = resolveGatewaySendCommandOpts(mod);
      if (state?.pumpOn) await sendCommand(moduleId, "PUMP_OFF", opts);
      if (state?.valveOpen) await sendCommand(moduleId, "VALVE_CLOSE", opts);
    })();
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          Activité en direct
        </CardTitle>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune irrigation en cours.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium text-sm">{m.name || `Pompe ${m.id.slice(0, 8)}`}</p>
                  <p className="text-xs text-muted-foreground">En marche</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                  onClick={() => handleStop(m.id)}
                >
                  <Square className="h-3.5 w-3 mr-1" />
                  Arrêter
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
