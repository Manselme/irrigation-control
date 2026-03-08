"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ref, set, get, runTransaction, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Command } from "@/types";

const COMMAND_TIMEOUT_MS = 30000;

type CommandType = Command["type"];

export function useSendCommand(userId: string | undefined) {
  const [pendingCommand, setPendingCommand] = useState<{
    moduleId: string;
    type: CommandType;
    status: "pending" | "confirmed" | "failed" | "timeout";
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Intents en attente par module ; on flush après un court délai pour regrouper Pompe ON + Vanne ON en une seule écriture. */
  const pendingIntentsRef = useRef<Record<string, CommandType[]>>({});
  const flushTimeoutByModuleRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flushPromiseByModuleRef = useRef<Record<string, Promise<void>>>({});

  const sendCommand = useCallback(
    async (moduleId: string, type: CommandType) => {
      if (!userId) return;
      const commandId = `cmd_${Date.now()}`;
      const commandsRef = ref(getFirebaseDb(), `users/${userId}/commands/${moduleId}`);
      const stateRef = ref(getFirebaseDb(), `users/${userId}/actuatorState/${moduleId}`);
      await set(commandsRef, {
        id: commandId,
        type,
        status: "pending",
        createdAt: Date.now(),
      });
      if (!pendingIntentsRef.current[moduleId]) pendingIntentsRef.current[moduleId] = [];
      pendingIntentsRef.current[moduleId].push(type);
      setPendingCommand({ moduleId, type, status: "pending" });

      const scheduleFlush = () => {
        if (flushTimeoutByModuleRef.current[moduleId]) {
          clearTimeout(flushTimeoutByModuleRef.current[moduleId]);
        }
        flushTimeoutByModuleRef.current[moduleId] = setTimeout(() => {
          const intents = pendingIntentsRef.current[moduleId]?.slice() ?? [];
          pendingIntentsRef.current[moduleId] = [];
          if (intents.length === 0) return;
          const prevPromise = flushPromiseByModuleRef.current[moduleId] ?? Promise.resolve();
          const nextPromise = prevPromise.then(() =>
            runTransaction(stateRef, (cur) => {
              const prev = (cur as { pumpOn?: boolean; valveOpen?: boolean } | null) ?? {};
              let pumpOn = prev.pumpOn ?? false;
              let valveOpen = prev.valveOpen ?? false;
              for (const t of intents) {
                if (t === "PUMP_ON") pumpOn = true;
                else if (t === "PUMP_OFF") pumpOn = false;
                else if (t === "VALVE_OPEN") valveOpen = true;
                else if (t === "VALVE_CLOSE") valveOpen = false;
              }
              return { pumpOn, valveOpen };
            })
          ).then(() => {});
          flushPromiseByModuleRef.current[moduleId] = nextPromise;
        }, 80);
      };
      scheduleFlush();

      const timeoutId = setTimeout(() => {
        setPendingCommand((prev) =>
          prev?.moduleId === moduleId && prev?.status === "pending"
            ? { ...prev, status: "timeout" }
            : prev
        );
      }, COMMAND_TIMEOUT_MS);
      timeoutRef.current = timeoutId;
    },
    [userId]
  );

  useEffect(() => {
    if (!userId || !pendingCommand || pendingCommand.status !== "pending")
      return;
    const { moduleId } = pendingCommand;
    const commandsRef = ref(getFirebaseDb(), `users/${userId}/commands/${moduleId}`);
    const unsubscribe = onValue(commandsRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      const status = data?.status as Command["status"] | undefined;
      if (status === "confirmed" || status === "failed") {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setPendingCommand((prev) =>
          prev?.moduleId === moduleId ? { ...prev, status } : prev
        );
      }
    });
    return () => unsubscribe();
  }, [userId, pendingCommand?.moduleId, pendingCommand?.status]);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingCommand(null);
  }, []);

  return { sendCommand, pendingCommand, clearPending };
}

/** État pompe/vanne : source de vérité dans Firebase (actuatorState), persistant au changement de page. Les deux peuvent être ON en même temps. */
export function useLastCommandState(
  userId: string | undefined,
  moduleId: string | null
): { pumpOn: boolean; valveOpen: boolean } {
  const [state, setState] = useState({ pumpOn: false, valveOpen: false });

  useEffect(() => {
    if (!userId || !moduleId) {
      setState({ pumpOn: false, valveOpen: false });
      return;
    }
    const stateRef = ref(getFirebaseDb(), `users/${userId}/actuatorState/${moduleId}`);
    const commandsRef = ref(getFirebaseDb(), `users/${userId}/commands/${moduleId}`);

    const unsubState = onValue(stateRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val() as { pumpOn?: boolean; valveOpen?: boolean };
        setState({
          pumpOn: data.pumpOn ?? false,
          valveOpen: data.valveOpen ?? false,
        });
        return;
      }
      get(commandsRef).then((cmdSnap) => {
        if (!cmdSnap.exists()) return;
        const cmd = cmdSnap.val() as { type?: string; status?: string };
        const type = cmd?.type;
        if (!type) return;
        const derived = { pumpOn: false, valveOpen: false };
        if (type === "PUMP_ON") derived.pumpOn = true;
        else if (type === "PUMP_OFF") derived.pumpOn = false;
        else if (type === "VALVE_OPEN") derived.valveOpen = true;
        else if (type === "VALVE_CLOSE") derived.valveOpen = false;
        setState(derived);
        set(stateRef, derived).catch(() => {});
      });
    });

    const unsubCmd = onValue(commandsRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val() as { type?: string; status?: string };
      if (data?.status !== "confirmed" || !data?.type) return;
      const type = data.type;
      runTransaction(stateRef, (cur) => {
        const prev = (cur as { pumpOn?: boolean; valveOpen?: boolean } | null) ?? {};
        let pumpOn = prev.pumpOn ?? false;
        let valveOpen = prev.valveOpen ?? false;
        if (type === "PUMP_ON") pumpOn = true;
        else if (type === "PUMP_OFF") pumpOn = false;
        else if (type === "VALVE_OPEN") valveOpen = true;
        else if (type === "VALVE_CLOSE") valveOpen = false;
        return { pumpOn, valveOpen };
      }).catch(() => {});
    });

    return () => {
      unsubState();
      unsubCmd();
    };
  }, [userId, moduleId]);

  return state;
}
