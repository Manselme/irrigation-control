"use client";

interface HealthBarBadgesProps {
  networkIncidents: number;
  dryZonesCount: number;
  weeklyVolumeM3: number;
}

export function HealthBarBadges({
  networkIncidents,
  dryZonesCount,
  weeklyVolumeM3,
}: HealthBarBadgesProps) {
  return (
    <div className="mb-4 grid gap-2 md:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        {networkIncidents === 0
          ? "📡 Système en ligne"
          : `⚠️ ${networkIncidents} incident${networkIncidents > 1 ? "s" : ""} matériel`}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        {dryZonesCount === 0
          ? "🌱 Humidité globale : Optimale"
          : `🔴 ${dryZonesCount} zone${dryZonesCount > 1 ? "s" : ""} sèche${dryZonesCount > 1 ? "s" : ""}`}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
        💧 {weeklyVolumeM3.toFixed(1)}m³ utilisés cette semaine
      </div>
    </div>
  );
}

