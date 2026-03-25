export type ModuleType = "mother" | "pump" | "field";
/** Vanne logique : une voie, l’autre, ou les deux (même pompe). */
export type ValveSlot = "A" | "B" | "AB";

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
  /** Pression en bar (dérivée du capteur PSI passerelle ou champ utilisateur legacy). */
  pressure?: number;
  /** Pression brute capteur pompe (PSI), depuis gateways/.../status/pressurePsi. */
  pressurePsi?: number;
  name?: string;
  /** ID d'usine (4 octets MAC en hex, 8 caractères) pour Champ/Pompe. Déprécié au profit de deviceId. */
  factoryId?: string;
  /** Passerelle qui dessert ce module (ex. MERE-A842E35C). Requis pour lecture/écriture gateways/. */
  gatewayId?: string;
  /** Identifiant matériel (ex. CHAMP-99887766, POMPE-1234ABCD). Si présent, les données viennent de gateways/{gatewayId}/sensors|status. */
  deviceId?: string;
  /** V2.2: configuration hydraulique de la pompe (rétrocompatible, optionnelle). */
  hydraulicSettings?: {
    pipeDiameterMm?: number;
    referencePressureBar?: number;
    updatedAt?: number;
  };
  /** V2.2: vannes logiques d'un module pompe. */
  valves?: {
    A?: { name?: string; zoneId?: string; status?: "ON" | "OFF" };
    B?: { name?: string; zoneId?: string; status?: "ON" | "OFF" };
  };
}

/** Passerelle liée au compte (CeresAnalytics V2). */
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

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  updatedAt?: number;
}

export interface Zone {
  id: string;
  farmId: string;
  name: string;
  polygon: { type: "Polygon"; coordinates: number[][][] };
  /** V2.1: sous-polygones de la zone (rétrocompatible: dérivé de polygon si absent). */
  sectors?: {
    id: string;
    name: string;
    polygon: { type: "Polygon"; coordinates: number[][][] };
    valveModuleIds?: string[];
    /** V2.2: vanne logique qui alimente ce secteur. */
    valveSlot?: ValveSlot;
  }[];
  mode: "manual" | "auto";
  /** V1: pompe unique (conservé pour rétrocompatibilité). */
  pumpModuleId?: string;
  /** V2.1: multi-pompes possibles. */
  pumpModuleIds?: string[];
  /** V2.1: vannes possibles au niveau zone. */
  valveModuleIds?: string[];
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
  type:
    | "VALVE_OPEN"
    | "VALVE_CLOSE"
    | "VALVE_A_OPEN"
    | "VALVE_A_CLOSE"
    | "VALVE_B_OPEN"
    | "VALVE_B_CLOSE"
    | "PUMP_ON"
    | "PUMP_OFF";
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
  /** Seuil pression haute (bar) au-dessus duquel on déclenche une sécurité. */
  pressureHighThreshold?: number;
  /** Sécurité: coupe automatiquement la pompe si pression basse. */
  autoStopOnLowPressure?: boolean;
  /** Délai (secondes) pendant lequel la pression doit rester basse avant arrêt. Défaut 5. */
  autoStopLowPressureDelaySec?: number;
  /** Si true, ferme aussi les vannes après arrêt pompe. Défaut true. */
  autoStopCloseValves?: boolean;
  /** Sécurité: ouvre les vannes et coupe la pompe si pression haute. */
  autoStopOnHighPressure?: boolean;
  /** Délai (secondes) pendant lequel la pression doit rester haute avant action. Défaut 1. */
  autoStopHighPressureDelaySec?: number;
  /** Si true, ouvre les vannes avant d’éteindre la pompe. Défaut true. */
  autoStopOpenValves?: boolean;
  /** Tension sol (cb) au-dessus de laquelle on alerte un stress hydrique. */
  stressTensionThreshold?: number;
  offlineMinutesThreshold?: number;
  /** Délai avant réarmement après retour à la normale (minutes). Défaut 1. */
  rearmMinutes?: number;
}

export interface AlertNotification {
  id: string;
  type: "battery" | "pressure" | "offline" | "stress";
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

export interface FlowEstimatePumpDay {
  volume_m3: number;
  minutesOn: number;
  pressureBar?: number;
  updatedAt: number;
}

export interface FlowEstimateZoneDay {
  volume_m3: number;
  minutesOn: number;
  updatedAt: number;
}
