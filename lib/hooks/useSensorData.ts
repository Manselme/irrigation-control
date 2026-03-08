"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface LatestSensorSnapshot {
  timestamp: number;
  humidity?: number;
  ph?: number;
  battery?: number;
}

export function useLatestSensorData(
  userId: string | undefined,
  moduleId: string | undefined
): LatestSensorSnapshot | null {
  const [data, setData] = useState<LatestSensorSnapshot | null>(null);

  useEffect(() => {
    if (!userId || !moduleId) {
      setData(null);
      return;
    }
    const sensorRef = ref(
      getFirebaseDb(),
      `users/${userId}/sensorData/${moduleId}/latest`
    );
    const unsubscribe = onValue(sensorRef, (snap) => {
      if (!snap.exists()) {
        setData(null);
        return;
      }
      const v = snap.val();
      setData({
        timestamp: v?.timestamp ?? 0,
        humidity: v?.humidity,
        ph: v?.ph,
        battery: v?.battery,
      });
    });
    return () => unsubscribe();
  }, [userId, moduleId]);

  return data;
}
