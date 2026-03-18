"use client";

import dynamic from "next/dynamic";
import { Fragment } from "react";
import type { Zone } from "@/types";
import type { Module } from "@/types";
import { useMapIcons } from "./MapIcons";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Polygon = dynamic(
  () => import("react-leaflet").then((m) => m.Polygon),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);
const MapClickHandler = dynamic(
  () => import("./MapClickHandler").then((m) => m.MapClickHandler),
  { ssr: false }
);
const DraftPointMarkers = dynamic(
  () => import("./DraftPointMarkers").then((m) => m.DraftPointMarkers),
  { ssr: false }
);

const DEFAULT_CENTER: [number, number] = [46.603354, 1.888334];
const DEFAULT_ZOOM = 6;

interface MapViewProps {
  zones: Zone[];
  fieldModules: Module[];
  pumpModules?: Module[];
  center?: [number, number];
  zoom?: number;
  className?: string;
  selectedZoneId?: string | null;
  onZoneSelect?: (
    zoneId: string,
    at?: { lat: number; lng: number }
  ) => void;
  selectedSectorId?: string | null;
  onSectorSelect?: (
    zoneId: string,
    sectorId: string,
    at?: { lat: number; lng: number }
  ) => void;
  onMapClick?: (lat: number, lng: number) => void;
  draftLatLngs?: [number, number][];
  onDraftPointMove?: (index: number, lat: number, lng: number) => void;
  onDraftPointRemove?: (index: number) => void;
  zoneStyles?: Record<
    string,
    {
      color?: string;
      fillColor?: string;
      fillOpacity?: number;
      weight?: number;
      dashArray?: string;
    }
  >;
  onZoneLongPress?: (zoneId: string) => void;
  enablePopups?: boolean;
  pumpStatesByModuleId?: Record<
    string,
    { pumpOn: boolean; valveOpen: boolean; valveAOpen?: boolean; valveBOpen?: boolean }
  >;
  flowLinks?: Array<{
    from: [number, number];
    to: [number, number];
    active?: boolean;
    label?: string;
  }>;
}

