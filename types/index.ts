export type ModuleType = "mother" | "pump" | "field";

export interface Position {
  lat: number;
  lng: number;
}

export interface Module {
  id: string;
  type: ModuleType;
  farmId: string;
  zoneId?: string;
  lastSeen: number;
  battery?: number;
  online: boolean;
  position?: Position;
  pressure?: number;
  name?: string;
}

export interface Farm {
  id: string;
  name: string;
  center?: Position;
}

export interface Zone {
  id: string;
  farmId: string;
  name: string;
  polygon: { type: "Polygon"; coordinates: number[][][] };
  mode: "manual" | "auto";
  pumpModuleId?: string;
  fieldModuleIds: string[];
  autoRules?: {
    minHumidityThreshold?: number;
    rainThresholdMm?: number;
    /** Intervalle de vérification (minutes). Défaut 2. */
    checkIntervalMinutes?: number;
    /** Délai avant activation de la pompe quand humidité basse (minutes). Défaut 0. */
    pumpDelayMinutes?: number;
  };
}

export type CommandStatus = "pending" | "confirmed" | "failed";

export interface Command {
  id: string;
  type: "VALVE_OPEN" | "VALVE_CLOSE" | "PUMP_ON" | "PUMP_OFF";
  status: CommandStatus;
  createdAt: number;
  confirmedAt?: number;
}

export interface SensorDataPoint {
  timestamp: number;
  humidity?: number;
  ph?: number;
  battery?: number;
}

export interface AlertConfig {
  batteryThreshold?: number;
  pressureDropThreshold?: number;
  offlineMinutesThreshold?: number;
  /** Délai avant réarmement après retour à la normale (minutes). Défaut 1. */
  rearmMinutes?: number;
}

export interface AlertNotification {
  id: string;
  type: "battery" | "pressure" | "offline";
  message: string;
  moduleId?: string;
  zoneId?: string;
  createdAt: number;
  read: boolean;
}

export interface WeatherCacheEntry {
  lat: number;
  lng: number;
  date: string;
  precipitationMm: number;
  fetchedAt: number;
}
