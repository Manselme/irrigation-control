"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AlertNotification } from "@/types";

interface AlertsMaterialWidgetProps {
  notifications: AlertNotification[];
  maxItems?: number;
}

function statusPill(n: AlertNotification) {
  if (n.read) {
    return (
      <span className="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase text-primary">
        Resolved
      </span>
    );
  }
  return (
    <span className="rounded bg-destructive/10 px-2 py-0.5 text-[9px] font-black uppercase text-destructive">
      Pending
    </span>
  );
}

export function AlertsMaterialWidget({
  notifications,
  maxItems = 5,
}: AlertsMaterialWidgetProps) {
  const display = notifications.slice(0, maxItems);

  return (
    <section className="rounded-xl bg-surface-lowest p-5 ring-1 ring-border/15 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Recent Alerts Log
        </h3>
        <Button variant="ghost" size="sm" asChild className="text-[10px] font-black uppercase text-primary tracking-widest">
          <Link href="/alerts">Full Report</Link>
        </Button>
      </div>
      {display.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent alerts.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left data-table">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-surface-low">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-medium text-muted-foreground">
              {display.map((n) => (
                <tr key={n.id}>
                  <td className="px-3 py-2.5">
                    {n.createdAt
                      ? new Date(n.createdAt).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-foreground">{n.message}</td>
                  <td className="px-3 py-2.5 text-right">{statusPill(n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
