"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ManualControlsPanelProps {
  stressValue: number;
  setStressValue: (n: number) => void;
  onApplyStress: () => Promise<void> | void;
  onGatewayOutage: () => Promise<void> | void;
  onLowBattery: () => Promise<void> | void;
  onQuota90: () => Promise<void> | void;
  forceAckTimeout: boolean;
  onToggleAckTimeout: (value: boolean) => void;
}

export function ManualControlsPanel({
  stressValue,
  setStressValue,
  onApplyStress,
  onGatewayOutage,
  onLowBattery,
  onQuota90,
  forceAckTimeout,
  onToggleAckTimeout,
}: ManualControlsPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stress hydrique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Tension cible (cb)</Label>
            <Input
              type="number"
              min={0}
              max={200}
              value={stressValue}
              onChange={(e) => setStressValue(Number(e.target.value) || 0)}
            />
          </div>
          <Button onClick={() => onApplyStress()} className="w-full">
            Appliquer stress top 3
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">État matériel/réseau</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" onClick={() => onGatewayOutage()} className="w-full">
            Simuler panne passerelle
          </Button>
          <Button variant="outline" onClick={() => onLowBattery()} className="w-full">
            Simuler batteries faibles
          </Button>
          <Button variant="outline" onClick={() => onQuota90()} className="w-full">
            Simuler quota &gt;= 90%
          </Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Commandes & ACK</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Timeout ACK forcé (les commandes restent pending)
          </p>
          <Button
            variant={forceAckTimeout ? "destructive" : "outline"}
            onClick={() => onToggleAckTimeout(!forceAckTimeout)}
          >
            {forceAckTimeout ? "Désactiver" : "Activer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

