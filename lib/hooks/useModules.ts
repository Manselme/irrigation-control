"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, get, set, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Module, ModuleType } from "@/types";

const DEFAULT_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isModuleOnline(lastSeen: number, thresholdMs: number): boolean {
  return lastSeen > 0 && Date.now() - lastSeen < thresholdMs;
}

function parseModule(
  id: string,
  data: Record<string, unknown>,
  offlineThresholdMs: number
): Module {
  const lastSeen = (data.lastSeen as number) ?? 0;
  return {
    id,
    type: (data.type as ModuleType) ?? "field",
    farmId: (data.farmId as string) ?? "",
    zoneId: data.zoneId as string | undefined,
    lastSeen,
    battery: data.battery as number | undefined,
    online: isModuleOnline(lastSeen, offlineThresholdMs),
    position: data.position as Module["position"],
    pressure: data.pressure as number | undefined,
    name: data.name as string | undefined,
  };
}

export interface UseModulesOptions {
  /** Seuil en minutes au-delà duquel un module est considéré hors ligne (aligné sur la config alertes). Défaut 5. */
  offlineThresholdMinutes?: number;
}

export function useModules(
  userId: string | undefined,
  options?: UseModulesOptions
) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(!!userId);
  const thresholdMs =
    (options?.offlineThresholdMinutes ?? 5) * 60 * 1000;

  useEffect(() => {
    if (!userId) {
      setModules([]);
      setLoading(false);
      return;
    }
    const modulesRef = ref(getFirebaseDb(), `users/${userId}/modules`);
    const unsubscribe = onValue(modulesRef, (snap) => {
      if (!snap.exists()) {
        setModules([]);
      } else {
        const data = snap.val();
        setModules(
          Object.entries(data).map(([id, v]) =>
            parseModule(id, v as Record<string, unknown>, thresholdMs)
          )
        );
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId, thresholdMs]);

  const addModule = useCallback(
    async (moduleId: string, type: ModuleType, farmId: string) => {
      if (!userId) return;
      const moduleRef = ref(getFirebaseDb(), `users/${userId}/modules/${moduleId}`);
      await set(moduleRef, {
        type,
        farmId,
        lastSeen: 0,
        online: false,
        fieldModuleIds: type === "field" ? [] : undefined,
      });
    },
    [userId]
  );

  const removeModule = useCallback(
    async (moduleId: string) => {
      if (!userId) return;
      const moduleRef = ref(getFirebaseDb(), `users/${userId}/modules/${moduleId}`);
      await set(moduleRef, null);
    },
    [userId]
  );

  const updateModule = useCallback(
    async (
      moduleId: string,
      updates: Partial<
        Pick<
          Module,
          "battery" | "online" | "pressure" | "position" | "name" | "lastSeen"
        >
      >
    ) => {
      if (!userId) return;
      const moduleRef = ref(getFirebaseDb(), `users/${userId}/modules/${moduleId}`);
      const snap = await get(moduleRef);
      if (!snap.exists()) return;
      const current = snap.val() as Record<string, unknown>;
      const next = { ...current, ...updates };
      await set(moduleRef, next);
    },
    [userId]
  );

  return { modules, loading, addModule, removeModule, updateModule };
}

export function useModuleStatus(
  userId: string | undefined,
  moduleId: string | undefined,
  offlineThresholdMinutes: number = 5
): { online: boolean } {
  const [online, setOnline] = useState(false);
  const thresholdMs = offlineThresholdMinutes * 60 * 1000;
  useEffect(() => {
    if (!userId || !moduleId) {
      setOnline(false);
      return;
    }
    const moduleRef = ref(getFirebaseDb(), `users/${userId}/modules/${moduleId}`);
    const unsubscribe = onValue(moduleRef, (snap) => {
      if (!snap.exists()) {
        setOnline(false);
        return;
      }
      const d = snap.val();
      const lastSeen = (d?.lastSeen as number) ?? 0;
      setOnline(isModuleOnline(lastSeen, thresholdMs));
    });
    return () => unsubscribe();
  }, [userId, moduleId, thresholdMs]);
  return { online };
}
