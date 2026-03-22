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

/** `dest` Firebase / parse mère : trim + majuscules (ex. POMPE-04068E6C). */
export function normalizeGatewayDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
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
    ): Promise<"confirmed" | "failed" | "timeout" | undefined> => {
      if (!userId) return undefined;
      const commandId = `cmd_${Date.now()}`;

      if (gatewayOpts?.gatewayId && gatewayOpts?.deviceId) {
        const normalizedDest = normalizeGatewayDeviceId(gatewayOpts.deviceId);
        const gatewayType: CommandType =
          type === "VALVE_A_OPEN" || type === "VALVE_B_OPEN"
            ? "VALVE_OPEN"
            : type === "VALVE_A_CLOSE" || type === "VALVE_B_CLOSE"
              ? "VALVE_CLOSE"
              : type;
        const valveSlot =
          type === "VALVE_A_OPEN" || type === "VALVE_A_CLOSE"
            ? "A"
            : type === "VALVE_B_OPEN" || type === "VALVE_B_CLOSE"
              ? "B"
              : undefined;
        const currentRef = ref(
          getFirebaseDb(),
          `gateways/${gatewayOpts.gatewayId}/commands/current`
        );
        try {
          await set(currentRef, {
            dest: normalizedDest,
            type: gatewayType,
            id: commandId,
            status: "pending",
            createdAt: Date.now(),
            ...(valveSlot !== undefined ? { valveSlot } : {}),
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
          deviceId: normalizedDest,
        });

        const result = await new Promise<"confirmed" | "failed" | "timeout">((resolve) => {
          let unsub: (() => void) | undefined;
          const timeoutId = setTimeout(() => {
            unsub?.();
            if (timeoutRef.current === timeoutId) timeoutRef.current = null;
            setPendingCommand((prev) =>
              prev?.moduleId === moduleId && prev?.status === "pending"
                ? { ...prev, status: "timeout" }
                : prev
            );
            resolve("timeout");
          }, COMMAND_TIMEOUT_MS);
          timeoutRef.current = timeoutId;

          unsub = onValue(
            currentRef,
            (snap) => {
              if (!snap.exists()) return;
              const data = snap.val() as Record<string, unknown>;
              if (data.id !== commandId) return;
              const st = data.status as string | undefined;
              if (st === "confirmed" || st === "failed") {
                clearTimeout(timeoutId);
                if (timeoutRef.current === timeoutId) timeoutRef.current = null;
                unsub?.();
                setPendingCommand({
                  moduleId,
                  type,
                  status: st,
                  gatewayId: gatewayOpts.gatewayId,
                  deviceId: normalizedDest,
                });
                resolve(st);
              }
            },
            (err) => {
              console.error("[Firebase]", err);
            }
          );
        });
        return result;
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
                const prev =
                  (cur as {
                    pumpOn?: boolean;
                    valveOpen?: boolean;
                    valveAOpen?: boolean;
                    valveBOpen?: boolean;
                  } | null) ?? {};
                let pumpOn = prev.pumpOn ?? false;
                let valveOpen = prev.valveOpen ?? false;
                let valveAOpen = prev.valveAOpen ?? prev.valveOpen ?? false;
                let valveBOpen = prev.valveBOpen ?? prev.valveOpen ?? false;
                for (const t of intents) {
                  if (t === "PUMP_ON") pumpOn = true;
                  else if (t === "PUMP_OFF") pumpOn = false;
                  else if (t === "VALVE_OPEN") valveOpen = true;
                  else if (t === "VALVE_CLOSE") valveOpen = false;
                  else if (t === "VALVE_A_OPEN") {
                    valveAOpen = true;
                    valveOpen = true;
                  } else if (t === "VALVE_A_CLOSE") {
                    valveAOpen = false;
                    valveOpen = valveBOpen;
                  } else if (t === "VALVE_B_OPEN") {
                    valveBOpen = true;
                    valveOpen = true;
                  } else if (t === "VALVE_B_CLOSE") {
                    valveBOpen = false;
                    valveOpen = valveAOpen;
                  }
                }
                return { pumpOn, valveOpen, valveAOpen, valveBOpen };
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
      return undefined;
    },
    [userId]
  );

  useEffect(() => {
    if (!userId || !pendingCommand || pendingCommand.status !== "pending")
      return;
    if (pendingCommand.gatewayId && pendingCommand.deviceId) {
      return;
    }
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
  }, [
    userId,
    pendingCommand?.moduleId,
    pendingCommand?.status,
    pendingCommand?.gatewayId,
    pendingCommand?.deviceId,
  ]);

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
): {
  pumpOn: boolean;
  valveOpen: boolean;
  valveAOpen: boolean;
  valveBOpen: boolean;
  lastPumpOnAt: number | null;
} {
  const [state, setState] = useState({
    pumpOn: false,
    valveOpen: false,
    valveAOpen: false,
    valveBOpen: false,
    lastPumpOnAt: null as number | null,
  });

  useEffect(() => {
    if (!userId || !moduleId) {
      setState({
        pumpOn: false,
        valveOpen: false,
        valveAOpen: false,
        valveBOpen: false,
        lastPumpOnAt: null,
      });
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
        const data = snap.val() as {
          pumpOn?: boolean;
          valveOpen?: boolean;
          valveAOpen?: boolean;
          valveBOpen?: boolean;
        };
        setState((prev) => ({
          pumpOn: data.pumpOn ?? false,
          valveOpen: data.valveOpen ?? false,
          valveAOpen: data.valveAOpen ?? data.valveOpen ?? false,
          valveBOpen: data.valveBOpen ?? data.valveOpen ?? false,
          lastPumpOnAt: prev.lastPumpOnAt,
        }));
        return;
      }
      if (!useGateway) {
        get(commandsRef).then((cmdSnap) => {
          if (!cmdSnap.exists()) return;
          const cmd = cmdSnap.val() as { type?: string; status?: string };
          const type = cmd?.type;
          if (!type) return;
          const derived = { pumpOn: false, valveOpen: false, valveAOpen: false, valveBOpen: false };
          if (type === "PUMP_ON") derived.pumpOn = true;
          else if (type === "PUMP_OFF") derived.pumpOn = false;
          else if (type === "VALVE_OPEN") derived.valveOpen = true;
          else if (type === "VALVE_CLOSE") derived.valveOpen = false;
          else if (type === "VALVE_A_OPEN") {
            derived.valveAOpen = true;
            derived.valveOpen = true;
          } else if (type === "VALVE_A_CLOSE") {
            derived.valveAOpen = false;
            derived.valveOpen = false;
          } else if (type === "VALVE_B_OPEN") {
            derived.valveBOpen = true;
            derived.valveOpen = true;
          } else if (type === "VALVE_B_CLOSE") {
            derived.valveBOpen = false;
            derived.valveOpen = false;
          }
          setState({
            ...derived,
            lastPumpOnAt:
              type === "PUMP_ON"
                ? ((cmdSnap.val() as { confirmedAt?: number; createdAt?: number }).confirmedAt ??
                  (cmdSnap.val() as { confirmedAt?: number; createdAt?: number }).createdAt ??
                  null)
                : null,
          });
          set(stateRef, derived).catch(() => {});
        });
      }
    });

    const unsubCmd = onValue(commandsRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val() as {
        type?: string;
        status?: string;
        dest?: string;
        confirmedAt?: number;
        createdAt?: number;
      };
      if (data?.status !== "confirmed" || !data?.type) return;
      if (
        useGateway &&
        gatewayOpts?.deviceId &&
        normalizeGatewayDeviceId(String(data.dest ?? "")) !==
          normalizeGatewayDeviceId(gatewayOpts.deviceId)
      ) {
        return;
      }
      const type = data.type;
      runTransaction(stateRef, (cur) => {
        const prev =
          (cur as {
            pumpOn?: boolean;
            valveOpen?: boolean;
            valveAOpen?: boolean;
            valveBOpen?: boolean;
          } | null) ?? {};
        let pumpOn = prev.pumpOn ?? false;
        let valveOpen = prev.valveOpen ?? false;
        let valveAOpen = prev.valveAOpen ?? prev.valveOpen ?? false;
        let valveBOpen = prev.valveBOpen ?? prev.valveOpen ?? false;
        if (type === "PUMP_ON") pumpOn = true;
        else if (type === "PUMP_OFF") pumpOn = false;
        else if (type === "VALVE_OPEN") valveOpen = true;
        else if (type === "VALVE_CLOSE") valveOpen = false;
        else if (type === "VALVE_A_OPEN") {
          valveAOpen = true;
          valveOpen = true;
        } else if (type === "VALVE_A_CLOSE") {
          valveAOpen = false;
          valveOpen = valveBOpen;
        } else if (type === "VALVE_B_OPEN") {
          valveBOpen = true;
          valveOpen = true;
        } else if (type === "VALVE_B_CLOSE") {
          valveBOpen = false;
          valveOpen = valveAOpen;
        }
        return { pumpOn, valveOpen, valveAOpen, valveBOpen };
      })
        .then(() => {
          if (type === "PUMP_ON") {
            setState((prev) => ({
              ...prev,
              lastPumpOnAt: data.confirmedAt ?? data.createdAt ?? Date.now(),
            }));
          }
        })
        .catch(() => {});
    });

    return () => {
      unsubState();
      unsubCmd();
    };
  }, [userId, moduleId, gatewayOpts?.gatewayId, gatewayOpts?.deviceId]);

  return state;
}
