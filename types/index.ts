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
  /** ID d'usine (4 octets MAC en hex, 8 caractères) pour Champ/Pompe. Déprécié au profit de deviceId. */
  factoryId?: string;
  /** Passerelle qui dessert ce module (ex. MERE-A842E35C). Requis pour lecture/écriture gateways/. */
  gatewayId?: string;
  /** Identifiant matériel (ex. CHAMP-99887766, POMPE-1234ABCD). Si présent, les données viennent de gateways/{gatewayId}/sensors|status. */
  deviceId?: string;
}

/** Passerelle liée au compte (AgriFlow V2). */
export interface LinkedGateway {
  gatewayId: string;
  farmId: string;
  name?: string;
  /** Timestamp (ms) du dernier heartbeat reçu (lastSeen écrit par la Mère). */
  lastSeen?: number;
  /** Dérivé de lastSeen : true si lastSeen dans les 2 dernières minutes. */
  online?: boolean;
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
  /** Tension du sol (tensiomètre) en centibars. Optionnel. */
  tension_cb?: number;
  /** Humidité sol à -10 cm (%). Optionnel. */
  humidity_10cm?: number;
  /** Humidité sol à -30 cm (%). Optionnel. */
  humidity_30cm?: number;
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
