import type { ForecastDay } from "./weather";

const RAIN_THRESHOLD_MM = 5;
const HUMIDITY_HIGH_PERCENT = 70;
const HUMIDITY_LOW_PERCENT = 30;

export interface SuggestionResult {
  text: string;
  discouraged: boolean;
}

export function getSuggestion(
  soilHumidityPercent: number | undefined,
  forecast: ForecastDay[] | null
): SuggestionResult {
  const rainNext24 =
    forecast?.length ? forecast[0].precipitationMm ?? 0 : 0;
  const rainSignificant = rainNext24 >= RAIN_THRESHOLD_MM;
  const humidityHigh =
    soilHumidityPercent != null && soilHumidityPercent >= HUMIDITY_HIGH_PERCENT;
  const humidityLow =
    soilHumidityPercent != null && soilHumidityPercent < HUMIDITY_LOW_PERCENT;

  if (rainSignificant) {
    return {
      text: `Pluie de ${Math.round(rainNext24)} mm prévue, irrigation déconseillée.`,
      discouraged: true,
    };
  }
  if (humidityLow) {
    return {
      text: `Humidité du sol basse (${soilHumidityPercent} %), irrigation recommandée.`,
      discouraged: false,
    };
  }
  if (humidityHigh) {
    return {
      text: `Humidité du sol élevée (${soilHumidityPercent} %), irrigation optionnelle.`,
      discouraged: false,
    };
  }
  return {
    text: "Aucune contrainte météo majeure.",
    discouraged: false,
  };
}
