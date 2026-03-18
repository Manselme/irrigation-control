"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SimulatorScenarioId } from "@/lib/simulator/scenarios";
import type { ScenarioAssertionReport } from "@/lib/simulator/assertions";

interface ScenarioRunnerPanelProps {
  scenarios: Array<{ id: SimulatorScenarioId; title: string; description: string }>;
  runningScenarioId: SimulatorScenarioId | null;
  onRunScenario: (id: SimulatorScenarioId) => Promise<void> | void;
  onRunAll: () => Promise<void> | void;
  reports: ScenarioAssertionReport[];
}

export function ScenarioRunnerPanel({
  scenarios,
  runningScenarioId,
  onRunScenario,
  onRunAll,
  reports,
}: ScenarioRunnerPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Scénarios presets</CardTitle>
          <Button size="sm" onClick={() => onRunAll()} disabled={runningScenarioId !== null}>
            Lancer la suite complète
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{scenario.title}</p>
                <p className="text-xs text-muted-foreground">{scenario.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRunScenario(scenario.id)}
                disabled={runningScenarioId !== null}
              >
                {runningScenarioId === scenario.id ? "En cours..." : "Exécuter"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rapports assertions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun rapport pour le moment.</p>
          ) : (
            reports.map((report, idx) => (
              <div key={`${report.scenarioId}-${idx}`} className="rounded-md border p-3">
                <p className="text-sm font-medium">
                  {report.scenarioId} - {report.passed ? "PASS" : "FAIL"}
                </p>
                <div className="mt-1 space-y-1">
                  {report.checks.map((check) => (
                    <p key={check.key} className="text-xs text-muted-foreground">
                      [{check.ok ? "OK" : "KO"}] {check.key}: {check.details}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

