"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AlertConfig, Module } from "@/types";
import { useSendCommand } from "@/lib/hooks/useCommands";
import { useAllPumpStates } from "@/lib/hooks/useAllPumpStates";
import { resolveGatewaySendCommandOpts } from "@/lib/gatewayDevicePaths";

type PumpPressureSafetyState = {
  firstLowAt?: number;
  firstHighAt?: number;
  lastActionAt?: number;
};

export function AutoPumpStopOnLowPressure({
  userId,
  config,
  modules,
}: {
  userId: string | undefined;
  config: AlertConfig | undefined;
  modules: Module[];
}) {
  const { sendCommand } = useSendCommand(userId);

  const pumpModules = useMemo(() => modules.filter((m) => m.type === "pump"), [modules]);
  const pumpRefs = useMemo(
    () =>
      pumpModules.map((m) => ({
        moduleId: m.id,
        gatewayId: m.gatewayId,
        deviceId: m.deviceId,
        moduleType: m.type,
        factoryId: m.factoryId,
      })),
    [pumpModules]
  );
  const pumpStates = useAllPumpStates(userId, pumpRefs);

  const stateByPumpRef = useRef<Record<string, PumpPressureSafetyState>>({});

  useEffect(() => {
    if (!userId || !config) return;
    const lowEnabled = !!config.autoStopOnLowPressure;
    const highEnabled = !!config.autoStopOnHighPressure;
    if (!lowEnabled && !highEnabled) return;

    const lowThreshold = config.pressureDropThreshold;
    const highThreshold = config.pressureHighThreshold;

    const lowDelayMs = Math.max(0, (config.autoStopLowPressureDelaySec ?? 5) * 1000);
    const highDelayMs = Math.max(0, (config.autoStopHighPressureDelaySec ?? 1) * 1000);
    const closeValves = config.autoStopCloseValves ?? true;
    const openValves = config.autoStopOpenValves ?? true;
    const now = Date.now();

    pumpModules.forEach((pump) => {
      const st = pumpStates[pump.id];
      if (!st?.pumpOn) {
        const s0 = stateByPumpRef.current[pump.id];
        if (s0) {
          delete s0.firstLowAt;
          delete s0.firstHighAt;
        }
        return;
      }

      // On ne déclenche que si on a une pression calculée (bar).
      const pbar = pump.pressure;
      if (typeof pbar !== "number" || !Number.isFinite(pbar)) return;

      const s = (stateByPumpRef.current[pump.id] ??= {});

      const opts = resolveGatewaySendCommandOpts(pump) ?? undefined;

      // Cooldown: évite de spammer si la pression reste hors seuil.
      if (s.lastActionAt && now - s.lastActionAt < 60_000) return;

      // Surpression: ouvrir vannes puis couper pompe.
      if (highEnabled && typeof highThreshold === "number" && Number.isFinite(highThreshold)) {
        const high = pbar > highThreshold;
        if (!high) {
          delete s.firstHighAt;
        } else {
          if (!s.firstHighAt) s.firstHighAt = now;
          if (now - s.firstHighAt >= highDelayMs) {
            s.lastActionAt = now;
            void (async () => {
              if (openValves) await sendCommand(pump.id, "VALVE_OPEN", opts);
              await sendCommand(pump.id, "PUMP_OFF", opts);
            })();
            return;
          }
        }
      }

      // Sous-pression: couper pompe puis fermer vannes (optionnel).
      if (lowEnabled && typeof lowThreshold === "number" && Number.isFinite(lowThreshold)) {
        const low = pbar < lowThreshold;
        if (!low) {
          delete s.firstLowAt;
          return;
        }
        if (!s.firstLowAt) s.firstLowAt = now;
        if (now - s.firstLowAt < lowDelayMs) return;
        s.lastActionAt = now;
        void (async () => {
          await sendCommand(pump.id, "PUMP_OFF", opts);
          if (closeValves) await sendCommand(pump.id, "VALVE_CLOSE", opts);
        })();
      }
    });
  }, [userId, config, pumpModules, pumpStates, sendCommand]);

  return null;
}

