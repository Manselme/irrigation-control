"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ref, get, set, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Module, ModuleType } from "@/types";

const DEFAULT_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/** Firebase Realtime Database n'accepte pas les valeurs undefined. Retourne une copie sans clés undefined. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj } as T;
  for (const key of Object.keys(out)) {
    if ((out as Record<string, unknown>)[key] === undefined) {
      delete (out as Record<string, unknown>)[key];
    }
  }
  return out;
}

function isModuleOnline(lastSeen: number, thresholdMs: number): boolean {
  return lastSeen > 0 && Date.now() - lastSeen < thresholdMs;
}

function parseTimestampMs(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Epoch en millisecondes (format attendu Firebase RTDB setTimestamp)
    if (raw >= 1_000_000_000_000) return raw;
    // Epoch en secondes (tolérance ancien format)
    if (raw >= 1_000_000_000) return raw * 1000;
    // Valeurs faibles (ex: uptime secondes) non exploitables comme timestamp absolu
    return null;
  }
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? parseTimestampMs(n) : null;
  }
  if (typeof raw === "object" && raw !== null && "toMillis" in raw) {
    try {
      return Number((raw as { toMillis: () => number }).toMillis());
    } catch {
      return null;
    }
  }
  return null;
}

function parseModule(
  id: string,
  data: Record<string, unknown>,
  offlineThresholdMs: number
): Module {
  type ValveConfig = { name?: string; zoneId?: string; status?: "ON" | "OFF" };
  const lastSeen = (data.lastSeen as number) ?? 0;
  const hydraulicSettingsRaw =
    typeof data.hydraulicSettings === "object" && data.hydraulicSettings != null
      ? (data.hydraulicSettings as Record<string, unknown>)
      : null;
  const valvesRaw =
    typeof data.valves === "object" && data.valves != null
      ? (data.valves as Record<string, unknown>)
      : null;
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
    factoryId: data.factoryId as string | undefined,
    gatewayId: data.gatewayId as string | undefined,
    deviceId: data.deviceId as string | undefined,
    hydraulicSettings: hydraulicSettingsRaw
      ? {
          pipeDiameterMm:
            typeof hydraulicSettingsRaw.pipeDiameterMm === "number"
              ? hydraulicSettingsRaw.pipeDiameterMm
              : undefined,
          referencePressureBar:
            typeof hydraulicSettingsRaw.referencePressureBar === "number"
              ? hydraulicSettingsRaw.referencePressureBar
              : undefined,
          updatedAt:
            typeof hydraulicSettingsRaw.updatedAt === "number"
              ? hydraulicSettingsRaw.updatedAt
              : undefined,
        }
      : undefined,
    valves: valvesRaw
      ? {
          A:
            typeof valvesRaw.A === "object" && valvesRaw.A != null
              ? (valvesRaw.A as ValveConfig)
              : undefined,
          B:
            typeof valvesRaw.B === "object" && valvesRaw.B != null
              ? (valvesRaw.B as ValveConfig)
              : undefined,
        }
      : undefined,
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
  const [gatewayLastSeenByModuleId, setGatewayLastSeenByModuleId] = useState<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(Date.now());
  const thresholdMs =
    (options?.offlineThresholdMinutes ?? 5) * 60 * 1000;

  useEffect(() => {
    if (!userId) {
      setModules([]);
      setLoading(false);
      return;
    }
    const modulesRef = ref(getFirebaseDb(), `users/${userId}/modules`);
    const unsubscribe = onValue(
      modulesRef,
      (snap) => {
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
      },
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Permission denied")) {
          console.warn("[Firebase] Permission denied sur modules. Vérifiez les règles et la connexion.");
        }
        console.error("[Firebase]", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId, thresholdMs]);

  const gatewayBoundModulesKey = useMemo(
    () =>
      modules
        .filter((m) => (m.type === "pump" || m.type === "field") && m.gatewayId && m.deviceId)
        .map((m) => `${m.id}:${m.gatewayId}:${m.deviceId}`)
        .join(","),
    [modules]
  );

  // Lecture du heartbeat/status réel côté passerelle pour les modules LoRa.
  useEffect(() => {
    if (!userId) {
      setGatewayLastSeenByModuleId({});
      return;
    }
    const tracked = modules.filter(
      (m) => (m.type === "pump" || m.type === "field") && m.gatewayId && m.deviceId
    );
    const trackedIds = new Set(tracked.map((m) => m.id));
    setGatewayLastSeenByModuleId((prev) => {
      const next: Record<string, number> = {};
      for (const [id, ts] of Object.entries(prev)) {
        if (trackedIds.has(id)) next[id] = ts;
      }
      return next;
    });

    if (tracked.length === 0) return;

    const unsubs: (() => void)[] = [];
    tracked.forEach((m) => {
      const statusRef = ref(getFirebaseDb(), `gateways/${m.gatewayId}/status/${m.deviceId}`);
      const unsub = onValue(
        statusRef,
        (snap) => {
          if (!snap.exists()) {
            setGatewayLastSeenByModuleId((prev) => ({ ...prev, [m.id]: 0 }));
            return;
          }
          const status = snap.val() as Record<string, unknown>;
          const tsFromStatus =
            parseTimestampMs(status?.lastSeenTs) ??
            parseTimestampMs(status?.lastSeen);
          // Ne jamais forcer Date.now() ici: sinon un reload peut marquer
          // à tort un module hors tension comme "en ligne" pendant quelques secondes.
          const effectiveTs = tsFromStatus ?? 0;
          setGatewayLastSeenByModuleId((prev) => {
            if (prev[m.id] === effectiveTs) return prev;
            return { ...prev, [m.id]: effectiveTs };
          });
        },
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("Permission denied")) {
            console.warn("[Firebase] Permission denied sur gateways/.../status. Vérifiez les règles.");
          }
          console.error("[Firebase]", err);
        }
      );
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [userId, gatewayBoundModulesKey, modules]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const modulesWithOnline = useMemo(
    () =>
      modules.map((m) => {
        const isGatewayBound =
          (m.type === "pump" || m.type === "field") &&
          m.gatewayId != null &&
          m.deviceId != null;
        if (!isGatewayBound) {
          const online = m.lastSeen > 0 && nowTick - m.lastSeen < thresholdMs;
          return { ...m, online };
        }
        const gatewayLastSeen = gatewayLastSeenByModuleId[m.id] ?? 0;
        return {
          ...m,
          lastSeen: gatewayLastSeen || m.lastSeen,
          online: gatewayLastSeen > 0 && nowTick - gatewayLastSeen < thresholdMs,
        };
      }),
    [modules, gatewayLastSeenByModuleId, nowTick, thresholdMs]
  );

  const addModule = useCallback(
    async (
      moduleId: string,
      type: ModuleType,
      farmId: string,
      factoryId?: string,
      options?: { gatewayId?: string; deviceId?: string }
    ) => {
      if (!userId) return;
      const id = options?.deviceId?.trim() || moduleId.trim();
      const moduleRef = ref(getFirebaseDb(), `users/${userId}/modules/${id}`);
      const payload: Record<string, unknown> = {
        type,
        farmId,
        lastSeen: 0,
        online: false,
      };
      if (type === "field") payload.fieldModuleIds = [];
      else delete (payload as Record<string, unknown>).fieldModuleIds;
      if (factoryId != null && /^[0-9A-Fa-f]{8}$/.test(factoryId)) {
        payload.factoryId = factoryId;
      }
      if (options?.gatewayId != null && options.gatewayId !== "")
        payload.gatewayId = options.gatewayId;
      if (options?.deviceId != null && options.deviceId !== "")
        payload.deviceId = options.deviceId.trim();
      await set(moduleRef, stripUndefined(payload));
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
          | "battery"
          | "online"
          | "pressure"
          | "position"
          | "name"
          | "lastSeen"
          | "factoryId"
          | "gatewayId"
          | "deviceId"
          | "hydraulicSettings"
          | "valves"
        >
      >
    ) => {
      if (!userId) return;
      const moduleRef = ref(getFirebaseDb(), `users/${userId}/modules/${moduleId}`);
      const snap = await get(moduleRef);
      if (!snap.exists()) return;
      const current = snap.val() as Record<string, unknown>;
      let next: Record<string, unknown> = stripUndefined({ ...current, ...updates });
      if (next.type !== "field" && "fieldModuleIds" in next) {
        next = { ...next };
        delete next.fieldModuleIds;
      }
      await set(moduleRef, next);
    },
    [userId]
  );

  return { modules: modulesWithOnline, loading, addModule, removeModule, updateModule };
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
