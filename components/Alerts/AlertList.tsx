"use client";

import type { AlertNotification } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Battery, Gauge, WifiOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertListProps {
  notifications: AlertNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead?: () => void;
}

const typeIcons = {
  battery: Battery,
  pressure: Gauge,
  offline: WifiOff,
  stress: AlertTriangle,
};

export function AlertList({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: AlertListProps) {
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notifications
          {unread.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({unread.length} non lues)
            </span>
          )}
        </CardTitle>
        {unread.length > 1 && onMarkAllAsRead ? (
          <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
            Tout marquer lu
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune alerte.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...unread, ...read].map((n) => {
              const Icon = typeIcons[n.type] ?? Bell;
              return (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3 text-sm",
                    n.read ? "border-border bg-muted/30" : "border-amber-500/30 bg-amber-50/30"
                  )}
                >
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p>{n.message}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {new Date(n.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMarkAsRead(n.id)}
                    >
                      Marquer lu
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
