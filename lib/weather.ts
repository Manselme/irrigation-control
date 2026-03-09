const OPEN_METEO_BASE = "https://api.open-meteo.com/v1";

export interface ForecastDay {
  date: string;
  precipitationMm: number;
}

export interface CurrentWeather {
  tempC: number;
  weatherCode?: number;
}

export async function getCurrentWeather(
  lat: number,
  lng: number
): Promise<CurrentWeather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,weather_code",
    timezone: "auto",
  });
  const res = await fetch(`${OPEN_METEO_BASE}/forecast?${params}`);
  if (!res.ok) throw new Error("Météo indisponible");
  const data = await res.json();
  const current = data.current as { temperature_2m?: number; weather_code?: number };
  return {
    tempC: Number(current?.temperature_2m) ?? 0,
    weatherCode: current?.weather_code != null ? Number(current.weather_code) : undefined,
  };
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
