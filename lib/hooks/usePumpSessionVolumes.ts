"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PumpState } from "@/lib/hooks/useAllPumpStates";
import type { Module } from "@/types";
import { getPumpFlowRateLitersPerMinute } from "@/lib/waterVolume";

/** Pompe ou vanne(s) ouvertes : l’eau est considérée en circulation pour l’estimation volume session. */
export function isIrrigationFlowing(st: PumpState | undefined): boolean {
  if (!st) return false;
  return st.pumpOn || st.valveOpen || st.valveAOpen || st.valveBOpen;
}

/**
 * Estime les litres écoulés depuis le passage à « irrigation active » pour chaque pompe listée,
 * à partir du débit L/min configuré (rafraîchissement 1 s).
 */
export function usePumpSessionVolumes(
  pumpModules: Module[],
  pumpStates: Record<string, PumpState>
): {
  litersByPumpId: Record<string, number>;
  totalSessionLiters: number;
  anyFlowing: boolean;
} {
  const modulesRef = useRef(pumpModules);
  const statesRef = useRef(pumpStates);
  const sessionStartMsRef = useRef<Record<string, number>>({});
  const [litersByPumpId, setLitersByPumpId] = useState<Record<string, number>>({});

  useEffect(() => {
    modulesRef.current = pumpModules;
    statesRef.current = pumpStates;
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const modules = modulesRef.current;
      const states = statesRef.current;
      const starts = sessionStartMsRef.current;
      const next: Record<string, number> = {};

      for (const m of modules) {
        const st = states[m.id];
        if (!isIrrigationFlowing(st)) {
          delete starts[m.id];
          continue;
        }
        if (starts[m.id] == null) {
          starts[m.id] = Date.now();
        }
        const rate = getPumpFlowRateLitersPerMinute(m);
        if (rate > 0) {
          const minutes = (Date.now() - starts[m.id]!) / 60_000;
          next[m.id] = minutes * rate;
        }
      }
      setLitersByPumpId(next);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const totalSessionLiters = useMemo(
    () => Object.values(litersByPumpId).reduce((a, b) => a + b, 0),
    [litersByPumpId]
  );

  const anyFlowing = useMemo(
    () => pumpModules.some((m) => isIrrigationFlowing(pumpStates[m.id])),
    [pumpModules, pumpStates]
  );

  return { litersByPumpId, totalSessionLiters, anyFlowing };
}
