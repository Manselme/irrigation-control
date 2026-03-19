"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Module } from "@/types";
import { buildGatewayDeviceIds, buildGatewaySensorPaths } from "@/lib/gatewayDevicePaths";

function sensorPaths(
  userId: string,
  moduleId: string,
  mod?: Module
): string[] {
  if (mod?.gatewayId) {
    const ids = buildGatewayDeviceIds({
      moduleType: mod.type,
      deviceId: mod.deviceId,
      moduleId: mod.id || moduleId,
      factoryId: mod.factoryId,
    });
    const paths = buildGatewaySensorPaths(mod.gatewayId, ids);
    if (paths.length > 0) return paths;
  }
  return [`users/${userId}/sensorData/${moduleId}/latest`];
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
    const snapshotsByModule: Record<string, Record<string, number | null>> = {};

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
      const paths = sensorPaths(userId, moduleId, mod);
      snapshotsByModule[moduleId] = {};
      paths.forEach((path) => {
        const sensorRef = ref(getFirebaseDb(), path);
        const unsub = onValue(sensorRef, (snap) => {
          const byPath = snapshotsByModule[moduleId] ?? {};
          if (!snap.exists()) {
            byPath[path] = null;
          } else {
            const v = (snap.val() as { humidity?: number })?.humidity;
            byPath[path] = typeof v === "number" ? v : null;
          }
          snapshotsByModule[moduleId] = byPath;

          const selected = paths.map((p) => byPath[p]).find((v) => typeof v === "number");
          if (typeof selected === "number") values[moduleId] = selected;
          else delete values[moduleId];
          updateAvg();
        });
        unsubscribes.push(() => unsub());
      });
    });

    return () => unsubscribes.forEach((u) => u());
  }, [
    userId,
    fieldModuleIds.join(","),
    modules?.map((m) => `${m.id}:${m.type}:${m.gatewayId ?? ""}:${m.deviceId ?? ""}:${m.factoryId ?? ""}`).join(","),
  ]);

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
    const snapshotsByZoneModule: Record<string, Record<string, Record<string, number | null>>> = {};

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
      snapshotsByZoneModule[zone.id] = {};
      zone.fieldModuleIds.forEach((moduleId) => {
        const mod = modules?.find((m) => m.id === moduleId);
        const paths = sensorPaths(userId, moduleId, mod);
        snapshotsByZoneModule[zone.id][moduleId] = {};
        paths.forEach((path) => {
          const sensorRef = ref(getFirebaseDb(), path);
          const unsub = onValue(sensorRef, (snap) => {
            const byModule = snapshotsByZoneModule[zone.id]?.[moduleId] ?? {};
            if (!snap.exists()) {
              byModule[path] = null;
            } else {
              const v = (snap.val() as { humidity?: number })?.humidity;
              byModule[path] = typeof v === "number" ? v : null;
            }
            if (!snapshotsByZoneModule[zone.id]) snapshotsByZoneModule[zone.id] = {};
            snapshotsByZoneModule[zone.id][moduleId] = byModule;

            const selected = paths.map((p) => byModule[p]).find((v) => typeof v === "number");
            if (typeof selected === "number") values[zone.id][moduleId] = selected;
            else delete values[zone.id][moduleId];
            updateZone(zone.id);
          });
          unsubscribes.push(() => unsub());
        });
      });
    });

    return () => unsubscribes.forEach((u) => u());
  }, [
    userId,
    zones.map((z) => z.id + ":" + z.fieldModuleIds.join(",")).join(";"),
    modules?.map((m) => `${m.id}:${m.type}:${m.gatewayId ?? ""}:${m.deviceId ?? ""}:${m.factoryId ?? ""}`).join(","),
  ]);

  return byZone;
}
