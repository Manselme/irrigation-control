"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Module } from "@/types";

function sensorPath(
  userId: string,
  moduleId: string,
  mod?: Module
): string {
  if (mod?.gatewayId && mod?.deviceId)
    return `gateways/${mod.gatewayId}/sensors/${mod.deviceId}`;
  return `users/${userId}/sensorData/${moduleId}/latest`;
}

export function useZoneHumidity(
  userId: string | undefined,
  fieldModuleIds: string[],
  modules?: Module[]
): number | undefined {
  const [humidity, setHumidity] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!userId || fieldModuleIds.length === 0) {
      setHumidity(undefined);
      return;
    }
    const unsubscribes: (() => void)[] = [];
    const values: Record<string, number> = {};

    const updateAvg = () => {
      const list = Object.values(values);
      if (list.length === 0) {
        setHumidity(undefined);
        return;
      }
      setHumidity(list.reduce((a, b) => a + b, 0) / list.length);
    };

    fieldModuleIds.forEach((moduleId) => {
      const mod = modules?.find((m) => m.id === moduleId);
      const path = sensorPath(userId, moduleId, mod);
      const sensorRef = ref(getFirebaseDb(), path);
      const unsub = onValue(sensorRef, (snap) => {
        if (!snap.exists()) {
          delete values[moduleId];
        } else {
          const v = (snap.val() as { humidity?: number })?.humidity;
          if (typeof v === "number") values[moduleId] = v;
        }
        updateAvg();
      });
      unsubscribes.push(() => unsub());
    });

    return () => unsubscribes.forEach((u) => u());
  }, [userId, fieldModuleIds.join(","), modules?.map((m) => m.id).join(",")]);

  return humidity;
}

/** Returns humidity per zoneId for multiple zones (one subscription set per zone). */
export function useAllZonesHumidity(
  userId: string | undefined,
  zones: { id: string; fieldModuleIds: string[] }[],
  modules?: Module[]
): Record<string, number | undefined> {
  const [byZone, setByZone] = useState<Record<string, number | undefined>>({});

  useEffect(() => {
    if (!userId || zones.length === 0) {
      setByZone({});
      return;
    }
    const unsubscribes: (() => void)[] = [];
    const values: Record<string, Record<string, number>> = {};

    const updateZone = (zoneId: string) => {
      const list = Object.values(values[zoneId] ?? {});
      setByZone((prev) => ({
        ...prev,
        [zoneId]:
          list.length === 0
            ? undefined
            : list.reduce((a, b) => a + b, 0) / list.length,
      }));
    };

    zones.forEach((zone) => {
      values[zone.id] = {};
      zone.fieldModuleIds.forEach((moduleId) => {
        const mod = modules?.find((m) => m.id === moduleId);
        const path = sensorPath(userId, moduleId, mod);
        const sensorRef = ref(getFirebaseDb(), path);
        const unsub = onValue(sensorRef, (snap) => {
          if (!snap.exists()) {
            delete values[zone.id][moduleId];
          } else {
            const v = (snap.val() as { humidity?: number })?.humidity;
            if (typeof v === "number") values[zone.id][moduleId] = v;
          }
          updateZone(zone.id);
        });
        unsubscribes.push(() => unsub());
      });
    });

    return () => unsubscribes.forEach((u) => u());
  }, [
    userId,
    zones.map((z) => z.id + ":" + z.fieldModuleIds.join(",")).join(";"),
    modules?.map((m) => m.id).join(","),
  ]);

  return byZone;
}
