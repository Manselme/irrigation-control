"use client";

import { useEffect, useState } from "react";
import type { Icon, DivIcon } from "leaflet";

let L: typeof import("leaflet") | null = null;

function getL(): typeof import("leaflet") {
  if (typeof window === "undefined") throw new Error("Leaflet only on client");
  if (!L) L = require("leaflet");
  if (!L) throw new Error("Leaflet failed to load");
  return L;
}

export function useCircleIcon(color: string, size = 12): Icon | DivIcon | null {
  const [icon, setIcon] = useState<Icon | DivIcon | null>(null);
  useEffect(() => {
    const Leaflet = getL();
    setIcon(
      Leaflet.divIcon({
        className: "custom-marker",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
    );
  }, [color, size]);
  return icon;
}

/** Taille du point de contour selon le zoom (points réduits) */
export function pointSizeFromZoom(zoom: number): number {
  return Math.min(18, Math.max(10, 8 + zoom * 0.8));
}

export function useMapIcons(zoomForDraft?: number) {
  const draftSize = zoomForDraft != null ? pointSizeFromZoom(zoomForDraft) : 12;
  const draftIcon = useCircleIcon("hsl(var(--primary))", draftSize);
  const champIcon = useCircleIcon("#22c55e", 14);
  return { draftIcon, champIcon };
}
