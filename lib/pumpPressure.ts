/** Conversion pression jauge (PSI) → bar (alertes / affichage secondaire). */
export const PSI_TO_BAR = 0.0689475729317831;

export function psiToBar(psi: number): number {
  return psi * PSI_TO_BAR;
}

export function barToPsi(bar: number): number {
  return bar / PSI_TO_BAR;
}

export function formatPumpPressure(psi: number | undefined | null): string {
  if (psi == null || !Number.isFinite(psi)) return "—";
  const bar = psiToBar(psi);
  return `${psi.toFixed(1)} PSI (${bar.toFixed(2)} bar)`;
}

/** Affichage unifié (capteur PSI passerelle ou legacy bar simulateur / module utilisateur). */
export function formatModulePumpPressure(m: {
  pressurePsi?: number;
  pressure?: number;
}): string {
  if (m.pressurePsi != null && Number.isFinite(m.pressurePsi)) return formatPumpPressure(m.pressurePsi);
  if (m.pressure != null && Number.isFinite(m.pressure)) return `${m.pressure.toFixed(2)} bar`;
  return "—";
}
