/**
 * Applique une commande gateway (PUMP_*, VALVE_* + valveSlot) sur un snapshot status pompe.
 * Aligné sur le comportement attendu côté site / firmware (Vanne A|B + agrégat valveOpen).
 */
export function applyPumpCommandToGatewayStatus(
  current: Record<string, unknown>,
  cmd: { type: string; valveSlot?: string }
): Record<string, unknown> {
  let pumpOn = Boolean(current.pumpOn);
  let valveAOpen = Boolean(
    (current.valveAOpen as boolean | undefined) ?? (current.valveOpen as boolean | undefined) ?? false
  );
  let valveBOpen = Boolean(
    (current.valveBOpen as boolean | undefined) ?? (current.valveOpen as boolean | undefined) ?? false
  );

  const { type, valveSlot } = cmd;

  if (type === "PUMP_ON") {
    pumpOn = true;
  } else if (type === "PUMP_OFF") {
    pumpOn = false;
    valveAOpen = false;
    valveBOpen = false;
  } else if (type === "VALVE_OPEN") {
    if (valveSlot === "A") valveAOpen = true;
    else if (valveSlot === "B") valveBOpen = true;
    else {
      valveAOpen = true;
      valveBOpen = true;
    }
  } else if (type === "VALVE_CLOSE") {
    if (valveSlot === "A") valveAOpen = false;
    else if (valveSlot === "B") valveBOpen = false;
    else {
      valveAOpen = false;
      valveBOpen = false;
    }
  }

  const valveOpen = valveAOpen || valveBOpen;
  const now = Date.now();

  return {
    ...current,
    pumpOn,
    valveOpen,
    valveAOpen,
    valveBOpen,
    lastSeen: now,
    lastSeenTs: now,
  };
}

/** État initial status pompe dans la sandbox (double vanne). */
export function initialPumpGatewayStatus(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    lastSeen: now,
    lastSeenTs: now,
    pumpOn: false,
    valveOpen: false,
    valveAOpen: false,
    valveBOpen: false,
    pressure: 2.4,
    ...overrides,
  };
}
