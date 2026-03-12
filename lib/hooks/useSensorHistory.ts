"use client";

import { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface SensorHistoryPoint {
  timestamp: number;
  humidity?: number;
  ph?: number;
  battery?: number;
  tension_cb?: number;
  humidity_10cm?: number;
  humidity_30cm?: number;
}

export function useSensorHistory(
  userId: string | undefined,
  moduleId: string | undefined,
  days: number = 30
): SensorHistoryPoint[] {
  const [points, setPoints] = useState<SensorHistoryPoint[]>([]);
  const rangeMs = days * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (!userId || !moduleId) {
      setPoints([]);
      return;
    }
    const sensorRef = ref(getFirebaseDb(), `users/${userId}/sensorData/${moduleId}`);
    get(sensorRef).then((snap) => {
      if (!snap.exists()) {
        setPoints([]);
        return;
      }
      const data = snap.val();
      const cutoff = Date.now() - rangeMs;
      const list: SensorHistoryPoint[] = [];
      Object.entries(data).forEach(([key, v]) => {
        const val = v as Record<string, unknown>;
        const ts =
          typeof val.timestamp === "number"
            ? val.timestamp
            : key !== "latest" && !Number.isNaN(Number(key))
              ? Number(key)
              : key === "latest"
                ? (val.timestamp as number) ?? Date.now()
                : 0;
        if (ts < cutoff || ts > Date.now() + 60000) return;
        list.push({
          timestamp: ts,
          humidity: val.humidity as number | undefined,
          ph: val.ph as number | undefined,
          battery: val.battery as number | undefined,
          tension_cb: val.tension_cb as number | undefined,
          humidity_10cm: val.humidity_10cm as number | undefined,
          humidity_30cm: val.humidity_30cm as number | undefined,
        });
      });
      list.sort((a, b) => a.timestamp - b.timestamp);
      setPoints(list);
    });
  }, [userId, moduleId, rangeMs]);

  return points;
}
