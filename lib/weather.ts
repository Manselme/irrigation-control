const OPEN_METEO_BASE = "https://api.open-meteo.com/v1";

export interface ForecastDay {
  date: string;
  precipitationMm: number;
}

export async function getForecast(
  lat: number,
  lng: number,
  days: number = 2
): Promise<ForecastDay[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "precipitation_sum",
    timezone: "auto",
    forecast_days: String(days),
  });
  const res = await fetch(`${OPEN_METEO_BASE}/forecast?${params}`);
  if (!res.ok) throw new Error("Météo indisponible");
  const data = await res.json();
  const daily = data.daily as {
    time: string[];
    precipitation_sum: number[];
  };
  if (!daily?.time?.length) return [];
  return daily.time.map((date: string, i: number) => ({
    date,
    precipitationMm: Number(daily.precipitation_sum?.[i]) || 0,
  }));
}

export function getTotalPrecipitationNext24h(forecast: ForecastDay[]): number {
  return forecast.slice(0, 1).reduce((sum, d) => sum + d.precipitationMm, 0);
}
