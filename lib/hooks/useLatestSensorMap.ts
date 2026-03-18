"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { LatestSensorSnapshot } from "./useSensorData";
import type { Module } from "@/types";

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
    const next: Record<string, LatestSensorSnapshot | null> = {};

    modules.forEach((module) => {
      const path =
        module.gatewayId && module.deviceId
          ? `gateways/${module.gatewayId}/sensors/${module.deviceId}`
          : `users/${userId}/sensorData/${module.id}/latest`;
      const sensorRef = ref(getFirebaseDb(), path);
      const unsub = onValue(sensorRef, (snap) => {
        if (!snap.exists()) {
          next[module.id] = null;
        } else {
          const v = snap.val();
          next[module.id] = {
            timestamp: v?.timestamp ?? 0,
            humidity: v?.humidity,
            ph: v?.ph,
            battery: v?.battery,
            tension_cb: v?.tension_cb,
            humidity_10cm: v?.humidity_10cm,
            humidity_30cm: v?.humidity_30cm,
          };
        }
        setMap((prev) => ({ ...prev, ...next }));
      });
      unsubscribes.push(() => unsub());
    });

    return () => unsubscribes.forEach((u) => u());
  }, [userId, modules.map((m) => `${m.id}:${m.gatewayId ?? ""}:${m.deviceId ?? ""}`).join(",")]);

  return map;
}
