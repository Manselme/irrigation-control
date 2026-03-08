"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ref, get, set, push, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { AlertConfig, AlertNotification } from "@/types";
import type { Module } from "@/types";
import { checkModuleAlerts } from "@/lib/alertRules";
import type { LatestSensorSnapshot } from "./useSensorData";

export function useAlertConfig(userId: string | undefined) {
  const [config, setConfig] = useState<AlertConfig>({});
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setConfig({});
      setLoading(false);
      return;
    }
    const configRef = ref(getFirebaseDb(), `users/${userId}/alerts/config`);
    get(configRef).then((snap) => {
      setConfig((snap.val() as AlertConfig) ?? {});
      setLoading(false);
    });
  }, [userId]);

  const updateConfig = useCallback(
    async (updates: Partial<AlertConfig>) => {
      if (!userId) return;
      const configRef = ref(getFirebaseDb(), `users/${userId}/alerts/config`);
      const current = (await get(configRef)).val() ?? {};
      const merged = { ...current, ...updates };
      const cleaned = Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== undefined)
      ) as AlertConfig;
      await set(configRef, cleaned);
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    [userId]
  );

  return { config, loading, updateConfig };
}

export function useAlertNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const notifRef = ref(getFirebaseDb(), `users/${userId}/alerts/notifications`);
    const unsubscribe = onValue(notifRef, (snap) => {
      if (!snap.exists()) {
        setNotifications([]);
        return;
      }
      const data = snap.val();
      setNotifications(
        Object.entries(data).map(([id, v]) => ({
          id,
          ...(v as Omit<AlertNotification, "id">),
        }))
      );
    });
    return () => unsubscribe();
  }, [userId]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      const notifRef = ref(
        getFirebaseDb(),
        `users/${userId}/alerts/notifications/${notificationId}/read`
      );
      await set(notifRef, true);
    },
    [userId]
  );

  const addNotification = useCallback(
    async (n: Omit<AlertNotification, "id">) => {
      if (!userId) return;
      const notifRef = ref(getFirebaseDb(), `users/${userId}/alerts/notifications`);
      const newRef = push(notifRef);
      await set(newRef, {
        ...n,
        read: false,
      });
    },
    [userId]
  );

  return { notifications, markAsRead, addNotification };
}

const ALERT_TYPES = ["battery", "pressure", "offline"] as const;

export function useAlertDetection(
  userId: string | undefined,
  modules: Module[],
  config: AlertConfig,
  latestSensorByModule: Record<string, LatestSensorSnapshot | null>,
  existingNotifications: AlertNotification[],
  addNotification: (n: Omit<AlertNotification, "id">) => Promise<void>
) {
  const lastAlertedRef = useRef<Record<string, boolean>>({});
  const firstOkAtRef = useRef<Record<string, number>>({});
  const rearmMinutes = Math.max(0, config.rearmMinutes ?? 1);
  const rearmMs = rearmMinutes * 60 * 1000;

  useEffect(() => {
    if (!userId || !config) return;
    const now = Date.now();
    const hasUnread = (moduleId: string, type: string) =>
      existingNotifications.some(
        (n) => n.moduleId === moduleId && n.type === type && !n.read
      );
    modules.forEach((module) => {
      const result = checkModuleAlerts(
        module,
        config,
        latestSensorByModule[module.id] ?? null
      );
      if (result) {
        const key = `${module.id}:${result.type}`;
        delete firstOkAtRef.current[key];
        if (lastAlertedRef.current[key]) return;
        if (hasUnread(result.moduleId, result.type)) return;
        lastAlertedRef.current[key] = true;
        addNotification({
          type: result.type,
          message: result.message,
          moduleId: result.moduleId,
          createdAt: now,
          read: false,
        });
      } else {
        ALERT_TYPES.forEach((type) => {
          const key = `${module.id}:${type}`;
          const firstOk = firstOkAtRef.current[key];
          if (firstOk === undefined) {
            firstOkAtRef.current[key] = now;
          } else if (now - firstOk >= rearmMs) {
            lastAlertedRef.current[key] = false;
            delete firstOkAtRef.current[key];
          }
        });
      }
    });
  }, [userId, modules, config, latestSensorByModule, existingNotifications, addNotification, rearmMs]);
}
