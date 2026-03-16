"use client";

import type { Module } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Wifi, WifiOff, Battery, BatteryLow } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<Module["type"], string> = {
  mother: "Module Mère",
  pump: "Module Pompe",
  field: "Module Champ",
};

interface ModuleListProps {
  modules: Module[];
  loading: boolean;
  onRemove: (moduleId: string) => Promise<void>;
  userId?: string;
}

export function ModuleList({
  modules,
  loading,
  onRemove,
}: ModuleListProps) {
  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Chargement des modules…</p>
        </CardContent>
      </Card>
    );
  }

  if (modules.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Aucun module. Ajoutez un module avec le formulaire ci-dessus.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-base">Liste des modules</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium">ID</th>
                <th className="text-left py-2 font-medium">Type</th>
                <th className="text-left py-2 font-medium">État</th>
                <th className="text-left py-2 font-medium">Batterie</th>
                <th className="text-left py-2 font-medium">ID / Passerelle</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.id} className="border-b border-border/50">
                  <td className="py-2 font-mono text-muted-foreground">{m.id}</td>
                  <td className="py-2">{TYPE_LABELS[m.type]}</td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        m.online ? "text-green-600" : "text-muted-foreground"
                      )}
                    >
                      {m.online ? (
                        <>
                          <Wifi className="h-4 w-4" />
                          En ligne
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-4 w-4" />
                          Hors ligne
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-2">
                    {m.battery != null ? (
                      <span
                        className={cn(
                          m.battery < 20 && "text-destructive flex items-center gap-1"
                        )}
                      >
                        {m.battery < 20 && (
                          <BatteryLow className="h-4 w-4 inline" />
                        )}
                        {m.battery}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-muted-foreground text-xs">
                    {m.deviceId ?? m.factoryId ?? "—"}
                    {m.gatewayId && (
                      <span className="block text-muted-foreground/80" title="Passerelle">
                        {m.gatewayId}
                      </span>
                    )}
                  </td>
                  <td className="py-2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(m.id)}
                      aria-label={`Supprimer ${m.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
