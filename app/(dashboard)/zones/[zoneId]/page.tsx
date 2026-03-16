"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useZones } from "@/lib/hooks/useZones";
import { useModules } from "@/lib/hooks/useModules";
import { ZoneHistoryDetail } from "@/components/Zones/ZoneHistoryDetail";
import { Button } from "@/components/ui/button";

export default function ZoneHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const zoneId = params.zoneId as string;
  const { user } = useAuth();
  const { zones } = useZones(user?.uid, null);
  const { modules } = useModules(user?.uid);
  const zone = useMemo(() => zones.find((z) => z.id === zoneId), [zones, zoneId]);
  const pumpModule = useMemo(
    () => (zone?.pumpModuleId ? modules.find((m) => m.id === zone.pumpModuleId) ?? null : null),
    [zone?.pumpModuleId, modules]
  );

  useEffect(() => {
    if (zones.length > 0 && zone) {
      router.replace(`/history?zone=${zoneId}`);
    }
  }, [zones, zone, zoneId, router]);

  if (!user) return null;
  if (zones.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Chargement des zones…</p>
      </div>
    );
  }
  if (!zone) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Zone introuvable.</p>
        <Button variant="outline" asChild>
          <Link href="/history">Retour à l&apos;historique</Link>
        </Button>
      </div>
    );
  }

  return (
    <ZoneHistoryDetail
      zone={zone}
      pumpModule={pumpModule}
      showBackLink={true}
      showZoneTitle={true}
    />
  );
}
