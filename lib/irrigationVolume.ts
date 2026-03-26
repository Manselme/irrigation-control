/**
 * Contrat — volumes d’irrigation en litres (L)
 *
 * **Clé de jour** : `YYYY-MM-DD` en **UTC**, alignée sur la cloud function (`toIsoDate`) et sur
 * `pumpLiveLitersAccum` côté portail.
 *
 * **Sources RTDB** (par pompe `moduleId`) :
 * - `users/{uid}/pumpActivity/{moduleId}/{date}` — `minutes`, `volume_m3` (CF, miroir), évent. `irrigation_liters`
 * - `gateways/{gid}/pumpActivity/{deviceId}/{date}` — firmware / mère
 * - `users/{uid}/pumpLiveLitersAccum/{moduleId}/{date}` — `{ liters, updatedAt }` (portail, pompe ou vannes ouvertes)
 *
 * **Fusion multi-chemins** : pour une même date, `mergeDayLitersAcrossSources` = **max** des litres dérivés
 * par chemin, afin de limiter le double comptage lorsque deux sources reflètent la même eau.
 *
 * **CF vs portail** : `runFlowEstimator` n’incrémente que si `pumpOn`. Le portail peut cumuler avec vannes
 * seules via `pumpLiveLitersAccum` (option B — complément gravitaire).
 */

import { DEFAULT_FLOW_RATE_LITERS_PER_MINUTE, m3ToLiters } from "@/lib/waterVolume";

export type IrrigationDayRaw =
  | number
  | {
      minutes?: number;
      volume_m3?: number;
      irrigation_liters?: number;
      liters?: number;
      updatedAt?: number;
    };

/** Date UTC `YYYY-MM-DD` (même convention que Firebase CF `toIsoDate`). */
export function irrigationDateKeyUTC(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Litres pour une entrée « jour » brute RTDB.
 * Priorité : volume mesuré `volume_m3` → L, puis `irrigation_liters` / `liters`, puis `minutes` × débit,
 * puis nombre legacy (= minutes).
 */
export function irrigationDayLitersFromRawEntry(
  value: IrrigationDayRaw | undefined | null,
  flowRateLitersPerMinute: number
): number {
  if (value == null) return 0;
  const rate =
    typeof flowRateLitersPerMinute === "number" &&
    Number.isFinite(flowRateLitersPerMinute) &&
    flowRateLitersPerMinute > 0
      ? flowRateLitersPerMinute
      : DEFAULT_FLOW_RATE_LITERS_PER_MINUTE;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value * rate;
  }

  const volumeM3 = Number(value.volume_m3 ?? 0);
  if (Number.isFinite(volumeM3) && volumeM3 > 0) return m3ToLiters(volumeM3);

  const irrL = Number(value.irrigation_liters ?? NaN);
  if (Number.isFinite(irrL) && irrL >= 0) return irrL;

  if ("liters" in value) {
    const L = Number(value.liters);
    if (Number.isFinite(L) && L >= 0) return L;
  }

  const minutes = Number(value.minutes ?? 0);
  if (Number.isFinite(minutes) && minutes > 0) return minutes * rate;

  return 0;
}

/** Agrège plusieurs estimations du même jour (chemins différents) sans addition naïve. */
export function mergeDayLitersAcrossSources(litersPerPath: number[]): number {
  const valid = litersPerPath.filter((x) => Number.isFinite(x) && x >= 0);
  if (valid.length === 0) return 0;
  return Math.max(...valid);
}
