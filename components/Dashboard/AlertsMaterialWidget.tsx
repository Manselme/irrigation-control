"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AlertNotification } from "@/types";

interface AlertsMaterialWidgetProps {
  notifications: AlertNotification[];
  maxItems?: number;
}

export function AlertsMaterialWidget({
  notifications,
  maxItems = 5,
}: AlertsMaterialWidgetProps) {
  const display = notifications.slice(0, maxItems);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-muted-foreground">
          Alertes & Matériel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {display.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune alerte.</p>
        ) : (
          <ul className="space-y-2">
            {display.map((n) => (
              <li key={n.id} className="text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                {n.message}
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/alerts">Voir tout</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
