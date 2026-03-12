"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const KPI_TOOLTIPS = {
  irrigationAujourdhui:
    "Volume d'eau apportée par la pompe aujourd'hui. Donnée du jour, mise à jour en continu par les capteurs.",
  volumeIrrigation:
    "Somme de l'eau apportée par la pompe sur toute la période sélectionnée (7 j, 30 j ou saison). Historique.",
  pluviometrie:
    "Somme des précipitations (pluie naturelle) sur la période. Données issues de la météo. Historique.",
  tensionMoyenne:
    "Moyenne du stress hydrique du sol (tensiomètre, en centibars). Plus la valeur est basse, plus le sol est humide. Historique.",
  bilanHydrique:
    "Écart (Pluie − Évapotranspiration potentielle) sur la période. Indicateur du besoin en eau de la culture. Historique.",
} as const;

export interface ZoneHistoryKPIsProps {
  /** Volume d'irrigation sur la période (m³ ou minutes selon unit) */
  volumeIrrigation: number;
  irrigationUnit: "m3" | "min";
  /** Pluviométrie totale (mm) */
  pluviometrieMm: number;
  /** Tension moyenne du sol (cb) ou null si indisponible */
  tensionMoyenne: number | null;
  /** Tendance par rapport à la période précédente */
  tensionTrend?: "up" | "down" | null;
  /** Bilan hydrique (Pluie + Irrigation - ETp) en mm */
  bilanHydrique: number | null;
  /** Irrigation du jour (affiche une carte dédiée pour l'agriculteur) */
  irrigationAujourdhui?: { value: number; unit: "m3" | "min" } | null;
}

function KpiCard({
  title,
  tooltip,
  children,
  className,
  isToday,
}: {
  title: string;
  tooltip: string;
  children: React.ReactNode;
  className?: string;
  isToday?: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <Card
      className={`relative ${className ?? ""}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs font-medium">{title}</span>
          {isToday !== undefined && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isToday ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
            >
              {isToday ? "Du jour" : "Période"}
            </span>
          )}
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-muted/50 text-muted-foreground cursor-help select-none"
            aria-label="Explication"
          >
            <HelpCircle className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </div>
        <div className="mt-1">{children}</div>
        {showTooltip && (
          <div
            className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border bg-background px-3 py-2.5 text-sm text-foreground shadow-lg"
            role="tooltip"
          >
            <p className="leading-snug">{tooltip}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ZoneHistoryKPIs({
  volumeIrrigation,
  irrigationUnit,
  pluviometrieMm,
  tensionMoyenne,
  tensionTrend,
  bilanHydrique,
  irrigationAujourdhui,
}: ZoneHistoryKPIsProps) {
  const formatVolume = (v: number, unit: "m3" | "min" = irrigationUnit) =>
    unit === "m3" ? `${v.toFixed(2)} m³` : `${Math.round(v)} min`;

  return (
    <div className="space-y-4">
      {irrigationAujourdhui != null && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Données du jour</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Irrigation aujourd'hui"
              tooltip={KPI_TOOLTIPS.irrigationAujourdhui}
              isToday={true}
              className="border-primary/20 bg-primary/5"
            >
              <p className="text-lg font-semibold">
                {formatVolume(irrigationAujourdhui.value, irrigationAujourdhui.unit)}
              </p>
            </KpiCard>
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Synthèse sur la période</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Volume d'irrigation"
            tooltip={KPI_TOOLTIPS.volumeIrrigation}
            isToday={false}
          >
            <p className="text-lg font-semibold">{formatVolume(volumeIrrigation)}</p>
          </KpiCard>
          <KpiCard
            title="Pluviométrie totale"
            tooltip={KPI_TOOLTIPS.pluviometrie}
            isToday={false}
          >
            <p className="text-lg font-semibold">{pluviometrieMm.toFixed(1)} mm</p>
          </KpiCard>
          <KpiCard
            title="Tension moyenne"
            tooltip={KPI_TOOLTIPS.tensionMoyenne}
            isToday={false}
          >
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">
                {tensionMoyenne != null ? `${tensionMoyenne.toFixed(0)} cb` : "—"}
              </p>
              {tensionTrend === "up" && (
                <span className="text-xs text-amber-600" title="Hausse">↑</span>
              )}
              {tensionTrend === "down" && (
                <span className="text-xs text-emerald-600" title="Baisse">↓</span>
              )}
            </div>
          </KpiCard>
          <KpiCard
            title="Bilan hydrique"
            tooltip={KPI_TOOLTIPS.bilanHydrique}
            isToday={false}
          >
            <p className="text-lg font-semibold">
              {bilanHydrique != null ? `${bilanHydrique.toFixed(1)} mm` : "—"}
            </p>
          </KpiCard>
        </div>
      </div>
    </div>
  );
}
