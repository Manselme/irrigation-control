import type { ForecastDay } from "./weather";

const DEFAULT_MIN_HUMIDITY = 30;
const DEFAULT_RAIN_MM = 10;

export interface AutoRuleInput {
  soilHumidityPercent: number | undefined;
  forecast: ForecastDay[] | null;
  minHumidityThreshold?: number;
  rainThresholdMm?: number;
}

export function shouldIrrigate(input: AutoRuleInput): boolean {
  const {
    soilHumidityPercent,
    forecast,
    minHumidityThreshold = DEFAULT_MIN_HUMIDITY,
    rainThresholdMm = DEFAULT_RAIN_MM,
  } = input;

  const rainNext = forecast?.[0]?.precipitationMm ?? 0;
  if (rainNext >= rainThresholdMm) return false;
  // 0 est une valeur valide (sol très sec) → irrigation
  if (soilHumidityPercent == null) return false;
  return soilHumidityPercent < minHumidityThreshold;
}
