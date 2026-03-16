"use client";

import { ref, set } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

const TOKEN_LENGTH = 24;
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSecureToken(): string {
  const arr = new Uint8Array(TOKEN_LENGTH);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < TOKEN_LENGTH; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join("");
}

export interface CreatePairingTokenResult {
  token: string;
  expiresInMinutes: number;
}

/**
 * Crée un token d'appairage one-time et l'enregistre dans Firebase.
 * Le Module Mère pourra l'échanger contre un custom token via la Cloud Function.
 */
export async function createPairingToken(
  userId: string,
  motherModuleId: string
): Promise<CreatePairingTokenResult> {
  const db = getFirebaseDb();
  const token = generateSecureToken();
  await set(ref(db, `pairingTokens/${token}`), {
    uid: userId,
    motherModuleId,
    createdAt: Date.now(),
  });
  return { token, expiresInMinutes: 15 };
}
