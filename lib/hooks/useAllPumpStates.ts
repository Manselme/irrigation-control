"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { ModuleType } from "@/types";
import { buildGatewayDeviceIds, buildGatewayStatusPaths } from "@/lib/gatewayDevicePaths";

export interface PumpState {
  pumpOn: boolean;
  valveOpen: boolean;
  valveAOpen: boolean;
  valveBOpen: boolean;
}

export interface PumpModuleRef {
  moduleId: string;
  gatewayId?: string;
  deviceId?: string;
  moduleType?: ModuleType;
  factoryId?: string;
}

export function useAllPumpStates(
  userId: string | undefined,
  pumps: PumpModuleRef[]
): Record<string, PumpState> {
  const [states, setStates] = useState<Record<string, PumpState>>({});

  useEffect(() => {
    if (!userId || pumps.length === 0) {
      setStates({});
      return;
    }
    const unsubs: (() => void)[] = [];
    const snapshotsByModule: Record<string, Record<string, Record<string, unknown> | null>> = {};

    pumps.forEach(({ moduleId, gatewayId, deviceId, moduleType, factoryId }) => {
      const resolveState = (raw: Record<string, unknown> | null): PumpState => {
        if (!raw) return { pumpOn: false, valveOpen: false, valveAOpen: false, valveBOpen: false };
        return {
          pumpOn: (raw as { pumpOn?: boolean })?.pumpOn ?? false,
          valveOpen: (raw as { valveOpen?: boolean })?.valveOpen ?? false,
          valveAOpen:
            (raw as { valveAOpen?: boolean })?.valveAOpen ??
            (raw as { valveOpen?: boolean })?.valveOpen ??
            false,
          valveBOpen:
            (raw as { valveBOpen?: boolean })?.valveBOpen ??
            (raw as { valveOpen?: boolean })?.valveOpen ??
            false,
        };
      };

      if (gatewayId) {
        const ids = buildGatewayDeviceIds({
          moduleType: moduleType ?? "pump",
          deviceId,
          moduleId,
          factoryId,
        });
        const paths = buildGatewayStatusPaths(gatewayId, ids);
        snapshotsByModule[moduleId] = {};
        paths.forEach((path) => {
          const stateRef = ref(getFirebaseDb(), path);
          const unsub = onValue(stateRef, (snap) => {
            const map = snapshotsByModule[moduleId] ?? {};
            map[path] = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
            snapshotsByModule[moduleId] = map;
            const selected = paths.map((p) => map[p]).find((v) => v != null) ?? null;
            setStates((prev) => ({ ...prev, [moduleId]: resolveState(selected) }));
          });
          unsubs.push(unsub);
        });
        return;
      }

      const stateRef = ref(getFirebaseDb(), `users/${userId}/actuatorState/${moduleId}`);
      const unsub = onValue(stateRef, (snap) => {
        const raw = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
        setStates((prev) => ({ ...prev, [moduleId]: resolveState(raw) }));
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [userId, pumps.map((p) => `${p.moduleId}:${p.gatewayId ?? ""}:${p.deviceId ?? ""}:${p.moduleType ?? ""}:${p.factoryId ?? ""}`).join(",")]);

  return states;
}
