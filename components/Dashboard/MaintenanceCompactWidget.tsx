"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LowBatteryItem {
  id: string;
  name: string;
  battery: number;
  lastSeenLabel: string;
}

interface MaintenanceCompactWidgetProps {
  lowBatteries: LowBatteryItem[];
}

export function MaintenanceCompactWidget({ lowBatteries }: MaintenanceCompactWidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Maintenance matériel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-slate-50 p-2 text-sm">
          Signal LoRa faible: <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">bientôt disponible</span>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Batteries faibles (&lt; 20%)</p>
          {lowBatteries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune batterie critique.</p>
          ) : (
            lowBatteries.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{item.name}</p>
                <p>{item.battery}%</p>
                <p className="text-muted-foreground">{item.lastSeenLabel}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

