import type { Module } from "@/types";
import type { AlertConfig } from "@/types";
import type { LatestSensorSnapshot } from "./hooks/useSensorData";

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

export interface AlertCheckResult {
  type: "battery" | "pressure" | "offline";
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
    config.pressureDropThreshold != null &&
    module.pressure < config.pressureDropThreshold
  ) {
    return {
      type: "pressure",
      message: `Pression basse sur la pompe ${module.id} (${module.pressure} bar, seuil ${config.pressureDropThreshold}).`,
      moduleId: module.id,
    };
  }

  return null;
}
