"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, off, get } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface PumpActivityDay {
  date: string;
  minutesOn: number;
  /** Volume d'eau (m³) si fourni par le débitmètre. Optionnel. */
  volume_m3?: number;
}

function toLocalYYYYMMDD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parsePumpActivityData(data: Record<string, unknown>, cutoff: string): PumpActivityDay[] {
  const list: PumpActivityDay[] = [];
  Object.entries(data).forEach(([date, value]) => {
    if (date < cutoff) return;
    const raw = value as { minutes?: number; volume_m3?: number } | number;
    const minutes = typeof raw === "number" ? raw : raw?.minutes ?? 0;
    const volume_m3 = typeof raw === "object" ? raw?.volume_m3 : undefined;
    list.push({ date, minutesOn: minutes, volume_m3 });
  });
  list.sort((a, b) => a.date.localeCompare(b.date));
  return list;
}

/** Intervalle de rafraîchissement (ms) pour forcer la mise à jour des données du jour */
const POLL_INTERVAL_MS = 15_000;

export function usePumpActivity(
  userId: string | undefined,
  moduleId: string | undefined,
  days: number = 30
): [PumpActivityDay[], () => void] {
  const [daysList, setDaysList] = useState<PumpActivityDay[]>([]);
  const rangeMs = days * 24 * 60 * 60 * 1000;

  const fetchActivity = useCallback(() => {
    if (!userId || !moduleId) return;
    const activityRef = ref(getFirebaseDb(), `users/${userId}/pumpActivity/${moduleId}`);
    const cutoff = toLocalYYYYMMDD(new Date(Date.now() - rangeMs));
    get(activityRef).then((snap) => {
      if (!snap.exists()) {
        setDaysList([]);
        return;
      }
      const data = snap.val() as Record<string, unknown>;
      setDaysList(parsePumpActivityData(data, cutoff));
    });
  }, [userId, moduleId, rangeMs]);

  useEffect(() => {
    if (!userId || !moduleId) {
      setDaysList([]);
      return;
    }
    const activityRef = ref(getFirebaseDb(), `users/${userId}/pumpActivity/${moduleId}`);
    const cutoff = toLocalYYYYMMDD(new Date(Date.now() - rangeMs));

    const handleSnapshot = (snap: { exists: () => boolean; val: () => Record<string, unknown> }) => {
      if (!snap.exists()) {
        setDaysList([]);
        return;
      }
      const data = snap.val();
      setDaysList(parsePumpActivityData(data, cutoff));
    };

    fetchActivity();
    const unsubscribe = onValue(activityRef, handleSnapshot);
    const pollId = setInterval(fetchActivity, POLL_INTERVAL_MS);

    return () => {
      unsubscribe();
      off(activityRef);
      clearInterval(pollId);
    };
  }, [userId, moduleId, rangeMs, fetchActivity]);

  return [daysList, fetchActivity];
}
