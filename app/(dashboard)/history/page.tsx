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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historique</h1>
          <p className="text-muted-foreground">
            Historique &amp; analytique par zone : irrigation, pluie, tension du sol, bilan hydrique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {farms.length > 1 && (
            <select
              value={selectedFarmId ?? ""}
              onChange={(e) => {
                setSelectedFarmId(e.target.value || null);
                setSelectedZoneId(null);
              }}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Toutes les fermes</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {zones.length > 0 && (
            <select
              value={selectedZoneId ?? selectedZone?.id ?? ""}
              onChange={(e) => setZone(e.target.value || null)}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {zones.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune zone. Créez une zone et associez des capteurs pour afficher l&apos;historique détaillé.
        </p>
      ) : selectedZone ? (
        <ZoneHistoryDetail
          zone={selectedZone}
          pumpModule={
            selectedZone.pumpModuleId
              ? modules.find((m: Module) => m.id === selectedZone.pumpModuleId) ?? null
              : null
          }
          showBackLink={false}
          showZoneTitle={true}
        />
      ) : null}
    </div>
  );
}
