"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { LatestSensorSnapshot } from "./useSensorData";

export function useLatestSensorMap(
  userId: string | undefined,
  moduleIds: string[]
): Record<string, LatestSensorSnapshot | null> {
  const [map, setMap] = useState<Record<string, LatestSensorSnapshot | null>>({});

  useEffect(() => {
    if (!userId || moduleIds.length === 0) {
      setMap({});
      return;
    }
    const unsubscribes: (() => void)[] = [];
    const next: Record<string, LatestSensorSnapshot | null> = {};

    moduleIds.forEach((moduleId) => {
      const sensorRef = ref(
        getFirebaseDb(),
        `users/${userId}/sensorData/${moduleId}/latest`
      );
      const unsub = onValue(sensorRef, (snap) => {
        if (!snap.exists()) {
          next[moduleId] = null;
        } else {
          const v = snap.val();
          next[moduleId] = {
            timestamp: v?.timestamp ?? 0,
            humidity: v?.humidity,
            ph: v?.ph,
            battery: v?.battery,
          };
        }
        setMap((prev) => ({ ...prev, ...next }));
      });
      unsubscribes.push(() => unsub());
    });

    return () => unsubscribes.forEach((u) => u());
  }, [userId, moduleIds.join(",")]);

  return map;
}
