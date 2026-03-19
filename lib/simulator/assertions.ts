"use client";

import type { SimulatorAdapter } from "@/lib/simulator/adapter";
import type { SimulatorFixtureIds } from "@/lib/simulator/fixtures";
import type { SimulatorScenarioId } from "@/lib/simulator/scenarios";

export interface AssertionResult {
  key: string;
  ok: boolean;
  details: string;
}

export interface ScenarioAssertionReport {
  scenarioId: SimulatorScenarioId;
  passed: boolean;
  checks: AssertionResult[];
}

function check(key: string, ok: boolean, details: string): AssertionResult {
  return { key, ok, details };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

async function commonChecks(
  adapter: SimulatorAdapter,
  fixtureIds: SimulatorFixtureIds
): Promise<AssertionResult[]> {
  const checks: AssertionResult[] = [];
  const modules = await adapter.readUser<Record<string, unknown>>("modules");
  checks.push(check("modules_present", isObject(modules) && Object.keys(modules).length >= 4, "Modules capteurs/pompe disponibles"));
  const linked = await adapter.readUser<Record<string, unknown>>("linkedGateways");
  checks.push(check("gateway_linked", isObject(linked) && fixtureIds.gatewayId in linked, "Passerelle liée présente"));
  return checks;
}

export async function runScenarioAssertions(
  scenarioId: SimulatorScenarioId,
  adapter: SimulatorAdapter,
  fixtureIds: SimulatorFixtureIds
): Promise<ScenarioAssertionReport> {
  const checks = await commonChecks(adapter, fixtureIds);

  if (scenarioId === "hydric_stress_top3") {
    const sensors = await adapter.readGateway<Record<string, unknown>>(fixtureIds.gatewayId, "sensors");
    const values = fixtureIds.fieldDeviceIds
      .map((id) => (sensors?.[id] as { tension_cb?: number } | undefined)?.tension_cb ?? 0)
      .sort((a, b) => b - a);
    checks.push(check("stress_ranked", values.length >= 3 && values[0] >= values[1] && values[1] >= values[2] && values[0] >= 70, "Top tensions présentes et ordonnables"));
  }

  if (scenarioId === "gateway_outage") {
    const gatewayLastSeen = await adapter.readGateway<number>(fixtureIds.gatewayId, "lastSeen");
    checks.push(check("gateway_outage_lastSeen", typeof gatewayLastSeen === "number" && Date.now() - gatewayLastSeen > 10 * 60 * 1000, "Heartbeat passerelle suffisamment ancien"));
  }

  if (scenarioId === "low_battery_maintenance") {
    const status = await adapter.readGateway<Record<string, unknown>>(fixtureIds.gatewayId, "status");
    const lows = fixtureIds.fieldDeviceIds.filter((id) => {
      const battery = (status?.[id] as { battery?: number } | undefined)?.battery;
      return typeof battery === "number" && battery < 20;
    });
    checks.push(check("low_battery_count", lows.length >= 2, "Au moins 2 modules sous 20%"));
  }

  if (scenarioId === "quota_90_alert") {
    const activity = await adapter.readGateway<Record<string, unknown>>(fixtureIds.gatewayId, `pumpActivity/${fixtureIds.pumpDeviceId}`);
    checks.push(check("pump_activity_populated", isObject(activity) && Object.keys(activity).length >= 5, "Historique pompage hebdo peuplé"));
  }

  if (scenarioId === "history_gap_then_recovery") {
    const target = fixtureIds.fieldDeviceIds[0];
    const history = await adapter.readGateway<Record<string, unknown>>(fixtureIds.gatewayId, `sensorsHistory/${target}`);
    checks.push(check("history_recovered", isObject(history) && Object.keys(history).length >= 1, "Historique réinjecté après gap"));
  }

  if (scenarioId === "command_timeout_then_ack") {
    const cmd = await adapter.readGateway<Record<string, unknown>>(fixtureIds.gatewayId, "commands/current");
    const status = (cmd?.status as string | undefined) ?? "";
    checks.push(check("command_status_observed", status === "pending" || status === "confirmed", "Commande observée pending/confirmed"));
  }

  if (scenarioId === "normal_operation") {
    const pump = await adapter.readGateway<Record<string, unknown>>(
      fixtureIds.gatewayId,
      `status/${fixtureIds.pumpDeviceId}`
    );
    checks.push(
      check(
        "pump_valves_a_b",
        typeof pump?.valveAOpen === "boolean" && typeof pump?.valveBOpen === "boolean",
        "Status pompe dual-vanne (valveAOpen / valveBOpen)"
      )
    );
  }

  return { scenarioId, passed: checks.every((c) => c.ok), checks };
}

