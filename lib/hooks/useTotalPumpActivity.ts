"use client";

import { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { PumpActivityDay } from "./usePumpActivity";

export interface TotalPumpActivityResult {
  byDay: PumpActivityDay[];
  totalMinutes: number;
}

export function useTotalPumpActivity(
  userId: string | undefined,
  pumpModuleIds: string[],
  days: number = 7
): TotalPumpActivityResult {
  const [result, setResult] = useState<TotalPumpActivityResult>({
    byDay: [],
    totalMinutes: 0,
  });
  useEffect(() => {
    if (!userId || pumpModuleIds.length === 0) {
      setResult({ byDay: [], totalMinutes: 0 });
      return;
    }
    const rangeMs = days * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - rangeMs).toISOString().slice(0, 10);
    let cancelled = false;
    const byDate: Record<string, number> = {};

    const load = async () => {
      for (const moduleId of pumpModuleIds) {
        const activityRef = ref(getFirebaseDb(), `users/${userId}/pumpActivity/${moduleId}`);
        const snap = await get(activityRef);
        if (cancelled) return;
        if (!snap.exists()) continue;
        const data = snap.val() as Record<string, number | { minutes?: number }>;
        Object.entries(data).forEach(([date, value]) => {
          if (date < cutoff) return;
          const minutes = typeof value === "number" ? value : (value as { minutes?: number })?.minutes ?? 0;
          byDate[date] = (byDate[date] ?? 0) + minutes;
        });
      }
      if (cancelled) return;
      const byDay: PumpActivityDay[] = Object.entries(byDate)
        .map(([date, minutesOn]) => ({ date, minutesOn }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const totalMinutes = byDay.reduce((s, d) => s + d.minutesOn, 0);
      setResult({ byDay, totalMinutes });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, pumpModuleIds.join(","), days]);

  return result;
}
