"use client";

import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2",
        "bg-amber-500/95 text-amber-950 py-2 px-4 text-sm font-medium",
        "border-b border-amber-600"
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Hors connexion — Les données à l&apos;écran ne sont plus en temps réel.</span>
    </div>
  );
}
