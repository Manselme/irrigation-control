"use client";

import { Battery, AlertTriangle } from "lucide-react";

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
    <section className="rounded-xl bg-surface-lowest p-5 ring-1 ring-border/15">
      <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Low Battery Maintenance
      </h3>
      {lowBatteries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No critical batteries.</p>
      ) : (
        <div className="space-y-4">
          {lowBatteries.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-destructive/10">
                {item.battery < 10 ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Battery className="h-4 w-4 text-amber-600" />
                )}
              </div>
              <div className="min-w-0 flex-grow">
                <p className="truncate text-xs font-bold font-headline">{item.name}</p>
                <p className="text-[10px] uppercase tracking-tight text-muted-foreground">
                  {item.battery}% remaining &middot; {item.lastSeenLabel}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
