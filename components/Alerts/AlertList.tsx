"use client";

import { useState } from "react";
import type { AlertNotification } from "@/types";
import { Button } from "@/components/ui/button";
import { Bell, Battery, Gauge, WifiOff, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const INITIAL_VISIBLE = 10;

interface AlertListProps {
  notifications: AlertNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead?: () => void;
}

const typeIcons: Record<string, typeof Bell> = {
  battery: Battery,
  pressure: Gauge,
  offline: WifiOff,
  stress: AlertTriangle,
};

function statusPill(n: AlertNotification) {
  if (n.read) {
    return (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
        Resolved
      </span>
    );
  }
  if (n.type === "pressure" || n.type === "stress") {
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
        Critical
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
      Pending
    </span>
  );
}

export function AlertList({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: AlertListProps) {
  const [expanded, setExpanded] = useState(false);

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);
  const sorted = [...unread, ...read];

  const visible = expanded ? sorted : sorted.slice(0, INITIAL_VISIBLE);
  const hiddenCount = sorted.length - INITIAL_VISIBLE;

  return (
    <div className="rounded-xl bg-surface-low p-6 ring-1 ring-border/10 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-headline text-xl font-semibold">Live Alert Log</h3>
        {unread.length > 1 && onMarkAllAsRead && (
          <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-primary tracking-widest" onClick={onMarkAllAsRead}>
            Mark All Read
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">No alerts.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg ring-1 ring-border/10 flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-highest text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-surface-lowest">
                {visible.map((n, i) => {
                  const Icon = typeIcons[n.type] ?? Bell;
                  return (
                    <tr
                      key={n.id}
                      className={cn(
                        "hover:bg-surface-low transition-colors",
                        i % 2 === 1 && "bg-surface-low/50"
                      )}
                    >
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-medium">
                        {new Date(n.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-bold">{n.message}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{statusPill(n)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {!n.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-primary"
                            onClick={() => onMarkAsRead(n.id)}
                          >
                            Read
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              <ChevronDown className={cn("mr-1.5 h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              {expanded ? "Show less" : `Show ${hiddenCount} more alert${hiddenCount > 1 ? "s" : ""}`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
