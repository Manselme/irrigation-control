"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export function useWeeklyFlowEstimate(userId: string | undefined): number | null {
  const [byPump, setByPump] = useState<Record<string, Record<string, { volume_m3?: number }>>>({});

  useEffect(() => {
    if (!userId) {
      setByPump({});
      return;
    }
    const flowRef = ref(getFirebaseDb(), `users/${userId}/flowEstimates/byPump`);
    const unsub = onValue(flowRef, (snap) => {
      if (!snap.exists()) {
        setByPump({});
        return;
      }
      setByPump(snap.val() as Record<string, Record<string, { volume_m3?: number }>>);
    });
    return () => unsub();
  }, [userId]);

  return useMemo(() => {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let total = 0;
    Object.values(byPump).forEach((pumpDays) => {
      Object.entries(pumpDays ?? {}).forEach(([date, day]) => {
        if (date < cutoffDate) return;
        const volume = Number(day?.volume_m3 ?? 0);
        if (Number.isFinite(volume)) total += volume;
      });
    });
    return total > 0 ? total : null;
  }, [byPump]);
}

