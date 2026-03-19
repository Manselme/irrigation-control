"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { buildGatewayDeviceIds, buildGatewaySensorPaths } from "@/lib/gatewayDevicePaths";

export interface LatestSensorSnapshot {
  timestamp: number;
  humidity?: number;
  ph?: number;
  battery?: number;
  tension_cb?: number;
  humidity_10cm?: number;
  humidity_30cm?: number;
}

export interface GatewaySensorOpts {
  gatewayId: string;
  deviceId: string;
}

export function useLatestSensorData(
  userId: string | undefined,
  moduleId: string | undefined,
  gatewayOpts?: GatewaySensorOpts
): LatestSensorSnapshot | null {
  const [data, setData] = useState<LatestSensorSnapshot | null>(null);

  useEffect(() => {
    if (!userId || !moduleId) {
      setData(null);
      return;
    }
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

    if (gatewayOpts?.gatewayId) {
      const ids = buildGatewayDeviceIds({
        deviceId: gatewayOpts.deviceId,
        moduleId,
      });
      const paths = buildGatewaySensorPaths(gatewayOpts.gatewayId, ids);
      const snapshots: Record<string, Record<string, unknown> | null> = {};
      const unsubscribes = paths.map((path) => {
        const sensorRef = ref(getFirebaseDb(), path);
        return onValue(sensorRef, (snap) => {
          snapshots[path] = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
          const selected = paths.map((p) => snapshots[p]).find((v) => v != null) ?? null;
          setData(toSnapshot(selected));
        });
      });
      return () => unsubscribes.forEach((u) => u());
    }

    const sensorRef = ref(getFirebaseDb(), `users/${userId}/sensorData/${moduleId}/latest`);
    const unsubscribe = onValue(sensorRef, (snap) => {
      const raw = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
      setData(toSnapshot(raw));
    });
    return () => unsubscribe();
  }, [userId, moduleId, gatewayOpts?.gatewayId, gatewayOpts?.deviceId]);

  return data;
}
