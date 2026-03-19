"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ref, set, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { LinkedGateway } from "@/types";

const GATEWAY_ID_REGEX = /^MERE-[0-9A-Fa-f]{8}$/;
// Seuil UX robuste: limite les faux hors-ligne au rechargement/navigation.
const GATEWAY_OFFLINE_THRESHOLD_MS = 45 * 1000;

function parseTimestampMs(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw >= 1_000_000_000_000) return raw;
    if (raw >= 1_000_000_000) return raw * 1000;
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

function handleDbError(error: Error) {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("Permission denied") || msg.includes("permission_denied")) {
    console.warn(
      "[Firebase] Permission denied. Vérifiez que les règles Realtime Database sont déployées (voir database.rules.json) et que vous êtes connecté."
    );
  }
  console.error("[Firebase]", error);
}

export function useLinkedGateways(userId: string | undefined) {
  const [gateways, setGateways] = useState<LinkedGateway[]>([]);
  const [loading, setLoading] = useState(!!userId);
  const [lastSeenByGateway, setLastSeenByGateway] = useState<Record<string, number>>({});
  const heartbeatByGatewayRef = useRef<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (!userId) {
      setGateways([]);
      setLoading(false);
      return;
    }
    const refPath = ref(getFirebaseDb(), `users/${userId}/linkedGateways`);
    const unsubscribe = onValue(
      refPath,
      (snap) => {
        if (!snap.exists()) {
          setGateways([]);
        } else {
          const data = snap.val();
          setGateways(
            Object.entries(data).map(([gatewayId, v]) => {
              const o = v as { farmId?: string; name?: string };
              return {
                gatewayId,
                farmId: o?.farmId ?? "",
                name: o?.name,
              };
            })
          );
        }
        setLoading(false);
      },
      handleDbError
    );
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (gateways.length === 0) {
      heartbeatByGatewayRef.current = {};
      return;
    }
    const trackedIds = new Set(gateways.map((g) => g.gatewayId));
    const nextHeartbeats: Record<string, number> = {};
    for (const [id, hb] of Object.entries(heartbeatByGatewayRef.current)) {
      if (trackedIds.has(id)) nextHeartbeats[id] = hb;
    }
    heartbeatByGatewayRef.current = nextHeartbeats;

    const db = getFirebaseDb();
    const unsubs: (() => void)[] = [];
    gateways.forEach((g) => {
      const r = ref(db, `gateways/${g.gatewayId}/lastSeen`);
      const unsub = onValue(
        r,
        (snap) => {
          if (!snap.exists()) {
            delete heartbeatByGatewayRef.current[g.gatewayId];
            setLastSeenByGateway((prev) => ({ ...prev, [g.gatewayId]: 0 }));
            return;
          }
          const val = snap.val();
          const ts = parseTimestampMs(val);
          const heartbeat = ts == null ? parseHeartbeatCounter(val) : null;
          setLastSeenByGateway((prev) => {
            const currentTs = prev[g.gatewayId] ?? 0;
            let nextTs = currentTs;

            if (ts != null) {
              nextTs = ts;
            } else if (heartbeat != null) {
              const prevHeartbeat = heartbeatByGatewayRef.current[g.gatewayId];
              const progressed = prevHeartbeat == null || heartbeat > prevHeartbeat;
              heartbeatByGatewayRef.current[g.gatewayId] = heartbeat;
              if (progressed) nextTs = Date.now();
            } else {
              nextTs = 0;
            }

            if (nextTs === currentTs) return prev;
            return { ...prev, [g.gatewayId]: nextTs };
          });
        },
        handleDbError
      );
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [gateways.map((g) => g.gatewayId).join(",")]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const gatewaysWithStatus: LinkedGateway[] = gateways.map((g) => {
    const lastSeen = lastSeenByGateway[g.gatewayId];
    const online = lastSeen != null && nowTick - lastSeen < GATEWAY_OFFLINE_THRESHOLD_MS;
    return { ...g, lastSeen, online };
  });

  const addGateway = useCallback(
    async (gatewayId: string, farmId: string, name?: string) => {
      if (!userId) return;
      const id = gatewayId.trim().toUpperCase();
      if (!GATEWAY_ID_REGEX.test(id)) {
        throw new Error("ID passerelle invalide (ex. MERE-A842E35C).");
      }
      const gatewayRef = ref(
        getFirebaseDb(),
        `users/${userId}/linkedGateways/${id}`
      );
      await set(gatewayRef, { farmId, name: name || null });
    },
    [userId]
  );

  const removeGateway = useCallback(
    async (gatewayId: string) => {
      if (!userId) return;
      const gatewayRef = ref(
        getFirebaseDb(),
        `users/${userId}/linkedGateways/${gatewayId}`
      );
      await set(gatewayRef, null);
    },
    [userId]
  );

  return { gateways: gatewaysWithStatus, loading, addGateway, removeGateway };
}
