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

/** Moitié gauche = vanne A (couleur zone), droite = vanne B. */
export function buildPumpSplitMarkerHtml(opts: {
  colorA: string;
  colorB: string;
  size: number;
  pumpOn: boolean;
}): string {
  const { colorA, colorB, size, pumpOn } = opts;
  const ring = pumpOn ? ",0 0 0 3px rgba(37,99,235,0.9)" : "";
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(90deg,${colorA} 0%,${colorA} 50%,${colorB} 50%,${colorB} 100%);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35)${ring};position:relative;">
<span style="position:absolute;left:2px;top:50%;transform:translateY(-50%);font-size:7px;font-weight:800;color:#fff;text-shadow:0 0 2px #000">A</span>
<span style="position:absolute;right:2px;top:50%;transform:translateY(-50%);font-size:7px;font-weight:800;color:#fff;text-shadow:0 0 2px #000">B</span>
</div>`;
}

export function useMapIcons(zoomForDraft?: number) {
  const draftSize = zoomForDraft != null ? pointSizeFromZoom(zoomForDraft) : 12;
  const draftIcon = useCircleIcon("hsl(var(--primary))", draftSize);
  const champIcon = useCircleIcon("#22c55e", 14);
  const pumpOffIcon = useCircleIcon("#94a3b8", 16);
  const pumpOnIcon = useCircleIcon("#2563eb", 16);
  const pumpSemiIcon = useCircleIcon("linear-gradient(90deg,#2563eb 50%,#94a3b8 50%)", 16);
  return { draftIcon, champIcon, pumpOffIcon, pumpOnIcon, pumpSemiIcon };
}
