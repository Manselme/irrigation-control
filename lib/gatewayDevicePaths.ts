import type { Module, ModuleType } from "@/types";

function normalizeId(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  return v.length > 0 ? v : null;
}

function extractHexSuffix(value: string | undefined): string | null {
  const normalized = normalizeId(value);
  if (!normalized) return null;
  const m = normalized.match(/([0-9A-F]{8})$/);
  return m ? m[1] : null;
}

function dedupeInOrder(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  values.forEach((v) => {
    const normalized = normalizeId(v ?? undefined);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

export interface BuildGatewayDeviceIdsInput {
  moduleType?: ModuleType;
  moduleId?: string;
  deviceId?: string;
  factoryId?: string;
}

/**
 * Build ordered fallback IDs for a gateway-bound module.
 * Priority:
 * 1) Explicit deviceId
 * 2) Canonical prefixed IDs from known 8-hex suffix (CHAMP/POMPE)
 * 3) Legacy aliases and moduleId fallback
 */
export function buildGatewayDeviceIds(input: BuildGatewayDeviceIdsInput): string[] {
  const normalizedDeviceId = normalizeId(input.deviceId);
  const normalizedModuleId = normalizeId(input.moduleId);
  const hex =
    extractHexSuffix(input.deviceId) ??
    extractHexSuffix(input.moduleId) ??
    extractHexSuffix(input.factoryId);

  const type = input.moduleType;
  const prefixedAliases =
    hex == null
      ? []
      : type === "pump"
        ? [`POMPE-${hex}`, `CHAMP-${hex}`, `DEVICE-${hex}`]
        : type === "field"
          ? [`CHAMP-${hex}`, `POMPE-${hex}`, `DEVICE-${hex}`]
          : [`DEVICE-${hex}`, `POMPE-${hex}`, `CHAMP-${hex}`];

  return dedupeInOrder([normalizedDeviceId, ...prefixedAliases, normalizedModuleId]);
}

/**
 * Options pour `gateways/{id}/commands/current` : identifiant matériel requis par la mère (dest LoRa).
 * Si `deviceId` est absent sur la fiche module, le déduit depuis l'id / factoryId (ex. POMPE-XXXXXXXX),
 * comme pour la lecture `status/` (voir buildGatewayDeviceIds).
 */
export function resolveGatewaySendCommandOpts(
  module: Pick<Module, "id" | "type" | "gatewayId" | "deviceId" | "factoryId"> | null | undefined
): { gatewayId: string; deviceId: string } | undefined {
  if (!module?.gatewayId?.trim()) return undefined;
  const gatewayId = module.gatewayId.trim();
  const ids = buildGatewayDeviceIds({
    moduleType: module.type,
    moduleId: module.id,
    deviceId: module.deviceId,
    factoryId: module.factoryId,
  });
  const deviceId = ids[0];
  if (!deviceId) return undefined;
  return { gatewayId, deviceId };
}

/** Aligné sur la mère / Firebase `dest`. */
export function normalizeGatewayDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

export function buildGatewayStatusPaths(
  gatewayId: string,
  ids: string[]
): string[] {
  const g = gatewayId.trim();
  if (!g) return [];
  return dedupeInOrder(ids).map((id) => `gateways/${g}/status/${id}`);
}

export function buildGatewaySensorPaths(
  gatewayId: string,
  ids: string[]
): string[] {
  const g = gatewayId.trim();
  if (!g) return [];
  return dedupeInOrder(ids).map((id) => `gateways/${g}/sensors/${id}`);
}

export function buildGatewayPumpActivityPaths(
  gatewayId: string,
  ids: string[]
): string[] {
  const g = gatewayId.trim();
  if (!g) return [];
  return dedupeInOrder(ids).map((id) => `gateways/${g}/pumpActivity/${id}`);
}