function latLngsFromPolygon(
  polygon: Zone["polygon"]
): [number, number][] | null {
  if (!polygon?.coordinates?.[0]?.length) return null;
  return polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

export function MapView({
  zones,
  fieldModules,
  pumpModules = [],
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = "",
  selectedZoneId,
  onZoneSelect,
  selectedSectorId,
  onSectorSelect,
  onMapClick,
  draftLatLngs = [],
  onDraftPointMove,
  onDraftPointRemove,
  zoneStyles,
  onZoneLongPress,
  enablePopups = true,
  pumpStatesByModuleId = {},
  flowLinks = [],
}: MapViewProps) {
  const { champIcon, pumpOffIcon, pumpOnIcon, pumpSemiIcon } = useMapIcons();

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={4}
        maxZoom={19}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1}
        className="h-full w-full rounded-lg z-0"
        scrollWheelZoom
      >
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zones.map((zone) => {
          const latlngs = latLngsFromPolygon(zone.polygon);
          const sectors = Array.isArray(zone.sectors) ? zone.sectors : [];
          const isSelected = selectedZoneId != null && zone.id === selectedZoneId;
          let longPressTimer: ReturnType<typeof setTimeout> | null = null;
          const beginLongPress = () => {
            if (!onZoneLongPress) return;
            longPressTimer = setTimeout(() => {
              onZoneLongPress(zone.id);
              longPressTimer = null;
            }, 700);
          };
          const cancelLongPress = () => {
            if (longPressTimer) {
              clearTimeout(longPressTimer);
              longPressTimer = null;
            }
          };
          const baseZoneStyle = {
            color: isSelected ? "#ef4444" : "hsl(var(--primary))",
            weight: isSelected ? 3 : 2,
            fillOpacity: isSelected ? 0.15 : 0.08,
          };
          const customZoneStyle = zoneStyles?.[zone.id];
          return (
            <Fragment key={zone.id}>
              {latlngs && latlngs.length >= 3 ? (
                <Polygon
                  positions={latlngs}
                  eventHandlers={{
                    ...(onZoneSelect
                      ? {
                          click: (e: { latlng?: { lat: number; lng: number } }) =>
                            onZoneSelect(
                              zone.id,
                              e?.latlng ? { lat: e.latlng.lat, lng: e.latlng.lng } : undefined
                            ),
                        }
                      : {}),
                    ...(onZoneLongPress
                      ? {
                          mousedown: beginLongPress,
                          touchstart: beginLongPress,
                          mouseup: cancelLongPress,
                          touchend: cancelLongPress,
                          mouseout: cancelLongPress,
                          touchcancel: cancelLongPress,
                        }
                      : {}),
                  }}
                  pathOptions={{ ...baseZoneStyle, ...(customZoneStyle ?? {}) }}
                >
                  {enablePopups ? <Popup>{zone.name}</Popup> : null}
                </Polygon>
              ) : null}
              {sectors.map((sector) => {
                const sectorLatLngs = latLngsFromPolygon(sector.polygon);
                if (!sectorLatLngs || sectorLatLngs.length < 3) return null;
                const isSectorSelected = selectedSectorId != null && selectedSectorId === sector.id;
                return (
                  <Polygon
                    key={`${zone.id}-${sector.id}`}
                    positions={sectorLatLngs}
                    eventHandlers={
                      onSectorSelect
                        ? {
                            click: (e: { latlng?: { lat: number; lng: number } }) =>
                              onSectorSelect(
                                zone.id,
                                sector.id,
                                e?.latlng
                                  ? { lat: e.latlng.lat, lng: e.latlng.lng }
                                  : undefined
                              ),
                          }
                        : undefined
                    }
                    pathOptions={{
                      color: isSectorSelected ? "#f97316" : "#0ea5e9",
                      weight: isSectorSelected ? 3 : 2,
                      fillOpacity: isSectorSelected ? 0.3 : 0.18,
                      dashArray: isSectorSelected ? undefined : "6,6",
                    }}
                  >
                    {enablePopups ? <Popup>{sector.name}</Popup> : null}
                  </Polygon>
                );
              })}
            </Fragment>
          );
        })}
        {draftLatLngs.length >= 2 && (
          <Polygon
            positions={draftLatLngs}
            pathOptions={{
              color: "hsl(var(--primary))",
              weight: 2,
              fillOpacity: 0.3,
              dashArray: "5, 10",
            }}
          />
        )}
        {flowLinks.map((link, idx) => (
          <Polyline
            key={`flow-${idx}`}
            positions={[link.from, link.to]}
            pathOptions={{
              color: link.active ? "#2563eb" : "#94a3b8",
              weight: 3,
              opacity: link.active ? 0.85 : 0.45,
              dashArray: link.active ? undefined : "6,4",
            }}
          />
        ))}
        <DraftPointMarkers
          draftLatLngs={draftLatLngs}
          onDraftPointMove={onDraftPointMove}
          onDraftPointRemove={onDraftPointRemove}
        />
        {champIcon &&
          fieldModules
            .filter((m) => m.position?.lat != null && m.position?.lng != null)
            .map((m) => (
              <Marker
                key={m.id}
                position={[m.position!.lat, m.position!.lng]}
                icon={champIcon}
              >
                <Popup>
                  <span className="font-medium">{m.id}</span>
                  <br />
                  Module Champ {m.online ? "(en ligne)" : "(hors ligne)"}
                </Popup>
              </Marker>
            ))}
        {pumpModules
          .filter((m) => m.position?.lat != null && m.position?.lng != null)
          .map((m) => {
            const st = pumpStatesByModuleId[m.id];
            const a = st?.valveAOpen ?? st?.valveOpen ?? false;
            const b = st?.valveBOpen ?? st?.valveOpen ?? false;
            const activeCount = Number(!!a) + Number(!!b);
            const icon =
              st?.pumpOn && activeCount === 2
                ? pumpOnIcon
                : st?.pumpOn && activeCount === 1
                  ? pumpSemiIcon
                  : pumpOffIcon;
            return (
              <Marker
                key={`pump-${m.id}`}
                position={[m.position!.lat, m.position!.lng]}
                icon={icon ?? undefined}
              >
                <Popup>
                  <span className="font-medium">{m.name || m.id}</span>
                  <br />
                  Pompe {st?.pumpOn ? "(en marche)" : "(arret)"} - Vanne A {a ? "ON" : "OFF"} / Vanne B{" "}
                  {b ? "ON" : "OFF"}
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}
