const OPEN_METEO_BASE = "https://api.open-meteo.com/v1";

export interface ForecastDay {
  date: string;
  precipitationMm: number;
}

export interface CurrentWeather {
  tempC: number;
  weatherCode?: number;
}

export interface AgroHourlyPoint {
  time: string;
  tempC: number;
  windKmh: number;
  rainProbPct: number;
}

export interface AgroMeteoSnapshot {
  hourly24h: AgroHourlyPoint[];
  etTodayMm: number;
  rain24hMm: number;
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

export async function getAgroMeteoSnapshot(
  lat: number,
  lng: number
): Promise<AgroMeteoSnapshot> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "temperature_2m,wind_speed_10m,precipitation_probability",
    daily: "et0_fao_evapotranspiration,precipitation_sum",
    timezone: "auto",
    forecast_days: "2",
  });
  const res = await fetch(`${OPEN_METEO_BASE}/forecast?${params}`);
  if (!res.ok) throw new Error("Météo indisponible");
  const data = await res.json();

  const now = Date.now();
  const cutoff = now + 24 * 60 * 60 * 1000;

  const hourly = (data.hourly ?? {}) as {
    time?: string[];
    temperature_2m?: number[];
    wind_speed_10m?: number[];
    precipitation_probability?: number[];
  };
  const hourly24h: AgroHourlyPoint[] = (hourly.time ?? [])
    .map((time, i) => ({
      time,
      tempC: Number(hourly.temperature_2m?.[i] ?? 0),
      windKmh: Number(hourly.wind_speed_10m?.[i] ?? 0),
      rainProbPct: Number(hourly.precipitation_probability?.[i] ?? 0),
    }))
    .filter((p) => {
      const ts = new Date(p.time).getTime();
      return Number.isFinite(ts) && ts >= now && ts <= cutoff;
    });

  const daily = (data.daily ?? {}) as {
    et0_fao_evapotranspiration?: number[];
    precipitation_sum?: number[];
  };
  const etTodayMm = Number(daily.et0_fao_evapotranspiration?.[0] ?? 0);
  const rain24hMm = Number(daily.precipitation_sum?.[0] ?? 0);

  return { hourly24h, etTodayMm, rain24hMm };
}

const OPEN_METEO_ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1";

export interface DailyWeatherWithEt0 {
  date: string;
  precipitationMm: number;
  et0Mm: number;
  tempMaxC: number;
  tempMinC: number;
  soilTempC?: number;
}

/**
 * Récupère les données météo daily (pluie, ET0, températures) sur un intervalle de dates (données historiques).
 */
export async function getDailyWeatherWithEt0(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<DailyWeatherWithEt0[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: startDate,
    end_date: endDate,
    daily: "precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
  });
  const res = await fetch(`${OPEN_METEO_ARCHIVE_BASE}/archive?${params}`);
  if (!res.ok) throw new Error("Météo indisponible");
  const data = await res.json();
  const daily = data.daily as {
    time: string[];
    precipitation_sum: number[];
    et0_fao_evapotranspiration: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
  if (!daily?.time?.length) return [];
  return daily.time.map((date: string, i: number) => ({
    date,
    precipitationMm: Number(daily.precipitation_sum?.[i]) || 0,
    et0Mm: Number(daily.et0_fao_evapotranspiration?.[i]) || 0,
    tempMaxC: Number(daily.temperature_2m_max?.[i]) ?? 0,
    tempMinC: Number(daily.temperature_2m_min?.[i]) ?? 0,
  }));
}
