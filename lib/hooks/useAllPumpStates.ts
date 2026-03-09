"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface PumpState {
  pumpOn: boolean;
  valveOpen: boolean;
}

export function useAllPumpStates(
  userId: string | undefined,
  pumpModuleIds: string[]
): Record<string, PumpState> {
  const [states, setStates] = useState<Record<string, PumpState>>({});

  useEffect(() => {
    if (!userId || pumpModuleIds.length === 0) {
      setStates({});
      return;
    }
    const unsubs: (() => void)[] = [];

    pumpModuleIds.forEach((moduleId) => {
      const stateRef = ref(getFirebaseDb(), `users/${userId}/actuatorState/${moduleId}`);
      const unsub = onValue(stateRef, (snap) => {
        const state: PumpState = snap.exists()
          ? {
              pumpOn: (snap.val() as { pumpOn?: boolean })?.pumpOn ?? false,
              valveOpen: (snap.val() as { valveOpen?: boolean })?.valveOpen ?? false,
            }
          : { pumpOn: false, valveOpen: false };
        setStates((prev) => ({ ...prev, [moduleId]: state }));
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [userId, pumpModuleIds.join(",")]);

  return states;
}
