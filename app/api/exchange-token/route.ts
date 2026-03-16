/**
 * API d'échange token d'appairage → custom token Firebase.
 * Utilisée par le Module Mère (ESP32) pour s'authentifier sans email/mot de passe.
 *
 * Déprécié (AgriFlow V2) : en architecture Plug & Play, la Mère n'utilise plus l'auth
 * et écrit directement dans gateways/MERE-{MAC}. Cette route reste disponible pour
 * d'éventuels modules Mère encore en V1.
 *
 * POST body: { "token": "string" }
 * Réponse 200: { "customToken": "string" }
 * Réponse 400: token invalide ou expiré
 *
 * Variable d'environnement requise : FIREBASE_SERVICE_ACCOUNT_KEY (JSON complet du compte de service).
 */
import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";

const PAIRING_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  }
  const serviceAccount = JSON.parse(key) as admin.ServiceAccount;
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  const pairingToken =
    typeof body?.token === "string" ? body.token : (body as { token?: string })?.token;

  if (!pairingToken || typeof pairingToken !== "string") {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  let app: admin.app.App;
  try {
    app = getAdminApp();
  } catch (e) {
    console.error("Firebase Admin init error:", e);
    return NextResponse.json({ error: "server_config" }, { status: 503 });
  }

  const db = app.database();
  const ref = db.ref(`pairingTokens/${pairingToken}`);

  let snapshot: admin.database.DataSnapshot;
  try {
    snapshot = await ref.once("value");
  } catch (e) {
    console.error("exchange-token read error", e);
    return NextResponse.json({ error: "database_error" }, { status: 500 });
  }

  if (!snapshot.exists()) {
    return NextResponse.json({ error: "token_invalid" }, { status: 400 });
  }

  const data = snapshot.val() as { uid?: string; createdAt?: number };
  const uid = data?.uid;
  const createdAt = data?.createdAt;

  if (!uid || typeof uid !== "string") {
    return NextResponse.json({ error: "token_invalid" }, { status: 400 });
  }

  const now = Date.now();
  if (typeof createdAt === "number" && now - createdAt > PAIRING_TOKEN_TTL_MS) {
    await ref.remove();
    return NextResponse.json({ error: "token_expired" }, { status: 400 });
  }

  try {
    await ref.remove();
  } catch (e) {
    console.warn("exchange-token remove failed", e);
  }

  let customToken: string;
  try {
    customToken = await app.auth().createCustomToken(uid);
  } catch (e) {
    console.error("exchange-token createCustomToken error", e);
    return NextResponse.json({ error: "auth_error" }, { status: 500 });
  }

  return NextResponse.json({ customToken });
}
