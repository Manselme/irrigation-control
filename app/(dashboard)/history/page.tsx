"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFarms } from "@/lib/hooks/useFarms";
import { useZones } from "@/lib/hooks/useZones";
import { useModules } from "@/lib/hooks/useModules";
import { ZoneHistoryDetail } from "@/components/Zones/ZoneHistoryDetail";
import type { Module, Zone } from "@/types";

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const zoneIdFromUrl = searchParams.get("zone");

  const { farms } = useFarms(user?.uid);
  const { modules } = useModules(user?.uid);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const { zones } = useZones(user?.uid, selectedFarmId);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const setZone = useCallback(
    (zoneId: string | null) => {
      setSelectedZoneId(zoneId);
      if (zoneId) {
        router.replace(`${pathname}?zone=${zoneId}`, { scroll: false });
      } else {
        router.replace(pathname, { scroll: false });
      }
    },
    [router, pathname]
  );

  useEffect(() => {
    if (zones.length === 0) return;
    if (zoneIdFromUrl && zones.some((z: Zone) => z.id === zoneIdFromUrl)) {
      setSelectedZoneId(zoneIdFromUrl);
    } else {
      setSelectedZoneId((prev) =>
        prev && zones.some((z: Zone) => z.id === prev) ? prev : zones[0].id
      );
    }
  }, [zoneIdFromUrl, zones]);

  useEffect(() => {
    if (selectedZoneId && zoneIdFromUrl !== selectedZoneId) {
      router.replace(`${pathname}?zone=${selectedZoneId}`, { scroll: false });
    }
  }, [selectedZoneId]);

  const selectedZone = useMemo(
    () => (selectedZoneId ? zones.find((z: Zone) => z.id === selectedZoneId) : zones[0]),
    [zones, selectedZoneId]
  );

  const primaryPumpId =
    selectedZone?.pumpModuleId ?? selectedZone?.pumpModuleIds?.[0] ?? null;
  const historyPumpModule = primaryPumpId
    ? modules.find((m: Module) => m.id === primaryPumpId) ?? null
    : null;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">Analytics Hub</h1>
        <p className="text-xs text-muted-foreground font-medium mt-1">
          Historique &amp; analytique par zone : irrigation, pluie, tension du sol, bilan hydrique.
        </p>
      </div>

      {/* Filter Bar */}
      <section className="flex flex-wrap items-center gap-3">
        {farms.length > 1 && (
          <div className="bg-surface-low px-4 py-2 rounded-lg flex items-center gap-3 ring-1 ring-border/10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Farm</span>
            <select
              value={selectedFarmId ?? ""}
              onChange={(e) => {
                setSelectedFarmId(e.target.value || null);
                setSelectedZoneId(null);
              }}
              className="bg-transparent border-none text-sm font-semibold p-0 focus:ring-0"
            >
              <option value="">Toutes les fermes</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {zones.length > 0 && (
          <div className="bg-surface-low px-4 py-2 rounded-lg flex items-center gap-3 border-l-4 border-primary ring-1 ring-border/10">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Zone</span>
            <select
              value={selectedZoneId ?? selectedZone?.id ?? ""}
              onChange={(e) => setZone(e.target.value || null)}
              className="min-w-0 max-w-full bg-transparent border-none p-0 text-sm font-semibold focus:ring-0"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Content */}
      {zones.length === 0 ? (
        <div className="rounded-xl bg-surface-lowest p-8 ring-1 ring-border/10 text-center">
          <p className="text-muted-foreground">
            Aucune zone. Créez une zone et associez des capteurs pour afficher l&apos;historique détaillé.
          </p>
        </div>
      ) : selectedZone ? (
        <ZoneHistoryDetail
          zone={selectedZone}
          pumpModule={historyPumpModule}
          showBackLink={false}
          showZoneTitle={true}
        />
      ) : null}
    </div>
  );
}
