"use client";

import { initialPumpGatewayStatus } from "@/lib/simulator/pumpCommandHelpers";

export interface SimulatorFixtureIds {
  farmId: string;
  gatewayId: string;
  fieldDeviceIds: [string, string, string];
  pumpDeviceId: string;
  zoneIds: [string, string, string];
}

export interface SimulatorFixtureBundle {
  ids: SimulatorFixtureIds;
  usersData: Record<string, unknown>;
  gatewaysData: Record<string, Record<string, unknown>>;
}

export interface SensorFixturePoint {
  timestamp: number;
  tension_cb: number;
  humidity: number;
  humidity_10cm: number;
  humidity_30cm: number;
  battery: number;
}

export function createDefaultFixtureIds(seed: number = Date.now()): SimulatorFixtureIds {
  const suffix = seed.toString(16).slice(-8).toUpperCase().padStart(8, "0");
  return {
    farmId: "espace-main",
    gatewayId: `MERE-${suffix}`,
    fieldDeviceIds: [
      `CHAMP-${suffix.slice(0, 4)}AA${suffix.slice(6, 8)}`,
      `CHAMP-${suffix.slice(0, 4)}BB${suffix.slice(6, 8)}`,
      `CHAMP-${suffix.slice(0, 4)}CC${suffix.slice(6, 8)}`,
    ],
    pumpDeviceId: `POMPE-${suffix}`,
    zoneIds: ["zone-nord", "zone-centre", "zone-sud"],
  };
}

function makeHumidityFromTension(tensionCb: number): number {
  return Math.max(0, Math.min(100, 100 - tensionCb));
}

export function createSensorPoint(tensionCb: number, battery = 85, at = Date.now()): SensorFixturePoint {
  const humidity = makeHumidityFromTension(tensionCb);
  return {
    timestamp: at,
    tension_cb: tensionCb,
    humidity,
    humidity_10cm: Math.max(0, Math.min(100, humidity + 8)),
    humidity_30cm: Math.max(0, Math.min(100, humidity - 6)),
    battery,
  };
}

