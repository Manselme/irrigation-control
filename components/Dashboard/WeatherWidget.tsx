"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentWeather, getForecast } from "@/lib/weather";
import { getSuggestion } from "@/lib/irrigationSuggestions";
import { Cloud, CloudRain, Sun } from "lucide-react";

const DEFAULT_LAT = 46.6;
const DEFAULT_LNG = 1.9;

interface WeatherWidgetProps {
  lat?: number;
  lng?: number;
  humidity?: number;
}

function WeatherIcon({ code }: { code?: number }) {
  if (code == null) return <Cloud className="h-8 w-8 text-muted-foreground" />;
  if (code >= 61 && code <= 67) return <CloudRain className="h-8 w-8 text-muted-foreground" />;
  if (code === 0) return <Sun className="h-8 w-8 text-muted-foreground" />;
  return <Cloud className="h-8 w-8 text-muted-foreground" />;
}

export function WeatherWidget({ lat = DEFAULT_LAT, lng = DEFAULT_LNG, humidity }: WeatherWidgetProps) {
  const [current, setCurrent] = useState<{ tempC: number; weatherCode?: number } | null>(null);
  const [forecast, setForecast] = useState<{ date: string; precipitationMm: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getCurrentWeather(lat, lng), getForecast(lat, lng, 2)])
      .then(([cur, fcast]) => {
        if (!cancelled) {
          setCurrent(cur);
          setForecast(fcast);
        }
      })
      .catch(() => {
        if (!cancelled) setCurrent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const suggestion = getSuggestion(humidity, forecast.length ? forecast : null);
  const todayMm = forecast[0]?.precipitationMm ?? 0;
  const tomorrowMm = forecast[1]?.precipitationMm ?? 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          Météo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <WeatherIcon code={current?.weatherCode} />
              <div>
                <p className="text-2xl font-semibold">
                  {current?.tempC != null ? `${Math.round(current.tempC)} °C` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Aujourd&apos;hui : {todayMm} mm · Demain : {tomorrowMm} mm
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{suggestion.text}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
