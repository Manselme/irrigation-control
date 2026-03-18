"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { useAuth } from "@/lib/hooks/useAuth";
import { getFirebaseDb } from "@/lib/firebase";
import { useLinkedGateways } from "@/lib/hooks/useLinkedGateways";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimulatorTabs, type SimulatorTabId } from "@/components/Simulator/SimulatorTabs";
import { ManualControlsPanel } from "@/components/Simulator/ManualControlsPanel";
import { ScenarioRunnerPanel } from "@/components/Simulator/ScenarioRunnerPanel";
import { useSimulationStore } from "@/lib/simulator/store";
import {
  SIMULATOR_SCENARIOS,
  applyBootstrapFixture,
  createFreshBootstrapFixture,
  runSimulatorScenario,
  type SimulatorScenarioId,
} from "@/lib/simulator/scenarios";
import { runScenarioAssertions, type ScenarioAssertionReport } from "@/lib/simulator/assertions";
import { createSensorPoint, type SimulatorFixtureIds } from "@/lib/simulator/fixtures";

export default function SimulatorPage() {
  const { user } = useAuth();
  const { gateways } = useLinkedGateways(user?.uid);
  const store = useSimulationStore(user?.uid);
  const [activeTab, setActiveTab] = useState<SimulatorTabId>("setup");
  const [liveToken, setLiveToken] = useState("");
  const [stressValue, setStressValue] = useState(85);
  const [fixtureIds, setFixtureIds] = useState<SimulatorFixtureIds | null>(null);
  const [runningScenarioId, setRunningScenarioId] = useState<SimulatorScenarioId | null>(null);
  const [reports, setReports] = useState<ScenarioAssertionReport[]>([]);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledCmdIdRef = useRef<string>("");

  useEffect(() => {
    if (!store.selectedGatewayId && gateways.length > 0) {
      store.setSelectedGatewayId(gateways[0].gatewayId);
    }
  }, [store.selectedGatewayId, gateways]);

  useEffect(() => {
    if (!store.adapter || !store.selectedGatewayId) return;
    const cmdRef = ref(
      getFirebaseDb(),
      store.adapter.resolveGatewayPath(store.selectedGatewayId, "commands/current")
    );
    const unsubscribe = onValue(cmdRef, async (snap) => {
      if (!snap.exists()) return;
      const cmd = snap.val() as { id?: string; status?: string; dest?: string; type?: string };
      if (cmd.status !== "pending" || !cmd.dest || !cmd.type) return;
      if (cmd.id && cmd.id === lastHandledCmdIdRef.current) return;
      if (!cmd.dest.startsWith("POMPE-")) return;
      lastHandledCmdIdRef.current = cmd.id ?? "";
      store.addLog({
        at: Date.now(),
        level: "info",
        message: `Commande détectée: ${cmd.type} sur ${cmd.dest}.`,
      });
      if (store.forceAckTimeout) {
        store.addLog({
          at: Date.now(),
          level: "warn",
          message: "Timeout ACK forcé actif: commande laissée pending.",
        });
        return;
      }
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
      ackTimerRef.current = setTimeout(async () => {
        if (!store.adapter) return;
        const current = (await store.adapter.readGateway<Record<string, unknown>>(
          store.selectedGatewayId,
          `status/${cmd.dest}`
        )) ?? {};
        const currentPump = (current.pumpOn as boolean | undefined) ?? false;
        const currentValve = (current.valveOpen as boolean | undefined) ?? false;
        const next = {
          ...current,
          pumpOn:
            cmd.type === "PUMP_ON" ? true : cmd.type === "PUMP_OFF" ? false : currentPump,
          valveOpen:
            cmd.type === "VALVE_OPEN"
              ? true
              : cmd.type === "VALVE_CLOSE"
                ? false
                : currentValve,
          lastSeen: Date.now(),
          lastSeenTs: Date.now(),
        };
        await store.adapter.writeGateway(store.selectedGatewayId, `status/${cmd.dest}`, next);
        await store.adapter.writeGateway(store.selectedGatewayId, "commands/current", {
          ...cmd,
          status: "confirmed",
          confirmedAt: Date.now(),
        });
      }, store.ackDelaySec * 1000);
    });
    return () => {
      unsubscribe();
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    };
  }, [
    store.adapter,
    store.selectedGatewayId,
    store.ackDelaySec,
    store.forceAckTimeout,
    store.addLog,
  ]);

  const scenarioContext = useMemo(() => {
    if (!store.adapter || !fixtureIds) return null;
    return {
      adapter: store.adapter,
      fixtureIds,
      ackDelaySec: store.ackDelaySec,
      forceAckTimeout: store.forceAckTimeout,
    };
  }, [store.adapter, fixtureIds, store.ackDelaySec, store.forceAckTimeout]);

  const runOneScenario = async (id: SimulatorScenarioId) => {
    if (!scenarioContext) {
      store.addLog({
        at: Date.now(),
        level: "warn",
        message: "Bootstrapez un environnement avant de lancer un scénario.",
      });
      return;
    }
    setRunningScenarioId(id);
    const scenarioResult = await runSimulatorScenario(id, scenarioContext);
    const report = await runScenarioAssertions(
      id,
      scenarioContext.adapter,
      scenarioContext.fixtureIds
    );
    setReports((prev) => [report, ...prev].slice(0, 30));
    store.addLog({
      at: Date.now(),
      level: scenarioResult.success && report.passed ? "info" : "error",
      message: `${id}: ${scenarioResult.summary} | assertions: ${report.passed ? "PASS" : "FAIL"}`,
    });
    setRunningScenarioId(null);
  };

  const runAllScenarios = async () => {
    for (const scenario of SIMULATOR_SCENARIOS) {
      // eslint-disable-next-line no-await-in-loop
      await runOneScenario(scenario.id);
    }
  };

  const bootstrap = async () => {
    if (!store.adapter) return;
    const fixture = createFreshBootstrapFixture();
    await applyBootstrapFixture(store.adapter, fixture);
    setFixtureIds(fixture.ids);
    store.setSelectedGatewayId(fixture.ids.gatewayId);
    store.addLog({
      at: Date.now(),
      level: "info",
      message: `Bootstrap terminé (${fixture.ids.gatewayId}).`,
    });
  };

  const applyManualStress = async () => {
    if (!store.adapter || !fixtureIds) return;
    const now = Date.now();
    for (let i = 0; i < fixtureIds.fieldDeviceIds.length; i += 1) {
      const fieldId = fixtureIds.fieldDeviceIds[i];
      const point = createSensorPoint(stressValue - i * 6, 70 - i * 4, now);
      await store.adapter.writeGateway(fixtureIds.gatewayId, `sensors/${fieldId}`, point);
      await store.adapter.writeGateway(
        fixtureIds.gatewayId,
        `sensorsHistory/${fieldId}/${now + i}`,
        point
      );
      await store.adapter.updateGateway(fixtureIds.gatewayId, `status/${fieldId}`, {
        lastSeen: now,
        battery: point.battery,
      });
    }
    store.addLog({
      at: Date.now(),
      level: "info",
      message: "Stress hydrique manuel appliqué.",
    });
  };

  const applyGatewayOutage = async () => runOneScenario("gateway_outage");
  const applyLowBattery = async () => runOneScenario("low_battery_maintenance");
  const applyQuota90 = async () => runOneScenario("quota_90_alert");

  const purgeSandbox = async () => {
    if (!store.adapter) return;
    await store.adapter.clearSandbox();
    setFixtureIds(null);
    setReports([]);
    store.resetWriteCount();
  };

  const modeLabel =
    store.mode === "live"
      ? "LIVE (écritures réelles)"
      : `SANDBOX (${store.sandboxKey})`;

  const scenarioItems = SIMULATOR_SCENARIOS.map((x) => ({
    id: x.id,
    title: x.title,
    description: x.description,
  }));

  const selectedGatewayOptions = useMemo(() => {
    const fromAccount = gateways.map((g) => g.gatewayId);
    const fromFixture = fixtureIds?.gatewayId ? [fixtureIds.gatewayId] : [];
    return Array.from(new Set([...fromAccount, ...fromFixture]));
  }, [gateways, fixtureIds]);

  const writeCountStateClass =
    store.mode === "live" ? "text-amber-300" : "text-slate-300";

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-6rem)] rounded-lg bg-slate-950 p-6 text-slate-100">
        Connectez-vous pour utiliser le simulateur.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] rounded-lg bg-slate-950 text-slate-100 p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Simulator Full Project Twin</h1>
        <p className="text-slate-400 text-sm">
          Sandbox/live switchable, contrôles manuels, scénarios presets et auto-runner avec assertions.
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-700 text-slate-100">
        <CardHeader>
          <CardTitle className="text-base">Sécurité & session</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Mode actif</Label>
            <p className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
              {modeLabel}
            </p>
          </div>
          <div className="space-y-1">
            <Label>Passerelle cible</Label>
            <select
              value={store.selectedGatewayId}
              onChange={(e) => store.setSelectedGatewayId(e.target.value)}
              className="flex h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm"
            >
              <option value="">Sélectionner</option>
              {selectedGatewayOptions.map((gatewayId) => (
                <option key={gatewayId} value={gatewayId}>
                  {gatewayId}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Délai ACK (s)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={store.ackDelaySec}
              onChange={(e) => store.setAckDelaySec(Number(e.target.value) || 1)}
              className="bg-slate-950 border-slate-700"
            />
          </div>
          <div className="space-y-1">
            <Label>Compteur écritures</Label>
            <p className={`rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm ${writeCountStateClass}`}>
              {store.writeCount}
            </p>
          </div>
          <div className="space-y-1 md:col-span-2 lg:col-span-4">
            <Label>Armement mode live (saisir LIVE)</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                value={liveToken}
                onChange={(e) => setLiveToken(e.target.value)}
                placeholder="LIVE"
                className="max-w-[160px] bg-slate-950 border-slate-700"
              />
              <Button variant="outline" onClick={() => store.armLive(liveToken)}>
                Armer live
              </Button>
              <Button
                variant={store.mode === "sandbox" ? "default" : "outline"}
                onClick={() => store.setMode("sandbox")}
              >
                Basculer sandbox
              </Button>
              <Button
                variant={store.mode === "live" ? "destructive" : "outline"}
                onClick={() => store.setMode("live")}
              >
                Basculer live
              </Button>
              <Button variant="outline" onClick={() => store.disarmLive()}>
                Désarmer live
              </Button>
              <Button variant="outline" onClick={() => store.rotateSandbox()}>
                Nouvelle sandbox
              </Button>
              <Button variant="destructive" onClick={purgeSandbox}>
                Purger sandbox
              </Button>
              <Button variant="outline" onClick={() => store.resetWriteCount()}>
                Reset compteur
              </Button>
              <Button variant="outline" onClick={() => store.clearLogs()}>
                Vider logs
              </Button>
            </div>
            {store.mode === "live" ? (
              <p className="text-xs text-amber-300">
                Attention: le mode live écrit directement dans `users/{'{uid}'}` et `gateways/{'{id}'}`.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <SimulatorTabs value={activeTab} onChange={setActiveTab} />

      {activeTab === "setup" && (
        <Card className="bg-slate-900 border-slate-700 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base">Bootstrap environnement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-300">
              Génère un jeu de données cohérent: farm, passerelle, modules, zones, capteurs,
              historique, activité pompe, profil et alertes.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={bootstrap} disabled={!store.adapter}>
                Bootstrap 1-clic
              </Button>
              <Button variant="outline" onClick={() => runOneScenario("normal_operation")}>
                Normal operation
              </Button>
            </div>
            {fixtureIds ? (
              <div className="rounded-md border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
                Gateway: {fixtureIds.gatewayId} | Pump: {fixtureIds.pumpDeviceId} | Fields:{" "}
                {fixtureIds.fieldDeviceIds.join(", ")}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Aucun fixture chargé.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "manual" && (
        <ManualControlsPanel
          stressValue={stressValue}
          setStressValue={setStressValue}
          onApplyStress={applyManualStress}
          onGatewayOutage={applyGatewayOutage}
          onLowBattery={applyLowBattery}
          onQuota90={applyQuota90}
          forceAckTimeout={store.forceAckTimeout}
          onToggleAckTimeout={store.setForceAckTimeout}
        />
      )}

      {activeTab === "scenarios" && (
        <ScenarioRunnerPanel
          scenarios={scenarioItems}
          runningScenarioId={runningScenarioId}
          onRunScenario={runOneScenario}
          onRunAll={runAllScenarios}
          reports={reports}
        />
      )}

      {activeTab === "autorunner" && (
        <Card className="bg-slate-900 border-slate-700 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base">AutoRunner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-300">
              Exécute la suite complète de scénarios + assertions pour couvrir dashboard,
              irrigation, matériel, alertes, historique et profil.
            </p>
            <Button onClick={runAllScenarios} disabled={runningScenarioId !== null}>
              {runningScenarioId ? "Exécution..." : "Lancer AutoRunner"}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "logs" && (
        <Card className="bg-slate-900 border-slate-700 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base">Logs session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {store.logs.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun log pour le moment.</p>
            ) : (
              store.logs.map((log, idx) => (
                <div
                  key={`${log.at}-${idx}`}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                >
                  <p className="text-slate-400">
                    {new Date(log.at).toLocaleTimeString("fr-FR")} - {log.level.toUpperCase()}
                  </p>
                  <p>{log.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

