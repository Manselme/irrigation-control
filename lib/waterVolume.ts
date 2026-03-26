import type { Module } from "@/types";

/** Conversion m³ → L pour l’affichage (données Firebase / firmware restent souvent en m³). */
export const M3_TO_LITERS = 1000;

/** Débit par défaut (L/min) si non configuré : équivalent à l’ancienne estimation ~0,03 m³/min. */
export const DEFAULT_FLOW_RATE_LITERS_PER_MINUTE = 30;

export function m3ToLiters(m3: number): number {
  return m3 * M3_TO_LITERS;
}

/** Litres/min saisis sur la fiche pompe, ou défaut pour rétrocompatibilité. */
export function getPumpFlowRateLitersPerMinute(pump: Module | null | undefined): number {
  const r = pump?.hydraulicSettings?.flowRateLitersPerMinute;
  if (typeof r === "number" && Number.isFinite(r) && r > 0) return r;
  return DEFAULT_FLOW_RATE_LITERS_PER_MINUTE;
}

/** Affichage compact (ex. dashboard). */
export function formatVolumeLiters(liters: number): string {
  if (!Number.isFinite(liters)) return "—";
  const rounded = Math.round(liters);
  return `${rounded.toLocaleString("fr-FR")} L`;
}

/** Litres cumulés sur une journée d’activité pompe (volume mesuré prioritaire). */
export function pumpDayToLiters(
  day: { minutesOn?: number; volume_m3?: number } | undefined,
  flowRateLitersPerMinute: number
): number {
  if (!day) return 0;
  const m3 = Number(day.volume_m3 ?? 0);
  if (Number.isFinite(m3) && m3 > 0) return m3ToLiters(m3);
  const min = Number(day.minutesOn ?? 0);
  if (!Number.isFinite(min) || min <= 0) return 0;
  return min * flowRateLitersPerMinute;
}
