"use client";

import { useMemo, useState } from "react";
import {
  createSimulatorAdapter,
  type SimulatorAdapter,
  type SimulatorLogEntry,
  type SimulatorMode,
} from "@/lib/simulator/adapter";

function createSandboxKey(): string {
  return `sbx-${Date.now().toString(36)}`;
}

export interface SimulationStore {
  mode: SimulatorMode;
  setMode: (mode: SimulatorMode) => void;
  liveArmed: boolean;
  armLive: (token: string) => boolean;
  disarmLive: () => void;
  sandboxKey: string;
  rotateSandbox: () => void;
  ackDelaySec: number;
  setAckDelaySec: (n: number) => void;
  forceAckTimeout: boolean;
  setForceAckTimeout: (value: boolean) => void;
  selectedGatewayId: string;
  setSelectedGatewayId: (gatewayId: string) => void;
  writeCount: number;
  resetWriteCount: () => void;
  logs: SimulatorLogEntry[];
  addLog: (entry: SimulatorLogEntry) => void;
  clearLogs: () => void;
  adapter: SimulatorAdapter | null;
}

export function useSimulationStore(userId: string | undefined): SimulationStore {
  const [mode, setModeState] = useState<SimulatorMode>("sandbox");
  const [liveArmed, setLiveArmed] = useState(false);
  const [sandboxKey, setSandboxKey] = useState(createSandboxKey());
  const [ackDelaySec, setAckDelaySecState] = useState(3);
  const [forceAckTimeout, setForceAckTimeout] = useState(false);
  const [selectedGatewayId, setSelectedGatewayId] = useState("");
  const [writeCount, setWriteCount] = useState(0);
  const [logs, setLogs] = useState<SimulatorLogEntry[]>([]);

  const addLog = (entry: SimulatorLogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 400));
  };
  const clearLogs = () => setLogs([]);

  const armLive = (token: string): boolean => {
    if (token.trim().toUpperCase() !== "LIVE") {
      addLog({ at: Date.now(), level: "warn", message: "Armement live refusé: token invalide." });
      return false;
    }
    setLiveArmed(true);
    addLog({ at: Date.now(), level: "warn", message: "Mode live armé." });
    return true;
  };

  const disarmLive = () => {
    setLiveArmed(false);
    if (mode === "live") setModeState("sandbox");
    addLog({ at: Date.now(), level: "info", message: "Mode live désarmé." });
  };

  const setMode = (nextMode: SimulatorMode) => {
    if (nextMode === "live" && !liveArmed) {
      addLog({ at: Date.now(), level: "warn", message: "Tentative live bloquée: armez d'abord le mode live." });
      return;
    }
    setModeState(nextMode);
    addLog({
      at: Date.now(),
      level: nextMode === "live" ? "warn" : "info",
      message:
        nextMode === "live"
          ? "Mode LIVE actif: les écritures toucheront les paths de production."
          : "Mode sandbox actif.",
    });
  };

  const rotateSandbox = () => {
    const next = createSandboxKey();
    setSandboxKey(next);
    addLog({ at: Date.now(), level: "info", message: `Nouvelle sandbox: ${next}` });
  };

  const setAckDelaySec = (n: number) => {
    const clamped = Math.max(1, Math.min(60, Math.round(n)));
    setAckDelaySecState(clamped);
  };

  const resetWriteCount = () => setWriteCount(0);

  const adapter = useMemo(() => {
    if (!userId) return null;
    return createSimulatorAdapter({
      userId,
      mode,
      sandboxKey,
      onLog: addLog,
      onWrite: () => setWriteCount((x) => x + 1),
    });
  }, [userId, mode, sandboxKey]);

  return {
    mode,
    setMode,
    liveArmed,
    armLive,
    disarmLive,
    sandboxKey,
    rotateSandbox,
    ackDelaySec,
    setAckDelaySec,
    forceAckTimeout,
    setForceAckTimeout,
    selectedGatewayId,
    setSelectedGatewayId,
    writeCount,
    resetWriteCount,
    logs,
    addLog,
    clearLogs,
    adapter,
  };
}

