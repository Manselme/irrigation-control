"use client";

import { useState, useEffect } from "react";
import type { AlertConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AlertConfigFormProps {
  config: AlertConfig;
  onUpdate: (updates: Partial<AlertConfig>) => Promise<void>;
}

export function AlertConfigForm({ config, onUpdate }: AlertConfigFormProps) {
  const [battery, setBattery] = useState(String(config.batteryThreshold ?? ""));
  const [offline, setOffline] = useState(
    String(config.offlineMinutesThreshold ?? "")
  );
  const [pressure, setPressure] = useState(
    String(config.pressureDropThreshold ?? "")
  );
  const [pressureHigh, setPressureHigh] = useState(
    String(config.pressureHighThreshold ?? "")
  );
  const [autoStop, setAutoStop] = useState(Boolean(config.autoStopOnLowPressure));
  const [autoStopDelay, setAutoStopDelay] = useState(String(config.autoStopLowPressureDelaySec ?? "5"));
  const [autoStopCloseValves, setAutoStopCloseValves] = useState(
    config.autoStopCloseValves ?? true
  );
  const [autoStopHigh, setAutoStopHigh] = useState(Boolean(config.autoStopOnHighPressure));
  const [autoStopHighDelay, setAutoStopHighDelay] = useState(
    String(config.autoStopHighPressureDelaySec ?? "1")
  );
  const [autoStopOpenValves, setAutoStopOpenValves] = useState(
    config.autoStopOpenValves ?? true
  );
  const [stress, setStress] = useState(String(config.stressTensionThreshold ?? "60"));
  const [rearm, setRearm] = useState(String(config.rearmMinutes ?? "1"));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setBattery(String(config.batteryThreshold ?? ""));
    setOffline(String(config.offlineMinutesThreshold ?? ""));
    setPressure(String(config.pressureDropThreshold ?? ""));
    setPressureHigh(String(config.pressureHighThreshold ?? ""));
    setAutoStop(Boolean(config.autoStopOnLowPressure));
    setAutoStopDelay(String(config.autoStopLowPressureDelaySec ?? "5"));
    setAutoStopCloseValves(config.autoStopCloseValves ?? true);
    setAutoStopHigh(Boolean(config.autoStopOnHighPressure));
    setAutoStopHighDelay(String(config.autoStopHighPressureDelaySec ?? "1"));
    setAutoStopOpenValves(config.autoStopOpenValves ?? true);
    setStress(String(config.stressTensionThreshold ?? "60"));
    setRearm(String(config.rearmMinutes ?? "1"));
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        batteryThreshold: battery ? Number(battery) : undefined,
        offlineMinutesThreshold: offline ? Number(offline) : undefined,
        pressureDropThreshold: pressure ? Number(pressure) : undefined,
        pressureHighThreshold: pressureHigh ? Number(pressureHigh) : undefined,
        autoStopOnLowPressure: autoStop ? true : undefined,
        autoStopLowPressureDelaySec: autoStop ? Number(autoStopDelay || "5") : undefined,
        autoStopCloseValves: autoStop ? autoStopCloseValves : undefined,
        autoStopOnHighPressure: autoStopHigh ? true : undefined,
        autoStopHighPressureDelaySec: autoStopHigh ? Number(autoStopHighDelay || "1") : undefined,
        autoStopOpenValves: autoStopHigh ? autoStopOpenValves : undefined,
        stressTensionThreshold: stress ? Number(stress) : undefined,
        rearmMinutes: rearm !== "" ? Number(rearm) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-surface-low p-6 ring-1 ring-border/10 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] mb-1">Global Parameters</p>
          <h3 className="font-headline text-xl font-semibold">Configuration Thresholds</h3>
        </div>
        <Button onClick={handleSave} disabled={saving} className="text-xs font-semibold">
          {saving ? "Saving…" : "Apply Changes"}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-surface-lowest p-5 ring-1 ring-border/10">
          <h4 className="mb-4 text-sm font-semibold">Battery Alert</h4>
          <div className="flex items-end gap-2">
            <Input id="battery" type="number" min={0} max={100} value={battery} onChange={(e) => setBattery(e.target.value)} placeholder="15" className="text-2xl font-headline font-bold w-20 h-10" />
            <span className="text-sm text-muted-foreground mb-1">%</span>
          </div>
        </div>
        <div className="rounded-lg bg-surface-lowest p-5 ring-1 ring-border/10">
          <h4 className="mb-4 text-sm font-semibold">Offline Timeout</h4>
          <div className="flex items-end gap-2">
            <Input id="offline" type="number" min={1} value={offline} onChange={(e) => setOffline(e.target.value)} placeholder="120" className="text-2xl font-headline font-bold w-24 h-10" />
            <span className="text-sm text-muted-foreground mb-1">MIN</span>
          </div>
        </div>
        <div className="rounded-lg bg-surface-lowest p-5 ring-1 ring-border/10">
          <h4 className="mb-4 text-sm font-semibold">Pressure Drop</h4>
          <div className="flex items-end gap-2">
            <Input id="pressure" type="number" min={0} value={pressure} onChange={(e) => setPressure(e.target.value)} placeholder="2.4" className="text-2xl font-headline font-bold w-20 h-10" />
            <span className="text-sm text-muted-foreground mb-1">BAR</span>
          </div>
        </div>
        <div className="rounded-lg bg-surface-lowest p-5 ring-1 ring-border/10">
          <h4 className="mb-4 text-sm font-semibold">Water Stress</h4>
          <div className="flex items-end gap-2">
            <Input id="stress" type="number" min={0} value={stress} onChange={(e) => setStress(e.target.value)} placeholder="60" className="text-2xl font-headline font-bold w-20 h-10" />
            <span className="text-sm text-muted-foreground mb-1">CB</span>
          </div>
        </div>
      </div>

      {/* Pressure Security (dark panel like Stitch) */}
      <div className="rounded-xl bg-neutral-900 text-white p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-headline text-lg font-semibold">Pressure Security</h3>
          <span className="text-[10px] text-neutral-400 uppercase tracking-widest">Autonomous Logic</span>
        </div>
        <div className="rounded-lg bg-neutral-800 p-4 border-l-4 border-destructive space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-wider">Under-Pressure Logic</h4>
            <label className="relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors" style={{ background: autoStop ? "#0d631b" : "#525252" }}>
              <input type="checkbox" checked={autoStop} onChange={(e) => setAutoStop(e.target.checked)} className="sr-only" />
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${autoStop ? "translate-x-4" : "translate-x-0.5"}`} />
            </label>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Trigger Point</span>
            <span className="font-mono">&lt; {pressure || "—"} BAR</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Delay</span>
            <Input type="number" min={0} value={autoStopDelay} onChange={(e) => setAutoStopDelay(e.target.value)} disabled={!autoStop} className="w-16 h-6 text-xs bg-neutral-700 text-white ring-0 border-0" />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Close Valves</span>
            <label className="relative inline-flex h-4 w-7 items-center rounded-full cursor-pointer" style={{ background: autoStopCloseValves ? "#0d631b" : "#525252" }}>
              <input type="checkbox" checked={autoStopCloseValves} onChange={(e) => setAutoStopCloseValves(e.target.checked)} disabled={!autoStop} className="sr-only" />
              <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ${autoStopCloseValves ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </label>
          </div>
        </div>
        <div className="rounded-lg bg-neutral-800 p-4 border-l-4 border-blue-500 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-wider">Over-Pressure Logic</h4>
            <label className="relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors" style={{ background: autoStopHigh ? "#0d631b" : "#525252" }}>
              <input type="checkbox" checked={autoStopHigh} onChange={(e) => setAutoStopHigh(e.target.checked)} className="sr-only" />
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${autoStopHigh ? "translate-x-4" : "translate-x-0.5"}`} />
            </label>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Trigger Point</span>
            <div className="flex items-center gap-1">
              <span className="font-mono">&gt;</span>
              <Input type="number" min={0} value={pressureHigh} onChange={(e) => setPressureHigh(e.target.value)} className="w-16 h-6 text-xs bg-neutral-700 text-white ring-0 border-0" />
              <span className="font-mono">BAR</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Delay</span>
            <Input type="number" min={0} value={autoStopHighDelay} onChange={(e) => setAutoStopHighDelay(e.target.value)} disabled={!autoStopHigh} className="w-16 h-6 text-xs bg-neutral-700 text-white ring-0 border-0" />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Open Valves</span>
            <label className="relative inline-flex h-4 w-7 items-center rounded-full cursor-pointer" style={{ background: autoStopOpenValves ? "#0d631b" : "#525252" }}>
              <input type="checkbox" checked={autoStopOpenValves} onChange={(e) => setAutoStopOpenValves(e.target.checked)} disabled={!autoStopHigh} className="sr-only" />
              <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform ${autoStopOpenValves ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </label>
          </div>
        </div>
        <div className="rounded-lg bg-neutral-800/50 p-4 ring-1 ring-neutral-700 space-y-2">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Fail-Safe Rearm</h4>
          <div className="flex items-center gap-3">
            <Input type="number" min={0} value={rearm} onChange={(e) => setRearm(e.target.value)} className="w-16 h-7 text-xs bg-neutral-700 text-white ring-0 border-0" />
            <span className="text-xs font-bold">minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
