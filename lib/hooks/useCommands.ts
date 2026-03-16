"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ref, set, get, runTransaction, onValue } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import type { Command } from "@/types";

const COMMAND_TIMEOUT_MS = 30000;

type CommandType = Command["type"];

export interface SendCommandGatewayOpts {
  gatewayId: string;
  deviceId: string;
}

export function useSendCommand(userId: string | undefined) {
  const [pendingCommand, setPendingCommand] = useState<{
    moduleId: string;
    type: CommandType;
    status: "pending" | "confirmed" | "failed" | "timeout";
    gatewayId?: string;
    deviceId?: string;
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIntentsRef = useRef<Record<string, CommandType[]>>({});
  const flushTimeoutByModuleRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flushPromiseByModuleRef = useRef<Record<string, Promise<void>>>({});

  const sendCommand = useCallback(
    async (
      moduleId: string,
      type: CommandType,
      gatewayOpts?: SendCommandGatewayOpts
    ) => {
      if (!userId) return;
      const commandId = `cmd_${Date.now()}`;

      if (gatewayOpts?.gatewayId && gatewayOpts?.deviceId) {
        const currentRef = ref(
          getFirebaseDb(),
          `gateways/${gatewayOpts.gatewayId}/commands/current`
        );
        try {
          await set(currentRef, {
            dest: gatewayOpts.deviceId,
            type,
            id: commandId,
            status: "pending",
            createdAt: Date.now(),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("Permission denied")) {
            throw new Error("Accès refusé à la passerelle. Vérifiez les règles Firebase (gateways en écriture) et que vous êtes connecté.");
          }
          throw e;
        }
        setPendingCommand({
          moduleId,
          type,
          status: "pending",
          gatewayId: gatewayOpts.gatewayId,
          deviceId: gatewayOpts.deviceId,
        });
      } else {
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
      }

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
    const { moduleId, gatewayId } = pendingCommand;
    const path =
      gatewayId && pendingCommand.deviceId
        ? `gateways/${gatewayId}/commands/current`
        : `users/${userId}/commands/${moduleId}`;
    const commandsRef = ref(getFirebaseDb(), path);
    const unsubscribe = onValue(
      commandsRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.val() as Record<string, unknown>;
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
      },
      (err) => {
        if (String(err?.message || err).includes("Permission denied")) {
          console.warn("[Firebase] Permission denied sur commands. Vérifiez les règles et la connexion.");
        }
        console.error("[Firebase]", err);
      }
    );
    return () => unsubscribe();
  }, [userId, pendingCommand?.moduleId, pendingCommand?.status, pendingCommand?.gatewayId]);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingCommand(null);
  }, []);

  return { sendCommand, pendingCommand, clearPending };
}

export interface LastCommandStateGatewayOpts {
  gatewayId: string;
  deviceId: string;
}

/** État pompe/vanne : source de vérité dans Firebase (actuatorState ou gateways/.../status), persistant au changement de page. */
export function useLastCommandState(
  userId: string | undefined,
  moduleId: string | null,
  gatewayOpts?: LastCommandStateGatewayOpts
): { pumpOn: boolean; valveOpen: boolean } {
  const [state, setState] = useState({ pumpOn: false, valveOpen: false });

  useEffect(() => {
    if (!userId || !moduleId) {
      setState({ pumpOn: false, valveOpen: false });
      return;
    }
    const useGateway =
      gatewayOpts?.gatewayId && gatewayOpts?.deviceId;
    const statePath = useGateway
      ? `gateways/${gatewayOpts.gatewayId}/status/${gatewayOpts.deviceId}`
      : `users/${userId}/actuatorState/${moduleId}`;
    const commandsPath = useGateway
      ? `gateways/${gatewayOpts.gatewayId}/commands/current`
      : `users/${userId}/commands/${moduleId}`;
    const stateRef = ref(getFirebaseDb(), statePath);
    const commandsRef = ref(getFirebaseDb(), commandsPath);

    const unsubState = onValue(stateRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val() as { pumpOn?: boolean; valveOpen?: boolean };
        setState({
          pumpOn: data.pumpOn ?? false,
          valveOpen: data.valveOpen ?? false,
        });
        return;
      }
      if (!useGateway) {
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
      }
    });

    const unsubCmd = onValue(commandsRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val() as { type?: string; status?: string; dest?: string };
      if (data?.status !== "confirmed" || !data?.type) return;
      if (useGateway && data.dest !== gatewayOpts?.deviceId) return;
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
  }, [userId, moduleId, gatewayOpts?.gatewayId, gatewayOpts?.deviceId]);

  return state;
}
