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

/** RTDB / JSON peuvent renvoyer bool, nombre ou chaîne. */
export function parseRtdbBool(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

/** Fusionne plusieurs snapshots `status/...` (aliases device) : booléens en OU logique (aligné mère). */
function mergeGatewayStatusSnapshots(
  snaps: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null {
  const list = snaps.filter((s): s is Record<string, unknown> => s != null && typeof s === "object");
  if (list.length === 0) return null;
  const merged: Record<string, unknown> = Object.assign({}, ...list);
  let pumpOn = false;
  let valveOpenLegacy = false;
  let valveAOpen = false;
  let valveBOpen = false;
  for (const s of list) {
    pumpOn = pumpOn || parseRtdbBool(s.pumpOn);
    valveOpenLegacy = valveOpenLegacy || parseRtdbBool(s.valveOpen);
    valveAOpen = valveAOpen || parseRtdbBool(s.valveAOpen);
    valveBOpen = valveBOpen || parseRtdbBool(s.valveBOpen);
  }
  if (!valveAOpen && valveOpenLegacy) valveAOpen = true;
  if (!valveBOpen && valveOpenLegacy) valveBOpen = true;
  const valveOpen = valveAOpen || valveBOpen;
  return {
    ...merged,
    pumpOn,
    valveOpen,
    valveAOpen,
    valveBOpen,
  };
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
        const pumpOn = parseRtdbBool(raw.pumpOn);
        const valveOpenLegacy = parseRtdbBool(raw.valveOpen);
        let valveAOpen = parseRtdbBool(raw.valveAOpen);
        let valveBOpen = parseRtdbBool(raw.valveBOpen);
        if (!valveAOpen && valveOpenLegacy) valveAOpen = true;
        if (!valveBOpen && valveOpenLegacy) valveBOpen = true;
        const valveOpen = valveAOpen || valveBOpen;
        return { pumpOn, valveOpen, valveAOpen, valveBOpen };
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
            const selected = mergeGatewayStatusSnapshots(paths.map((p) => map[p]));
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
