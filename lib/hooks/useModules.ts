"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, get, set, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Module, ModuleType } from "@/types";

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isModuleOnline(lastSeen: number): boolean {
  return Date.now() - lastSeen < OFFLINE_THRESHOLD_MS;
}

function parseModule(id: string, data: Record<string, unknown>): Module {
  const lastSeen = (data.lastSeen as number) ?? 0;
  return {
    id,
    type: (data.type as ModuleType) ?? "field",
    farmId: (data.farmId as string) ?? "",
    zoneId: data.zoneId as string | undefined,
    lastSeen,
    battery: data.battery as number | undefined,
    online: (data.online as boolean) ?? isModuleOnline(lastSeen),
    position: data.position as Module["position"],
    pressure: data.pressure as number | undefined,
    name: data.name as string | undefined,
  };
}

export function useModules(userId: string | undefined) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(!!userId);

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
            parseModule(id, v as Record<string, unknown>)
          )
        );
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

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
  moduleId: string | undefined
): { online: boolean } {
  const [online, setOnline] = useState(false);
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
      const lastSeen = d?.lastSeen ?? 0;
      setOnline(
        (d?.online as boolean) ?? isModuleOnline(lastSeen)
      );
    });
    return () => unsubscribe();
  }, [userId, moduleId]);
  return { online };
}
