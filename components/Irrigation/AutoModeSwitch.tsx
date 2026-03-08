"use client";

import * as React from "react";
import * as Switch from "@radix-ui/react-switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AutoModeSwitchProps {
  mode: "manual" | "auto";
  onModeChange: (mode: "manual" | "auto") => void;
}

export function AutoModeSwitch({ mode, onModeChange }: AutoModeSwitchProps) {
  const isAuto = mode === "auto";

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <Label htmlFor="auto-mode" className="text-sm">
        Mode automatique
      </Label>
      <Switch.Root
        id="auto-mode"
        checked={isAuto}
        onCheckedChange={(checked) => onModeChange(checked ? "auto" : "manual")}
        className={cn(
          "relative h-5 w-9 rounded-full border border-border bg-muted transition-colors",
          "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Switch.Thumb
          className={cn(
            "block h-4 w-3 rounded-full bg-background shadow transition-transform",
            "translate-x-0.5 data-[state=checked]:translate-x-4"
          )}
        />
      </Switch.Root>
    </div>
  );
}
