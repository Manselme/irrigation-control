"use client";

import { Button } from "@/components/ui/button";

export type SimulatorTabId = "setup" | "manual" | "scenarios" | "autorunner" | "logs";

interface SimulatorTabsProps {
  value: SimulatorTabId;
  onChange: (next: SimulatorTabId) => void;
}

const TABS: Array<{ id: SimulatorTabId; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "manual", label: "Manual" },
  { id: "scenarios", label: "Scenarios" },
  { id: "autorunner", label: "AutoRunner" },
  { id: "logs", label: "Logs" },
];

export function SimulatorTabs({ value, onChange }: SimulatorTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          size="sm"
          variant={value === tab.id ? "default" : "outline"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

