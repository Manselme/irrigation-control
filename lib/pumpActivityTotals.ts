import { get, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { buildGatewayDeviceIds, buildGatewayPumpActivityPaths } from "@/lib/gatewayDevicePaths";
import type { Module } from "@/types";
import { getPumpFlowRateLitersPerMinute, m3ToLiters } from "@/lib/waterVolume";

export type PumpActivityRawEntry = number | { minutes?: number; volume_m3?: number };

/** Nœuds `users/.../pumpLiveLitersAccum/{moduleId}/{date}` écrits par le portail (litres estimés persistés). */
export type PumpLiveLitersDayNode = { liters?: number; updatedAt?: number };

export type PumpActivityDayMap = Record<string, PumpActivityRawEntry>;

/** Litres pour une entrée jour (nombre = minutes legacy, objet = minutes et/ou volume mesuré, ou `liters` persistés). */
export function pumpActivityEntryToLiters(
  value: PumpActivityRawEntry | PumpLiveLitersDayNode | undefined,
  flowRateLitersPerMinute: number
): number {
  if (value == null) return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value * flowRateLitersPerMinute;
  }
  const o = value as Record<string, unknown>;
  if ("liters" in o) {
    const L = Number(o.liters);
    if (Number.isFinite(L) && L >= 0) return L;
  }
  const volumeM3 = Number((value as { volume_m3?: unknown }).volume_m3 ?? 0);
  if (Number.isFinite(volumeM3) && volumeM3 > 0) return m3ToLiters(volumeM3);
  const minutes = Number((value as { minutes?: unknown }).minutes ?? 0);
  if (Number.isFinite(minutes) && minutes > 0) return minutes * flowRateLitersPerMinute;
  return 0;
}

function isIsoDateKey(key: string): boolean {
  return key.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

/**
 * Somme les litres sur 7 jours glissants pour une pompe, en lisant :
 * - `users/{uid}/pumpActivity/{moduleId}` (rempli par la cloud function + legacy)
 * - chaque alias `gateways/{gid}/pumpActivity/{deviceId}` (firmware / matériel)
 *
 * Par date, on garde le max entre les chemins pour éviter un double comptage si les mêmes données
 * existent à deux endroits.
 */
export async function fetchWeeklyVolumeLitersForPump(
  userId: string,
  pump: Module,
  cutoffDate: string
): Promise<number> {
  const flowRate = getPumpFlowRateLitersPerMinute(pump);
  const paths: string[] = [
    `users/${userId}/pumpActivity/${pump.id}`,
    `users/${userId}/pumpLiveLitersAccum/${pump.id}`,
  ];
  if (pump.gatewayId?.trim()) {
    const ids = buildGatewayDeviceIds({
      moduleType: pump.type,
      moduleId: pump.id,
      deviceId: pump.deviceId,
      factoryId: pump.factoryId,
    });
    paths.push(...buildGatewayPumpActivityPaths(pump.gatewayId.trim(), ids));
  }

  const byDateMax = new Map<string, number>();

  for (const path of paths) {
    const snap = await get(ref(getFirebaseDb(), path));
    if (!snap.exists()) continue;
    const data = snap.val() as PumpActivityDayMap;
    if (!data || typeof data !== "object") continue;
    Object.entries(data).forEach(([date, value]) => {
      if (!isIsoDateKey(date) || date < cutoffDate) return;
      const liters = pumpActivityEntryToLiters(value, flowRate);
      const prev = byDateMax.get(date) ?? 0;
      byDateMax.set(date, Math.max(prev, liters));
    });
  }

  return Array.from(byDateMax.values()).reduce((a, b) => a + b, 0);
}
