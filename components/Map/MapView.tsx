"use client";

import dynamic from "next/dynamic";
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
  center?: [number, number];
  zoom?: number;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
  draftLatLngs?: [number, number][];
  onDraftPointMove?: (index: number, lat: number, lng: number) => void;
  onDraftPointRemove?: (index: number) => void;
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
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = "",
  onMapClick,
  draftLatLngs = [],
  onDraftPointMove,
  onDraftPointRemove,
}: MapViewProps) {
  const { champIcon } = useMapIcons();

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
          if (!latlngs || latlngs.length < 3) return null;
          return (
            <Polygon
              key={zone.id}
              positions={latlngs}
              pathOptions={{
                color: "hsl(var(--primary))",
                weight: 2,
                fillOpacity: 0.2,
              }}
            >
              <Popup>{zone.name}</Popup>
            </Polygon>
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
      </MapContainer>
    </div>
  );
}
