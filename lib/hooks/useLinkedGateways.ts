"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, set, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { LinkedGateway } from "@/types";

const GATEWAY_ID_REGEX = /^MERE-[0-9A-Fa-f]{8}$/;
// Seuil prototype : 30 s sans lastSeen => hors ligne
const GATEWAY_OFFLINE_THRESHOLD_MS = 30 * 1000;

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
    if (gateways.length === 0) return;
    const db = getFirebaseDb();
    const unsubs: (() => void)[] = [];
    gateways.forEach((g) => {
      const r = ref(db, `gateways/${g.gatewayId}/lastSeen`);
      const unsub = onValue(
        r,
        (snap) => {
          if (!snap.exists()) return;
          const val = snap.val();
          const ms =
            typeof val === "number"
              ? val
              : typeof val === "object" && val !== null && "toMillis" in val
                ? Number((val as { toMillis: () => number }).toMillis())
                : Date.now();
          setLastSeenByGateway((prev) => ({ ...prev, [g.gatewayId]: ms }));
        },
        handleDbError
      );
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [gateways.map((g) => g.gatewayId).join(",")]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
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
