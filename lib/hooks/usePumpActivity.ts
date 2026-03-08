"use client";

import { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface PumpActivityDay {
  date: string;
  minutesOn: number;
}

export function usePumpActivity(
  userId: string | undefined,
  moduleId: string | undefined,
  days: number = 30
): PumpActivityDay[] {
  const [daysList, setDaysList] = useState<PumpActivityDay[]>([]);
  const rangeMs = days * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (!userId || !moduleId) {
      setDaysList([]);
      return;
    }
    const activityRef = ref(getFirebaseDb(), `users/${userId}/pumpActivity/${moduleId}`);
    get(activityRef).then((snap) => {
      if (!snap.exists()) {
        setDaysList([]);
        return;
      }
      const data = snap.val();
      const cutoff = new Date(Date.now() - rangeMs).toISOString().slice(0, 10);
      const list: PumpActivityDay[] = [];
      Object.entries(data).forEach(([date, value]) => {
        if (date < cutoff) return;
        const minutes = typeof value === "number" ? value : (value as { minutes?: number })?.minutes ?? 0;
        list.push({ date, minutesOn: minutes });
      });
      list.sort((a, b) => a.date.localeCompare(b.date));
      setDaysList(list);
    });
  }, [userId, moduleId, rangeMs]);

  return daysList;
}
