"use client";

import * as React from "react";
import * as Switch from "@radix-ui/react-switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ManualTogglesProps {
  pumpModuleId: string | null;
  pumpOnline: boolean;
  pumpOn: boolean;
  valveOpen: boolean;
  pendingCommand: {
    moduleId: string;
    type: string;
    status: string;
  } | null;
  onSendCommand: (
    moduleId: string,
    type: "VALVE_OPEN" | "VALVE_CLOSE" | "PUMP_ON" | "PUMP_OFF"
  ) => void;
  onClearPending: () => void;
}

export function ManualToggles({
  pumpModuleId,
  pumpOnline,
  pumpOn,
  valveOpen,
  pendingCommand,
  onSendCommand,
  onClearPending,
}: ManualTogglesProps) {
  const disabled = !pumpModuleId || !pumpOnline;
  const isPending =
    pendingCommand &&
    pendingCommand.moduleId === pumpModuleId &&
    (pendingCommand.status === "pending" ||
      pendingCommand.status === "confirmed" ||
      pendingCommand.status === "failed" ||
      pendingCommand.status === "timeout");

  const handlePump = (on: boolean) => {
    if (!pumpModuleId || disabled) return;
    onSendCommand(pumpModuleId, on ? "PUMP_ON" : "PUMP_OFF");
  };

  const handleValve = (open: boolean) => {
    if (!pumpModuleId || disabled) return;
    onSendCommand(pumpModuleId, open ? "VALVE_OPEN" : "VALVE_CLOSE");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border px-3 py-2.5">
        <Label
          htmlFor="pump"
          className={cn("text-sm font-medium", disabled && "text-muted-foreground")}
        >
          Pompe
        </Label>
        <span className={cn("text-xs text-muted-foreground", pumpOn && "text-primary font-medium")}>
          {pumpOn ? "ON" : "OFF"}
        </span>
        <Switch.Root
          id="pump"
          checked={pumpOn}
          onCheckedChange={handlePump}
          disabled={disabled}
          className={cn(
            "relative h-6 w-11 rounded-full border border-border bg-muted transition-colors shrink-0",
            "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <Switch.Thumb
            className={cn(
              "block h-5 w-5 rounded-full bg-background shadow transition-transform translate-x-0.5 data-[state=checked]:translate-x-5"
            )}
          />
        </Switch.Root>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border px-3 py-2.5">
        <Label
          htmlFor="valve"
          className={cn("text-sm font-medium", disabled && "text-muted-foreground")}
        >
          Vanne
        </Label>
        <span className={cn("text-xs text-muted-foreground", valveOpen && "text-primary font-medium")}>
          {valveOpen ? "ON" : "OFF"}
        </span>
        <Switch.Root
          id="valve"
          checked={valveOpen}
          onCheckedChange={handleValve}
          disabled={disabled}
          className={cn(
            "relative h-6 w-11 rounded-full border border-border bg-muted transition-colors shrink-0",
            "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <Switch.Thumb
            className={cn(
              "block h-5 w-5 rounded-full bg-background shadow transition-transform translate-x-0.5 data-[state=checked]:translate-x-5"
            )}
          />
        </Switch.Root>
      </div>
      {isPending && (
        <div className="flex items-center gap-2 text-sm">
          {pendingCommand!.status === "pending" && (
            <span className="text-muted-foreground">Envoi en cours…</span>
          )}
          {(pendingCommand!.status === "confirmed" ||
            pendingCommand!.status === "failed" ||
            pendingCommand!.status === "timeout") && (
            <>
              <span
                className={
                  pendingCommand!.status === "confirmed"
                    ? "text-green-600"
                    : "text-destructive"
                }
              >
                {pendingCommand!.status === "confirmed"
                  ? "Confirmé"
                  : pendingCommand!.status === "timeout"
                    ? "Délai dépassé (aucune réponse de la pompe)"
                    : "Échec (commande non confirmée)"}
              </span>
              <Button variant="ghost" size="sm" onClick={onClearPending}>
                OK
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
