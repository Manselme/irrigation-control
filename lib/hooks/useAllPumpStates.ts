"use client";

import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface PumpState {
  pumpOn: boolean;
  valveOpen: boolean;
}

export interface PumpModuleRef {
  moduleId: string;
  gatewayId?: string;
  deviceId?: string;
}

export function useAllPumpStates(
  userId: string | undefined,
  pumps: PumpModuleRef[]
): Record<string, PumpState> {
  const [states, setStates] = useState<Record<string, PumpState>>({});

  useEffect(() => {
    if (!userId || pumps.length === 0) {
      setStates({});
      return;
    }
    const unsubs: (() => void)[] = [];

    pumps.forEach(({ moduleId, gatewayId, deviceId }) => {
      const path =
        gatewayId && deviceId
          ? `gateways/${gatewayId}/status/${deviceId}`
          : `users/${userId}/actuatorState/${moduleId}`;
      const stateRef = ref(getFirebaseDb(), path);
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
  }, [userId, pumps.map((p) => `${p.moduleId}:${p.gatewayId ?? ""}:${p.deviceId ?? ""}`).join(",")]);

  return states;
}
