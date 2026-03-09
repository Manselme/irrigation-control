"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplets } from "lucide-react";
import type { Zone } from "@/types";

const DEFAULT_HUMIDITY_THRESHOLD = 30;

interface ZonesToWatchWidgetProps {
  zones: Zone[];
  humidityByZone: Record<string, number | undefined>;
}

export function ZonesToWatchWidget({ zones, humidityByZone }: ZonesToWatchWidgetProps) {
  const toWatch = zones
    .map((z) => {
      const humidity = humidityByZone[z.id];
      const threshold = z.autoRules?.minHumidityThreshold ?? DEFAULT_HUMIDITY_THRESHOLD;
      if (humidity == null) return null;
      if (humidity >= threshold) return null;
      return { zone: z, humidity };
    })
    .filter((x): x is { zone: Zone; humidity: number } => x != null)
    .slice(0, 3);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          Zones à surveiller
        </CardTitle>
      </CardHeader>
      <CardContent>
        {toWatch.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune zone sous le seuil d&apos;humidité.</p>
        ) : (
          <ul className="space-y-2">
            {toWatch.map(({ zone, humidity }) => (
              <li
                key={zone.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{zone.name || zone.id}</span>
                  <span className="font-semibold text-sm">{humidity} %</span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/irrigation?zone=${zone.id}`}>Voir</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
