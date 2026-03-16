"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

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
    const path =
      gatewayOpts?.gatewayId && gatewayOpts?.deviceId
        ? `gateways/${gatewayOpts.gatewayId}/sensors/${gatewayOpts.deviceId}`
        : `users/${userId}/sensorData/${moduleId}/latest`;
    const sensorRef = ref(getFirebaseDb(), path);
    const unsubscribe = onValue(sensorRef, (snap) => {
      if (!snap.exists()) {
        setData(null);
        return;
      }
      const v = snap.val() as Record<string, unknown>;
      setData({
        timestamp: (v?.timestamp as number) ?? 0,
        humidity: v?.humidity as number | undefined,
        ph: v?.ph as number | undefined,
        battery: v?.battery as number | undefined,
        tension_cb: v?.tension_cb as number | undefined,
        humidity_10cm: v?.humidity_10cm as number | undefined,
        humidity_30cm: v?.humidity_30cm as number | undefined,
      });
    });
    return () => unsubscribe();
  }, [userId, moduleId, gatewayOpts?.gatewayId, gatewayOpts?.deviceId]);

  return data;
}
