"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onValue, ref, runTransaction } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { PumpState } from "@/lib/hooks/useAllPumpStates";
import { isIrrigationFlowing } from "@/lib/hooks/usePumpSessionVolumes";
import { getPumpFlowRateLitersPerMinute } from "@/lib/waterVolume";
import type { Module } from "@/types";

function todayUtcDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

const FLUSH_INTERVAL_MS = 8_000;
const RELOAD_DEBOUNCE_MS = 400;

function extractTodayUpdatedAt(
  tree: unknown,
  moduleId: string,
  date: string
): number | undefined {
  if (!tree || typeof tree !== "object") return undefined;
  const mod = (tree as Record<string, unknown>)[moduleId];
  if (!mod || typeof mod !== "object") return undefined;
  const day = (mod as Record<string, unknown>)[date];
  if (!day || typeof day !== "object") return undefined;
  const ua = Number((day as { updatedAt?: unknown }).updatedAt);
  return Number.isFinite(ua) ? ua : undefined;
}

/**
 * Persiste les litres estimés (débit × temps) sous
 * `users/{uid}/pumpLiveLitersAccum/{moduleId}/{YYYY-MM-DD}` (transactions RTDB),
 * et expose un petit complément temps réel depuis la dernière écriture pour l’affichage fluide.
 */
export function usePumpLiveLitersRtdb(
  userId: string | undefined,
  pumpModules: Module[],
  pumpStates: Record<string, PumpState>,
  onPersistedTotalsMayHaveChanged: () => void
): { overlayLiters: number } {
  const [overlayLiters, setOverlayLiters] = useState(0);
  const pumpModulesRef = useRef(pumpModules);
  const pumpStatesRef = useRef(pumpStates);
  const lastFlushMsRef = useRef<Record<string, number>>({});
  const wasFlowingRef = useRef<Record<string, boolean>>({});
  const accumTreeRef = useRef<unknown>(null);
  const onChangedRef = useRef(onPersistedTotalsMayHaveChanged);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  onChangedRef.current = onPersistedTotalsMayHaveChanged;

  useEffect(() => {
    pumpModulesRef.current = pumpModules;
    pumpStatesRef.current = pumpStates;
  });

  const scheduleReload = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      onChangedRef.current();
    }, RELOAD_DEBOUNCE_MS);
  }, []);

  const flushPumpRef = useRef<(m: Module) => Promise<void>>(async () => {});

  const flushPump = useCallback(
    async (m: Module) => {
      if (!userId) return;
      const st = pumpStatesRef.current[m.id];
      if (!isIrrigationFlowing(st)) return;
      const rate = getPumpFlowRateLitersPerMinute(m);
      if (!(rate > 0)) return;

      const now = Date.now();
      let last = lastFlushMsRef.current[m.id];
      if (last == null) last = now;
      const minutes = (now - last) / 60_000;
      const deltaLiters = minutes * rate;
      if (deltaLiters < 0.01) return;

      lastFlushMsRef.current[m.id] = now;
      const date = todayUtcDate();
      const r = ref(getFirebaseDb(), `users/${userId}/pumpLiveLitersAccum/${m.id}/${date}`);

      try {
        await runTransaction(r, (cur) => {
          let base = 0;
          if (cur != null && typeof cur === "object" && !Array.isArray(cur)) {
            const L = Number((cur as { liters?: unknown }).liters);
            if (Number.isFinite(L) && L >= 0) base = L;
          }
          return {
            liters: base + deltaLiters,
            updatedAt: now,
          };
        });
        scheduleReload();
      } catch {
        lastFlushMsRef.current[m.id] = last;
      }
    },
    [userId, scheduleReload]
  );

  flushPumpRef.current = flushPump;

  useEffect(() => {
    if (!userId) return;
    const r = ref(getFirebaseDb(), `users/${userId}/pumpLiveLitersAccum`);
    const unsub = onValue(r, (snap) => {
      accumTreeRef.current = snap.exists() ? snap.val() : null;
      scheduleReload();
    });
    return () => unsub();
  }, [userId, scheduleReload]);

  useEffect(() => {
    if (!userId) return;
    for (const m of pumpModules) {
      const nowF = isIrrigationFlowing(pumpStates[m.id]);
      const was = wasFlowingRef.current[m.id] ?? false;
      if (nowF && !was) {
        lastFlushMsRef.current[m.id] = Date.now();
      }
      if (!nowF && was) {
        const mod = m;
        void flushPump(mod).finally(() => {
          delete lastFlushMsRef.current[mod.id];
        });
      }
      wasFlowingRef.current[m.id] = nowF;
    }
  }, [userId, pumpModules, pumpStates, flushPump]);

  useEffect(() => {
    if (!userId) return;
    const id = window.setInterval(() => {
      for (const m of pumpModulesRef.current) {
        if (isIrrigationFlowing(pumpStatesRef.current[m.id])) void flushPump(m);
      }
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [userId, flushPump]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      for (const m of pumpModulesRef.current) {
        if (isIrrigationFlowing(pumpStatesRef.current[m.id])) void flushPump(m);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [flushPump]);

  useEffect(() => {
    return () => {
      for (const m of pumpModulesRef.current) {
        if (isIrrigationFlowing(pumpStatesRef.current[m.id])) {
          void flushPumpRef.current(m);
        }
      }
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const date = todayUtcDate();
      const mods = pumpModulesRef.current;
      const states = pumpStatesRef.current;
      const tree = accumTreeRef.current;
      let sum = 0;
      for (const m of mods) {
        if (!isIrrigationFlowing(states[m.id])) continue;
        const rate = getPumpFlowRateLitersPerMinute(m);
        const fromDb = extractTodayUpdatedAt(tree, m.id, date);
        const t0 = fromDb ?? lastFlushMsRef.current[m.id] ?? now;
        sum += (rate * Math.max(0, now - t0)) / 60_000;
      }
      setOverlayLiters(sum);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { overlayLiters };
}
