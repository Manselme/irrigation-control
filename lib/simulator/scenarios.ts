"use client";

import type { SimulatorAdapter } from "@/lib/simulator/adapter";
import {
  createBootstrapFixture,
  createSensorPoint,
  type SimulatorFixtureBundle,
  type SimulatorFixtureIds,
} from "@/lib/simulator/fixtures";

export type SimulatorScenarioId =
  | "normal_operation"
  | "hydric_stress_top3"
  | "gateway_outage"
  | "low_battery_maintenance"
  | "quota_90_alert"
  | "history_gap_then_recovery"
  | "command_timeout_then_ack";

export interface ScenarioContext {
  adapter: SimulatorAdapter;
  fixtureIds: SimulatorFixtureIds;
  ackDelaySec: number;
  forceAckTimeout: boolean;
}

export interface ScenarioResult {
  id: SimulatorScenarioId;
  title: string;
  summary: string;
  success: boolean;
}

export interface ScenarioDefinition {
  id: SimulatorScenarioId;
  title: string;
  description: string;
  run: (ctx: ScenarioContext) => Promise<ScenarioResult>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function applyBootstrapFixture(
  adapter: SimulatorAdapter,
  fixture: SimulatorFixtureBundle
): Promise<void> {
  await adapter.writeUser("", fixture.usersData);
  const gatewayEntries = Object.entries(fixture.gatewaysData);
  for (const [gatewayId, gatewayData] of gatewayEntries) {
    await adapter.writeGateway(gatewayId, "", gatewayData);
  }
}

async function runNormalOperation(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { adapter, fixtureIds } = ctx;
  const now = Date.now();
  for (const fieldId of fixtureIds.fieldDeviceIds) {
    await adapter.updateGateway(fixtureIds.gatewayId, `status/${fieldId}`, {
      lastSeen: now,
      battery: 84,
    });
    const point = createSensorPoint(45, 84, now);
    await adapter.writeGateway(fixtureIds.gatewayId, `sensors/${fieldId}`, point);
    await adapter.writeGateway(fixtureIds.gatewayId, `sensorsHistory/${fieldId}/${now}`, point);
  }
  await adapter.updateGateway(fixtureIds.gatewayId, `status/${fixtureIds.pumpDeviceId}`, {
    lastSeen: now,
    pumpOn: false,
    valveOpen: false,
    pressure: 2.3,
  });
  return {
    id: "normal_operation",
    title: "Normal operation",
    summary: "Système stable, humidité correcte, aucune alerte critique attendue.",
    success: true,
  };
}

async function runHydricStressTop3(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { adapter, fixtureIds } = ctx;
  const now = Date.now();
  const stressValues = [92, 85, 78];
  for (let i = 0; i < fixtureIds.fieldDeviceIds.length; i += 1) {
    const fieldId = fixtureIds.fieldDeviceIds[i];
    const tension = stressValues[i] ?? 70;
    const point = createSensorPoint(tension, 64 - i * 4, now);
    await adapter.writeGateway(fixtureIds.gatewayId, `sensors/${fieldId}`, point);
    await adapter.writeGateway(fixtureIds.gatewayId, `sensorsHistory/${fieldId}/${now}`, point);
    await adapter.updateGateway(fixtureIds.gatewayId, `status/${fieldId}`, {
      lastSeen: now,
      battery: point.battery,
    });
  }
  return {
    id: "hydric_stress_top3",
    title: "Hydric stress top3",
    summary: "Trois zones montées en tension pour valider tri Top 3 + CTA irrigation.",
    success: true,
  };
}

async function runGatewayOutage(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { adapter, fixtureIds } = ctx;
  const stale = Date.now() - 30 * 60 * 1000;
  await adapter.writeGateway(fixtureIds.gatewayId, "lastSeen", stale);
  for (const fieldId of fixtureIds.fieldDeviceIds) {
    await adapter.updateGateway(fixtureIds.gatewayId, `status/${fieldId}`, { lastSeen: stale });
  }
  await adapter.updateGateway(fixtureIds.gatewayId, `status/${fixtureIds.pumpDeviceId}`, {
    lastSeen: stale,
    pumpOn: false,
    valveOpen: false,
  });
  return {
    id: "gateway_outage",
    title: "Gateway outage",
    summary: "Heartbeat ancien simulé pour provoquer état hors ligne réseau/matériel.",
    success: true,
  };
}

async function runLowBatteryMaintenance(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { adapter, fixtureIds } = ctx;
  const now = Date.now();
  const lowLevels = [18, 14, 9];
  for (let i = 0; i < fixtureIds.fieldDeviceIds.length; i += 1) {
    const fieldId = fixtureIds.fieldDeviceIds[i];
    const battery = lowLevels[i] ?? 15;
    const point = createSensorPoint(58 + i * 3, battery, now);
    await adapter.writeGateway(fixtureIds.gatewayId, `sensors/${fieldId}`, point);
    await adapter.updateGateway(fixtureIds.gatewayId, `status/${fieldId}`, { lastSeen: now, battery });
    await adapter.updateUser(`modules/${fieldId}`, { battery, lastSeen: now });
  }
  return {
    id: "low_battery_maintenance",
    title: "Low battery maintenance",
    summary: "Batteries <20% injectées pour valider le bloc maintenance.",
    success: true,
  };
}

async function runQuota90Alert(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { adapter, fixtureIds } = ctx;
  const now = Date.now();
  const days = [0, 1, 2, 3, 4, 5, 6];
  for (const dayOffset of days) {
    const date = new Date(now - dayOffset * 24 * 3600_000).toISOString().slice(0, 10);
    await adapter.writeGateway(
      fixtureIds.gatewayId,
      `pumpActivity/${fixtureIds.pumpDeviceId}/${date}`,
      { minutes: 180 - dayOffset * 10, volume_m3: 14 - dayOffset * 0.7 }
    );
  }
  await adapter.updateGateway(fixtureIds.gatewayId, `status/${fixtureIds.pumpDeviceId}`, {
    lastSeen: now,
    pumpOn: true,
    valveOpen: true,
    pressure: 2.7,
  });
  return {
    id: "quota_90_alert",
    title: "Quota 90 alert",
    summary: "Activité hebdo renforcée pour dépasser 90% du quota réglementaire.",
    success: true,
  };
}

async function runHistoryGapRecovery(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { adapter, fixtureIds } = ctx;
  const targetField = fixtureIds.fieldDeviceIds[0];
  await adapter.writeGateway(fixtureIds.gatewayId, `sensorsHistory/${targetField}`, {});
  await wait(250);
  const now = Date.now();
  const point = createSensorPoint(61, 73, now);
  await adapter.writeGateway(fixtureIds.gatewayId, `sensors/${targetField}`, point);
  await adapter.writeGateway(fixtureIds.gatewayId, `sensorsHistory/${targetField}/${now}`, point);
  return {
    id: "history_gap_then_recovery",
    title: "History gap then recovery",
    summary: "Trou historique temporaire puis reprise des points capteurs.",
    success: true,
  };
}

async function runCommandTimeoutThenAck(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { adapter, fixtureIds, ackDelaySec, forceAckTimeout } = ctx;
  const command = {
    id: `cmd_${Date.now()}`,
    dest: fixtureIds.pumpDeviceId,
    type: "PUMP_ON",
    status: "pending",
    createdAt: Date.now(),
  };
  await adapter.writeGateway(fixtureIds.gatewayId, "commands/current", command);
  if (forceAckTimeout) {
    return {
      id: "command_timeout_then_ack",
      title: "Command timeout then ack",
      summary: "Commande laissée en pending volontairement (timeout attendu côté UI).",
      success: true,
    };
  }
  await wait(ackDelaySec * 1000 + 150);
  await adapter.writeGateway(fixtureIds.gatewayId, "commands/current", {
    ...command,
    status: "confirmed",
    confirmedAt: Date.now(),
  });
  await adapter.updateGateway(fixtureIds.gatewayId, `status/${fixtureIds.pumpDeviceId}`, {
    pumpOn: true,
    valveOpen: true,
    lastSeen: Date.now(),
  });
  return {
    id: "command_timeout_then_ack",
    title: "Command timeout then ack",
    summary: "Commande simulée pending puis confirmée après délai pour valider les feedbacks.",
    success: true,
  };
}

export const SIMULATOR_SCENARIOS: ScenarioDefinition[] = [
  { id: "normal_operation", title: "Normal operation", description: "État nominal global.", run: runNormalOperation },
  { id: "hydric_stress_top3", title: "Hydric stress top3", description: "Stress hydrique fort sur 3 zones.", run: runHydricStressTop3 },
  { id: "gateway_outage", title: "Gateway outage", description: "Passerelle et modules simulés hors ligne.", run: runGatewayOutage },
  { id: "low_battery_maintenance", title: "Low battery maintenance", description: "Maintenance: batteries critiques.", run: runLowBatteryMaintenance },
  { id: "quota_90_alert", title: "Quota 90 alert", description: "Quota hebdo pompage à plus de 90%.", run: runQuota90Alert },
  { id: "history_gap_then_recovery", title: "History gap then recovery", description: "Historique vide puis reprise capteurs.", run: runHistoryGapRecovery },
  { id: "command_timeout_then_ack", title: "Command timeout then ack", description: "Commande pending puis ACK ou timeout forcé.", run: runCommandTimeoutThenAck },
];

export async function runSimulatorScenario(
  id: SimulatorScenarioId,
  ctx: ScenarioContext
): Promise<ScenarioResult> {
  const definition = SIMULATOR_SCENARIOS.find((x) => x.id === id);
  if (!definition) return { id, title: id, summary: "Scénario introuvable.", success: false };
  try {
    return await definition.run(ctx);
  } catch (error) {
    return {
      id,
      title: definition.title,
      summary: `Erreur scénario: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
    };
  }
}

export function createFreshBootstrapFixture(seed?: number): SimulatorFixtureBundle {
  return createBootstrapFixture(seed);
}