export function createBootstrapFixture(seed: number = Date.now()): SimulatorFixtureBundle {
  const ids = createDefaultFixtureIds(seed);
  const [fieldA, fieldB, fieldC] = ids.fieldDeviceIds;
  const [zoneNorth, zoneCenter, zoneSouth] = ids.zoneIds;
  const now = Date.now();

  const polyNorth = {
    type: "Polygon" as const,
    coordinates: [[[1.898, 46.601], [1.9, 46.601], [1.9, 46.603], [1.898, 46.603], [1.898, 46.601]]],
  };
  const polyCenter = {
    type: "Polygon" as const,
    coordinates: [[[1.901, 46.601], [1.903, 46.601], [1.903, 46.603], [1.901, 46.603], [1.901, 46.601]]],
  };
  const polySouth = {
    type: "Polygon" as const,
    coordinates: [[[1.904, 46.599], [1.906, 46.599], [1.906, 46.601], [1.904, 46.601], [1.904, 46.599]]],
  };

  const usersData: Record<string, unknown> = {
    farms: { [ids.farmId]: { name: "Espace de simulation" } },
    linkedGateways: { [ids.gatewayId]: { farmId: ids.farmId, name: "Passerelle principale" } },
    modules: {
      [fieldA]: {
        type: "field", farmId: ids.farmId, zoneId: zoneNorth, name: "Capteur Nord", lastSeen: now,
        online: true, battery: 88, gatewayId: ids.gatewayId, deviceId: fieldA,
      },
      [fieldB]: {
        type: "field", farmId: ids.farmId, zoneId: zoneCenter, name: "Capteur Centre", lastSeen: now,
        online: true, battery: 82, gatewayId: ids.gatewayId, deviceId: fieldB,
      },
      [fieldC]: {
        type: "field", farmId: ids.farmId, zoneId: zoneSouth, name: "Capteur Sud", lastSeen: now,
        online: true, battery: 79, gatewayId: ids.gatewayId, deviceId: fieldC,
      },
      [ids.pumpDeviceId]: {
        type: "pump", farmId: ids.farmId, zoneId: zoneNorth, name: "Pompe Nord", lastSeen: now,
        online: true, pressure: 2.4, gatewayId: ids.gatewayId, deviceId: ids.pumpDeviceId,
      },
    },
    zones: {
      [zoneNorth]: {
        farmId: ids.farmId,
        name: "Zone Nord",
        mode: "manual",
        pumpModuleId: ids.pumpDeviceId,
        pumpModuleIds: [ids.pumpDeviceId],
        fieldModuleIds: [fieldA],
        polygon: polyNorth,
        sectors: [
          {
            id: "sector-main",
            name: "Secteur principal",
            polygon: polyNorth,
            valveModuleIds: [],
            valveSlot: "A",
          },
        ],
      },
      [zoneCenter]: {
        farmId: ids.farmId,
        name: "Zone Centre",
        mode: "manual",
        pumpModuleId: ids.pumpDeviceId,
        pumpModuleIds: [ids.pumpDeviceId],
        fieldModuleIds: [fieldB],
        polygon: polyCenter,
        sectors: [
          {
            id: "sector-main",
            name: "Secteur principal",
            polygon: polyCenter,
            valveModuleIds: [],
            valveSlot: "B",
          },
        ],
      },
      /** Capteur seul : pas de vanne (1 pompe = max 2 zones identifiées A/B). */
      [zoneSouth]: {
        farmId: ids.farmId,
        name: "Zone Sud",
        mode: "manual",
        fieldModuleIds: [fieldC],
        polygon: polySouth,
      },
    },
    alerts: { config: { batteryThreshold: 20, stressTensionThreshold: 60, offlineMinutesThreshold: 5 }, notifications: {} },
    profile: { displayName: "Utilisateur Simulation", photoURL: "", updatedAt: now },
    quickAccess: { irrigation: true, material: true, alerts: true, history: true },
  };

  const sensorA = createSensorPoint(38, 88, now);
  const sensorB = createSensorPoint(72, 82, now);
  const sensorC = createSensorPoint(55, 79, now);

  const gatewaysData: Record<string, Record<string, unknown>> = {
    [ids.gatewayId]: {
      lastSeen: now,
      status: {
        [fieldA]: { lastSeen: now, battery: 88 },
        [fieldB]: { lastSeen: now, battery: 82 },
        [fieldC]: { lastSeen: now, battery: 79 },
        [ids.pumpDeviceId]: initialPumpGatewayStatus({ pressure: 2.4 }),
      },
      sensors: { [fieldA]: sensorA, [fieldB]: sensorB, [fieldC]: sensorC },
      sensorsHistory: {
        [fieldA]: { [String(now - 3600_000)]: createSensorPoint(40, 90, now - 3600_000), [String(now)]: sensorA },
        [fieldB]: { [String(now - 3600_000)]: createSensorPoint(65, 84, now - 3600_000), [String(now)]: sensorB },
        [fieldC]: { [String(now - 3600_000)]: createSensorPoint(50, 80, now - 3600_000), [String(now)]: sensorC },
      },
      pumpActivity: {
        [ids.pumpDeviceId]: {
          [new Date(now - 2 * 24 * 3600_000).toISOString().slice(0, 10)]: { minutes: 42, volume_m3: 1.4 },
          [new Date(now - 1 * 24 * 3600_000).toISOString().slice(0, 10)]: { minutes: 65, volume_m3: 2.0 },
          [new Date(now).toISOString().slice(0, 10)]: { minutes: 20, volume_m3: 0.8 },
        },
      },
      commands: { current: { id: "", status: "idle" } },
    },
  };

  return { ids, usersData, gatewaysData };
}

