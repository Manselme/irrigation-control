"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, get, set, push, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Zone } from "@/types";

/** Supprime les clés `undefined` (Firebase RTDB les refuse). */
function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    const next = stripUndefinedDeep(v);
    if (next !== undefined) out[k] = next;
  }
  return out;
}

function normalizePolygon(raw: unknown): Zone["polygon"] {
  if (
    typeof raw === "object" &&
    raw != null &&
    (raw as { type?: unknown }).type === "Polygon" &&
    Array.isArray((raw as { coordinates?: unknown }).coordinates)
  ) {
    return raw as Zone["polygon"];
  }
  return { type: "Polygon", coordinates: [] };
}

function parseZone(id: string, data: Record<string, unknown>): Zone {
  const polygon = normalizePolygon(data.polygon);
  const sectorsRaw = Array.isArray(data.sectors) ? data.sectors : null;
  const sectors =
    sectorsRaw?.map((sector, index) => {
      const s = sector as Record<string, unknown>;
      return {
        id: typeof s.id === "string" ? s.id : `sector-${index + 1}`,
        name: typeof s.name === "string" ? s.name : `Secteur ${index + 1}`,
        polygon: normalizePolygon(s.polygon),
        valveModuleIds: Array.isArray(s.valveModuleIds)
          ? (s.valveModuleIds as string[])
          : [],
        valveSlot:
          s.valveSlot === "A" || s.valveSlot === "B" || s.valveSlot === "AB"
            ? (s.valveSlot as "A" | "B" | "AB")
            : undefined,
      };
    }) ?? [
      {
        id: "sector-main",
        name: "Secteur principal",
        polygon,
        valveModuleIds: [],
      },
    ];
  const pumpModuleId = data.pumpModuleId as string | undefined;
  const pumpModuleIds = Array.isArray(data.pumpModuleIds)
    ? (data.pumpModuleIds as string[])
    : pumpModuleId
      ? [pumpModuleId]
      : [];
  return {
    id,
    farmId: (data.farmId as string) ?? "",
    name: (data.name as string) ?? "",
    polygon,
    sectors,
    mode: (data.mode as Zone["mode"]) ?? "manual",
    pumpModuleId,
    pumpModuleIds,
    valveModuleIds: Array.isArray(data.valveModuleIds)
      ? (data.valveModuleIds as string[])
      : [],
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
          | "name"
          | "polygon"
          | "sectors"
          | "mode"
          | "pumpModuleId"
          | "pumpModuleIds"
          | "valveModuleIds"
          | "fieldModuleIds"
          | "autoRules"
        >
      >
    ): Promise<void> => {
      if (!userId) return;
      const zoneRef = ref(getFirebaseDb(), `users/${userId}/zones/${zoneId}`);
      const snap = await get(zoneRef);
      if (!snap.exists()) return;
      const current = snap.val();
      const merged = { ...current, ...updates } as Record<string, unknown>;
      const nextPumpModuleIds = Array.isArray(merged.pumpModuleIds)
        ? (merged.pumpModuleIds as string[])
        : [];

      const userClearedPump =
        Object.prototype.hasOwnProperty.call(updates, "pumpModuleIds") &&
        Array.isArray(updates.pumpModuleIds) &&
        updates.pumpModuleIds.length === 0;

      if (userClearedPump) {
        merged.pumpModuleId = null;
        merged.pumpModuleIds = [];
      } else {
        if (merged.pumpModuleId == null && nextPumpModuleIds.length > 0) {
          merged.pumpModuleId = nextPumpModuleIds[0];
        }
        if (typeof merged.pumpModuleId === "string" && nextPumpModuleIds.length === 0) {
          merged.pumpModuleIds = [merged.pumpModuleId];
        }
      }

      const cleaned = stripUndefinedDeep(merged) as Record<string, unknown>;
      await set(zoneRef, cleaned);
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
