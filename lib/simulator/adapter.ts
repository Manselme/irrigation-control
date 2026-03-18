"use client";

import { get, push, ref, remove, set, update, type DatabaseReference } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export type SimulatorMode = "sandbox" | "live";

export interface SimulatorLogEntry {
  at: number;
  level: "info" | "warn" | "error";
  message: string;
}

export interface SimulatorAdapterOptions {
  userId: string;
  mode: SimulatorMode;
  sandboxKey: string;
  onLog?: (entry: SimulatorLogEntry) => void;
  onWrite?: () => void;
}

export interface SimulatorAdapter {
  mode: SimulatorMode;
  userId: string;
  sandboxKey: string;
  resolveUserPath: (subPath?: string) => string;
  resolveGatewayPath: (gatewayId: string, subPath?: string) => string;
  readAtPath: <T = unknown>(absolutePath: string) => Promise<T | null>;
  writeAtPath: (absolutePath: string, value: unknown) => Promise<void>;
  updateAtPath: (absolutePath: string, value: Record<string, unknown>) => Promise<void>;
  removeAtPath: (absolutePath: string) => Promise<void>;
  pushAtPath: (absolutePath: string, value: unknown) => Promise<string | null>;
  writeUser: (subPath: string, value: unknown) => Promise<void>;
  updateUser: (subPath: string, value: Record<string, unknown>) => Promise<void>;
  readUser: <T = unknown>(subPath: string) => Promise<T | null>;
  writeGateway: (gatewayId: string, subPath: string, value: unknown) => Promise<void>;
  updateGateway: (
    gatewayId: string,
    subPath: string,
    value: Record<string, unknown>
  ) => Promise<void>;
  readGateway: <T = unknown>(gatewayId: string, subPath: string) => Promise<T | null>;
  clearSandbox: () => Promise<void>;
}

function cleanSubPath(path?: string): string {
  if (!path) return "";
  return path.replace(/^\/+/, "");
}

function joinPath(base: string, subPath?: string): string {
  const clean = cleanSubPath(subPath);
  return clean ? `${base}/${clean}` : base;
}

function logPathLabel(mode: SimulatorMode, absolutePath: string): string {
  return `${mode.toUpperCase()} -> ${absolutePath}`;
}

export function createSimulatorAdapter(options: SimulatorAdapterOptions): SimulatorAdapter {
  const { userId, mode, sandboxKey, onLog, onWrite } = options;
  const db = getFirebaseDb();

  const sandboxRoot = `simulators/${userId}/sandboxes/${sandboxKey}`;
  const usersBase = mode === "live" ? `users/${userId}` : `${sandboxRoot}/users/${userId}`;
  const gatewaysBase = mode === "live" ? "gateways" : `${sandboxRoot}/gateways`;

  const emit = (level: SimulatorLogEntry["level"], message: string) => {
    onLog?.({ at: Date.now(), level, message });
  };

  const resolveUserPath = (subPath?: string) => joinPath(usersBase, subPath);
  const resolveGatewayPath = (gatewayId: string, subPath?: string) =>
    joinPath(`${gatewaysBase}/${gatewayId}`, subPath);

  const readAtPath = async <T = unknown>(absolutePath: string): Promise<T | null> => {
    const r = ref(db, absolutePath);
    const snap = await get(r);
    return snap.exists() ? (snap.val() as T) : null;
  };

  const writeAtPath = async (absolutePath: string, value: unknown) => {
    emit("info", `WRITE ${logPathLabel(mode, absolutePath)}`);
    onWrite?.();
    await set(ref(db, absolutePath), value);
  };

  const updateAtPath = async (absolutePath: string, value: Record<string, unknown>) => {
    emit("info", `UPDATE ${logPathLabel(mode, absolutePath)}`);
    onWrite?.();
    await update(ref(db, absolutePath), value);
  };

  const removeAtPath = async (absolutePath: string) => {
    emit("warn", `REMOVE ${logPathLabel(mode, absolutePath)}`);
    onWrite?.();
    await remove(ref(db, absolutePath));
  };

  const pushAtPath = async (absolutePath: string, value: unknown): Promise<string | null> => {
    emit("info", `PUSH ${logPathLabel(mode, absolutePath)}`);
    onWrite?.();
    const pushedRef: DatabaseReference = push(ref(db, absolutePath));
    await set(pushedRef, value);
    return pushedRef.key;
  };

  const writeUser = async (subPath: string, value: unknown) => {
    await writeAtPath(resolveUserPath(subPath), value);
  };

  const updateUser = async (subPath: string, value: Record<string, unknown>) => {
    await updateAtPath(resolveUserPath(subPath), value);
  };

  const readUser = async <T = unknown>(subPath: string): Promise<T | null> =>
    readAtPath<T>(resolveUserPath(subPath));

  const writeGateway = async (gatewayId: string, subPath: string, value: unknown) => {
    await writeAtPath(resolveGatewayPath(gatewayId, subPath), value);
  };

  const updateGateway = async (
    gatewayId: string,
    subPath: string,
    value: Record<string, unknown>
  ) => {
    await updateAtPath(resolveGatewayPath(gatewayId, subPath), value);
  };

  const readGateway = async <T = unknown>(
    gatewayId: string,
    subPath: string
  ): Promise<T | null> => readAtPath<T>(resolveGatewayPath(gatewayId, subPath));

  const clearSandbox = async () => {
    if (mode === "live") {
      emit("warn", "clearSandbox ignoré en mode live.");
      return;
    }
    await removeAtPath(sandboxRoot);
    emit("info", `Sandbox supprimée: ${sandboxRoot}`);
  };

  return {
    mode,
    userId,
    sandboxKey,
    resolveUserPath,
    resolveGatewayPath,
    readAtPath,
    writeAtPath,
    updateAtPath,
    removeAtPath,
    pushAtPath,
    writeUser,
    updateUser,
    readUser,
    writeGateway,
    updateGateway,
    readGateway,
    clearSandbox,
  };
}

