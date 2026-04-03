"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ref, get, set, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Module, ModuleType } from "@/types";
import {
  buildGatewayDeviceIds,
  buildGatewaySensorPaths,
  buildGatewayStatusPaths,
} from "@/lib/gatewayDevicePaths";
import { barToPsi, psiToBar } from "@/lib/pumpPressure";

const DEFAULT_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
// Garde-fou UX: évite les faux "hors ligne" si le heartbeat LoRa est plus lent
// que la config d'alerte (ex: 0.2 min = 12s).
const MIN_GATEWAY_BOUND_OFFLINE_THRESHOLD_MS = 45 * 1000;

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

function parseHeartbeatCounter(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

function readPumpPressurePsiFromStatusCache(
  cache: Record<string, Record<string, unknown> | null>
): number | undefined {
  for (const st of Object.values(cache)) {
    if (!st) continue;
    const psi = st.pressurePsi;
    if (typeof psi === "number" && Number.isFinite(psi)) return psi;
    const bar = st.pressure;
    if (typeof bar === "number" && Number.isFinite(bar)) return barToPsi(bar);
  }
  return undefined;
}

function readPumpMoistureFromStatusCache(
  cache: Record<string, Record<string, unknown> | null>
): { moisturePct?: number; moistureMv?: number } {
  for (const st of Object.values(cache)) {
    if (!st) continue;
    const pct = st.moisturePct;
    const mv = st.moistureMv;
    const moisturePct =
      typeof pct === "number" && Number.isFinite(pct) ? pct : undefined;
    const moistureMv =
      typeof mv === "number" && Number.isFinite(mv) ? mv : undefined;
    if (moisturePct != null || moistureMv != null) return { moisturePct, moistureMv };
  }
  return {};
}

function readLatLngFromSensorSnapshot(
  data: Record<string, unknown> | null | undefined
): { lat: number; lng: number } | undefined {
  if (!data) return undefined;
  const lat = data.lat;
  const lng = data.lng;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return undefined;
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
          flowRateLitersPerMinute:
            typeof hydraulicSettingsRaw.flowRateLitersPerMinute === "number"
              ? hydraulicSettingsRaw.flowRateLitersPerMinute
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

export type UseModulesUpdatePayload = Partial<
  Pick<
    Module,
    | "battery"
    | "online"
    | "pressure"
    | "pressurePsi"
    | "moisturePct"
    | "moistureMv"
    | "position"
    | "name"
    | "lastSeen"
    | "factoryId"
    | "gatewayId"
    | "deviceId"
    | "hydraulicSettings"
    | "valves"
  >
>;

export function useModules(
  userId: string | undefined,
  options?: UseModulesOptions
) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(!!userId);
  const [gatewayLastSeenByModuleId, setGatewayLastSeenByModuleId] = useState<Record<string, number>>({});
  const [pumpPressurePsiByModuleId, setPumpPressurePsiByModuleId] = useState<
    Record<string, number | undefined>
  >({});
  const [pumpMoistureByModuleId, setPumpMoistureByModuleId] = useState<
    Record<string, { moisturePct?: number; moistureMv?: number } | undefined>
  >({});
  const [fieldGpsByModuleId, setFieldGpsByModuleId] = useState<
    Record<string, { lat: number; lng: number } | undefined>
  >({});
  const gatewayHeartbeatByModuleIdRef = useRef<Record<string, number>>({});
  const statusCacheByModuleRef = useRef<Record<string, Record<string, Record<string, unknown> | null>>>({});
  const sensorCacheByModuleRef = useRef<Record<string, Record<string, Record<string, unknown> | null>>>({});
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
      setFieldGpsByModuleId({});
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
    setPumpPressurePsiByModuleId((prev) => {
      const next: Record<string, number | undefined> = {};
      trackedIds.forEach((id) => {
        if (id in prev) next[id] = prev[id];
      });
      return next;
    });
    setPumpMoistureByModuleId((prev) => {
      const next: Record<string, { moisturePct?: number; moistureMv?: number } | undefined> = {};
      trackedIds.forEach((id) => {
        if (id in prev) next[id] = prev[id];
      });
      return next;
    });
    const fieldTrackedIds = new Set(
      tracked.filter((m) => m.type === "field").map((m) => m.id)
    );
    setFieldGpsByModuleId((prev) => {
      const next: Record<string, { lat: number; lng: number } | undefined> = {};
      fieldTrackedIds.forEach((id) => {
        if (id in prev) next[id] = prev[id];
      });
      return next;
    });
    {
      const nextHeartbeats: Record<string, number> = {};
      for (const [key, hb] of Object.entries(gatewayHeartbeatByModuleIdRef.current)) {
        const moduleId = key.includes("|") ? key.split("|")[0] : key;
        if (trackedIds.has(moduleId)) nextHeartbeats[key] = hb;
      }
      gatewayHeartbeatByModuleIdRef.current = nextHeartbeats;
    }
    {
      const nextStatusCache: Record<string, Record<string, Record<string, unknown> | null>> = {};
      trackedIds.forEach((moduleId) => {
        const existing = statusCacheByModuleRef.current[moduleId];
        if (existing) nextStatusCache[moduleId] = existing;
      });
      statusCacheByModuleRef.current = nextStatusCache;
    }
    {
      const nextSensorCache: Record<string, Record<string, Record<string, unknown> | null>> = {};
      fieldTrackedIds.forEach((moduleId) => {
        const existing = sensorCacheByModuleRef.current[moduleId];
        if (existing) nextSensorCache[moduleId] = existing;
      });
      sensorCacheByModuleRef.current = nextSensorCache;
    }

    if (tracked.length === 0) return;

    const unsubs: (() => void)[] = [];
    tracked.forEach((m) => {
      const ids = buildGatewayDeviceIds({
        moduleType: m.type,
        deviceId: m.deviceId,
        moduleId: m.id,
        factoryId: m.factoryId,
      });
      const statusPaths = buildGatewayStatusPaths(m.gatewayId!, ids);
      statusCacheByModuleRef.current[m.id] = {};

      const recomputeModuleLastSeen = () => {
        setGatewayLastSeenByModuleId((prev) => {
          const currentTs = prev[m.id] ?? 0;
          let nextTs = currentTs;
          const statusCache = statusCacheByModuleRef.current[m.id] ?? {};
          let hasAnySnapshot = false;
          let hasAnyParsableLastSeen = false;

          statusPaths.forEach((path) => {
            const status = statusCache[path];
            if (status == null) return;
            hasAnySnapshot = true;
            const rawLastSeen = status.lastSeenTs ?? status.lastSeen;
            const ts = parseTimestampMs(rawLastSeen);
            if (ts != null) {
              hasAnyParsableLastSeen = true;
              nextTs = Math.max(nextTs, ts);
              return;
            }
            const hb = parseHeartbeatCounter(rawLastSeen);
            if (hb == null) return;
            hasAnyParsableLastSeen = true;
            const hbKey = `${m.id}|${path}`;
            const prevHeartbeat = gatewayHeartbeatByModuleIdRef.current[hbKey];
            const progressed = prevHeartbeat == null || hb > prevHeartbeat;
            gatewayHeartbeatByModuleIdRef.current[hbKey] = hb;
            if (progressed) nextTs = Math.max(nextTs, Date.now());
          });

          if (!hasAnySnapshot || !hasAnyParsableLastSeen) {
            nextTs = 0;
          }

          if (currentTs === nextTs) return prev;
          return { ...prev, [m.id]: nextTs };
        });
      };

      statusPaths.forEach((path) => {
        const statusRef = ref(getFirebaseDb(), path);
        const unsub = onValue(
          statusRef,
          (snap) => {
            const statusCache = statusCacheByModuleRef.current[m.id] ?? {};
            statusCache[path] = snap.exists() ? (snap.val() as Record<string, unknown>) : null;
            statusCacheByModuleRef.current[m.id] = statusCache;
            recomputeModuleLastSeen();
            if (m.type === "pump") {
              const cache = statusCacheByModuleRef.current[m.id] ?? {};
              const psi = readPumpPressurePsiFromStatusCache(cache);
              setPumpPressurePsiByModuleId((prev) => {
                if (prev[m.id] === psi) return prev;
                return { ...prev, [m.id]: psi };
              });
              const moist = readPumpMoistureFromStatusCache(cache);
              setPumpMoistureByModuleId((prev) => {
                const cur = prev[m.id];
                if (cur?.moisturePct === moist.moisturePct && cur?.moistureMv === moist.moistureMv)
                  return prev;
                return { ...prev, [m.id]: moist };
              });
            }
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

      if (m.type === "field") {
        const sensorPaths = buildGatewaySensorPaths(m.gatewayId!, ids);
        sensorCacheByModuleRef.current[m.id] = {};
        sensorPaths.forEach((path) => {
          const sensorRef = ref(getFirebaseDb(), path);
          const unsub = onValue(
            sensorRef,
            (snap) => {
              const sensorCache = sensorCacheByModuleRef.current[m.id] ?? {};
              sensorCache[path] = snap.exists()
                ? (snap.val() as Record<string, unknown>)
                : null;
              sensorCacheByModuleRef.current[m.id] = sensorCache;
              let ll: { lat: number; lng: number } | undefined;
              for (const v of Object.values(sensorCache)) {
                ll = readLatLngFromSensorSnapshot(v);
                if (ll) break;
              }
              setFieldGpsByModuleId((prev) => {
                if (!ll) return prev;
                const cur = prev[m.id];
                if (cur && cur.lat === ll.lat && cur.lng === ll.lng) return prev;
                return { ...prev, [m.id]: ll };
              });
            },
            (err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes("Permission denied")) {
                console.warn("[Firebase] Permission denied sur gateways/.../sensors. Vérifiez les règles.");
              }
              console.error("[Firebase]", err);
            }
          );
          unsubs.push(unsub);
        });
      }
    });
    return () => unsubs.forEach((u) => u());
  }, [userId, gatewayBoundModulesKey, modules]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const modulesWithOnline = useMemo<Module[]>(
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
        const effectiveThresholdMs = Math.max(
          thresholdMs,
          MIN_GATEWAY_BOUND_OFFLINE_THRESHOLD_MS
        );
        return {
          ...m,
          lastSeen: gatewayLastSeen || m.lastSeen,
          online: gatewayLastSeen > 0 && nowTick - gatewayLastSeen < effectiveThresholdMs,
        };
      }),
    [modules, gatewayLastSeenByModuleId, nowTick, thresholdMs]
  );

  /** Enrichit les pompes avec pressurePsi / pressure (bar) depuis le statut passerelle. */
  const modulesWithPumpPressure = useMemo<Module[]>(
    () =>
      modulesWithOnline.map((m) => {
        if (m.type !== "pump") return m;
        const psi = pumpPressurePsiByModuleId[m.id];
        const moist = pumpMoistureByModuleId[m.id];
        if (psi == null || !Number.isFinite(psi)) return m;
        return {
          ...m,
          pressurePsi: psi,
          pressure: psiToBar(psi),
          moisturePct: moist?.moisturePct,
          moistureMv: moist?.moistureMv,
        };
      }),
    [modulesWithOnline, pumpPressurePsiByModuleId, pumpMoistureByModuleId]
  );

  /** Position carte : GPS champ (capteurs passerelle lat|lng) prioritaire sur position manuelle. */
  const modulesWithFieldGpsPosition = useMemo<Module[]>(
    () =>
      modulesWithPumpPressure.map((m) => {
        if (m.type !== "field") return m;
        const gw = fieldGpsByModuleId[m.id];
        if (gw && Number.isFinite(gw.lat) && Number.isFinite(gw.lng)) {
          return { ...m, position: { lat: gw.lat, lng: gw.lng } };
        }
        return m;
      }),
    [modulesWithPumpPressure, fieldGpsByModuleId]
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
    async (moduleId: string, updates: UseModulesUpdatePayload) => {
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

  return { modules: modulesWithFieldGpsPosition, loading, addModule, removeModule, updateModule };
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
