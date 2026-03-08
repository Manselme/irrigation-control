"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, get, set, push, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Zone } from "@/types";

function parseZone(id: string, data: Record<string, unknown>): Zone {
  return {
    id,
    farmId: (data.farmId as string) ?? "",
    name: (data.name as string) ?? "",
    polygon: (data.polygon as Zone["polygon"]) ?? {
      type: "Polygon",
      coordinates: [],
    },
    mode: (data.mode as Zone["mode"]) ?? "manual",
    pumpModuleId: data.pumpModuleId as string | undefined,
    fieldModuleIds: Array.isArray(data.fieldModuleIds) ? data.fieldModuleIds : [],
    autoRules: data.autoRules as Zone["autoRules"],
  };
}

export function useZones(userId: string | undefined, farmId: string | null) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setZones([]);
      setLoading(false);
      return;
    }
    const zonesRef = ref(getFirebaseDb(), `users/${userId}/zones`);
    const unsubscribe = onValue(zonesRef, (snap) => {
      if (!snap.exists()) {
        setZones([]);
      } else {
        const data = snap.val();
        const list = Object.entries(data).map(([id, v]) =>
          parseZone(id, v as Record<string, unknown>)
        );
        setZones(
          farmId ? list.filter((z) => z.farmId === farmId) : list
        );
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId, farmId]);

  const addZone = useCallback(
    async (farmId: string, name: string, polygon: Zone["polygon"]) => {
      if (!userId) return;
      const zonesRef = ref(getFirebaseDb(), `users/${userId}/zones`);
      const newRef = push(zonesRef);
      await set(newRef, {
        farmId,
        name,
        polygon,
        mode: "manual",
        fieldModuleIds: [],
      });
      return newRef.key!;
    },
    [userId]
  );

  const updateZone = useCallback(
    async (
      zoneId: string,
      updates: Partial<
        Pick<
          Zone,
          "name" | "polygon" | "mode" | "pumpModuleId" | "fieldModuleIds" | "autoRules"
        >
      >
    ): Promise<void> => {
      if (!userId) return;
      const zoneRef = ref(getFirebaseDb(), `users/${userId}/zones/${zoneId}`);
      const snap = await get(zoneRef);
      if (!snap.exists()) return;
      const current = snap.val();
      await set(zoneRef, { ...current, ...updates });
    },
    [userId]
  );

  const removeZone = useCallback(
    async (zoneId: string) => {
      if (!userId) return;
      const zoneRef = ref(getFirebaseDb(), `users/${userId}/zones/${zoneId}`);
      await set(zoneRef, null);
    },
    [userId]
  );

  return { zones, loading, addZone, updateZone, removeZone };
}
