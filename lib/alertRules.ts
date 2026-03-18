import type { Module } from "@/types";
import type { AlertConfig } from "@/types";
import type { LatestSensorSnapshot } from "./hooks/useSensorData";

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

export interface AlertCheckResult {
  type: "battery" | "pressure" | "offline" | "stress";
  message: string;
  moduleId: string;
}

export function checkModuleAlerts(
  module: Module,
  config: AlertConfig,
  latestSensor?: LatestSensorSnapshot | null
): AlertCheckResult | null {
  if (!config) return null;

  const now = Date.now();
  const offline = !module.online || now - module.lastSeen > (config.offlineMinutesThreshold ?? 5) * 60 * 1000;
  if (offline && config.offlineMinutesThreshold != null) {
    return {
      type: "offline",
      message: `Module ${module.id} hors ligne depuis plus de ${config.offlineMinutesThreshold} min.`,
      moduleId: module.id,
    };
  }

  const battery = latestSensor?.battery ?? module.battery;
  if (
    battery != null &&
    config.batteryThreshold != null &&
    battery < config.batteryThreshold
  ) {
    return {
      type: "battery",
      message: `Batterie du module ${module.id} à ${battery} % (seuil ${config.batteryThreshold} %).`,
      moduleId: module.id,
    };
  }

  if (
    module.type === "pump" &&
    module.pressure != null &&
    module.pressure < (config.pressureDropThreshold ?? 1)
  ) {
    return {
      type: "pressure",
      message: `Pression basse sur la pompe ${module.id} (${module.pressure} bar, seuil ${config.pressureDropThreshold ?? 1}).`,
      moduleId: module.id,
    };
  }

  if (module.type === "pump" && module.pressure != null && module.pressure <= 0) {
    const valveOn =
      module.valves?.A?.status === "ON" ||
      module.valves?.B?.status === "ON";
    if (valveOn) {
      return {
        type: "pressure",
        message: `Anomalie: pompe ${module.id} activee avec pression nulle (verifier aspiration/pompe).`,
        moduleId: module.id,
      };
    }
  }

  const tension = latestSensor?.tension_cb;
  if (
    module.type === "field" &&
    tension != null &&
    tension > (config.stressTensionThreshold ?? 60)
  ) {
    return {
      type: "stress",
      message: `Stress hydrique sur ${module.id}: tension ${Math.round(tension)} cb (seuil ${config.stressTensionThreshold ?? 60}).`,
      moduleId: module.id,
    };
  }

  return null;
}
