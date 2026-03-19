"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, off, get } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { buildGatewayDeviceIds, buildGatewayPumpActivityPaths } from "@/lib/gatewayDevicePaths";

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

export interface PumpActivityGatewayOpts {
  gatewayId: string;
  deviceId: string;
}

export function usePumpActivity(
  userId: string | undefined,
  moduleId: string | undefined,
  days: number = 30,
  gatewayOpts?: PumpActivityGatewayOpts
): [PumpActivityDay[], () => void] {
  const [daysList, setDaysList] = useState<PumpActivityDay[]>([]);
  const rangeMs = days * 24 * 60 * 60 * 1000;

  const paths =
    gatewayOpts?.gatewayId
      ? buildGatewayPumpActivityPaths(
          gatewayOpts.gatewayId,
          buildGatewayDeviceIds({ deviceId: gatewayOpts.deviceId, moduleId })
        )
      : userId && moduleId
        ? [`users/${userId}/pumpActivity/${moduleId}`]
        : [];

  const fetchActivity = useCallback(() => {
    if (paths.length === 0) return;
    const cutoff = toLocalYYYYMMDD(new Date(Date.now() - rangeMs));
    const reads = paths.map((path) => get(ref(getFirebaseDb(), path)));
    Promise.all(reads).then((snaps) => {
      const firstExisting = snaps.find((s) => s.exists());
      if (!firstExisting) {
        setDaysList([]);
        return;
      }
      const data = firstExisting.val() as Record<string, unknown>;
      setDaysList(parsePumpActivityData(data, cutoff));
    });
  }, [paths.join("|"), rangeMs]);

  useEffect(() => {
    if (paths.length === 0) {
      setDaysList([]);
      return;
    }
    const cutoff = toLocalYYYYMMDD(new Date(Date.now() - rangeMs));
    const snapshotsByPath: Record<string, Record<string, unknown> | null> = {};

    const handleResolvedSnapshots = () => {
      const first = paths.map((p) => snapshotsByPath[p]).find((v) => v != null) ?? null;
      if (!first) {
        setDaysList([]);
        return;
      }
      setDaysList(parsePumpActivityData(first, cutoff));
    };

    fetchActivity();
    const unsubs = paths.map((path) =>
      onValue(ref(getFirebaseDb(), path), (snap) => {
        snapshotsByPath[path] = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
        handleResolvedSnapshots();
      })
    );
    const pollId = setInterval(fetchActivity, POLL_INTERVAL_MS);

    return () => {
      unsubs.forEach((u) => u());
      paths.forEach((path) => off(ref(getFirebaseDb(), path)));
      clearInterval(pollId);
    };
  }, [paths.join("|"), rangeMs, fetchActivity]);

  return [daysList, fetchActivity];
}
