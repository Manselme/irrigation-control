"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { LatestSensorSnapshot } from "./useSensorData";
import type { Module } from "@/types";
import { buildGatewayDeviceIds, buildGatewaySensorPaths } from "@/lib/gatewayDevicePaths";

export function useLatestSensorMap(
  userId: string | undefined,
  modules: Module[]
): Record<string, LatestSensorSnapshot | null> {
  const [map, setMap] = useState<Record<string, LatestSensorSnapshot | null>>({});

  useEffect(() => {
    if (!userId || modules.length === 0) {
      setMap({});
      return;
    }
    const unsubscribes: (() => void)[] = [];
    const snapshotsByModule: Record<string, Record<string, Record<string, unknown> | null>> = {};

    modules.forEach((module) => {
      const toSnapshot = (v: Record<string, unknown> | null): LatestSensorSnapshot | null => {
        if (!v) return null;
        return {
          timestamp: (v?.timestamp as number) ?? 0,
          humidity: v?.humidity as number | undefined,
          ph: v?.ph as number | undefined,
          battery: v?.battery as number | undefined,
          tension_cb: v?.tension_cb as number | undefined,
          humidity_10cm: v?.humidity_10cm as number | undefined,
          humidity_30cm: v?.humidity_30cm as number | undefined,
        };
      };

      if (module.gatewayId) {
        const ids = buildGatewayDeviceIds({
          moduleType: module.type,
          deviceId: module.deviceId,
          moduleId: module.id,
          factoryId: module.factoryId,
        });
        const paths = buildGatewaySensorPaths(module.gatewayId, ids);
        snapshotsByModule[module.id] = {};
        paths.forEach((path) => {
          const sensorRef = ref(getFirebaseDb(), path);
          const unsub = onValue(sensorRef, (snap) => {
            const cache = snapshotsByModule[module.id] ?? {};
            cache[path] = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
            snapshotsByModule[module.id] = cache;
            const selected = paths.map((p) => cache[p]).find((v) => v != null) ?? null;
            setMap((prev) => ({ ...prev, [module.id]: toSnapshot(selected) }));
          });
          unsubscribes.push(() => unsub());
        });
        return;
      }

      const sensorRef = ref(getFirebaseDb(), `users/${userId}/sensorData/${module.id}/latest`);
      const unsub = onValue(sensorRef, (snap) => {
        const raw = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
        setMap((prev) => ({ ...prev, [module.id]: toSnapshot(raw) }));
      });
      unsubscribes.push(() => unsub());
    });

    return () => unsubscribes.forEach((u) => u());
  }, [userId, modules.map((m) => `${m.id}:${m.type}:${m.gatewayId ?? ""}:${m.deviceId ?? ""}:${m.factoryId ?? ""}`).join(",")]);

  return map;
}
