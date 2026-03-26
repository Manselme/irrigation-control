"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopAppBar } from "@/components/layout/TopAppBar";
import { useAlertConfig } from "@/lib/hooks/useAlerts";
import { useModules } from "@/lib/hooks/useModules";
import { AutoPumpStopOnLowPressure } from "@/components/Safety/AutoPumpStopOnLowPressure";

const FULL_CANVAS_ROUTES = ["/irrigation"];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { config } = useAlertConfig(user?.uid);
  const { modules } = useModules(user?.uid, {
    offlineThresholdMinutes: config?.offlineMinutesThreshold ?? 5,
  });

  const isFullCanvas = FULL_CANVAS_ROUTES.some((r) => pathname?.startsWith(r));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface">
      <OfflineBanner />
      <AutoPumpStopOnLowPressure userId={user.uid} config={config} modules={modules} />
      <Sidebar />
      <TopAppBar />
      {isFullCanvas ? (
        <main className="pt-16 lg:pl-64 h-screen w-full relative overflow-hidden bg-surface-low">
          {children}
        </main>
      ) : (
        <main className="lg:ml-64 pt-20 px-6 pb-20 lg:pb-12 min-h-screen max-w-[1600px] mx-auto">
          {children}
        </main>
      )}
    </div>
  );
}
