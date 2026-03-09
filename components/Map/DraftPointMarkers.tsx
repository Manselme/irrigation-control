"use client";

import { useState, useEffect } from "react";
import { useMap, useMapEvents, Marker, Popup } from "react-leaflet";
import { useMapIcons } from "./MapIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PointMenuProps {
  pointIndex: number;
  currentLat: number;
  currentLng: number;
  onRemove?: () => void;
  onSetPosition: (lat: number, lng: number) => void;
}

function PointMenu({
  pointIndex,
  currentLat,
  currentLng,
  onRemove,
  onSetPosition,
}: PointMenuProps) {
  const [showGpsForm, setShowGpsForm] = useState(false);
  const [latStr, setLatStr] = useState(currentLat.toFixed(6));
  const [lngStr, setLngStr] = useState(currentLng.toFixed(6));
  const [error, setError] = useState("");

  useEffect(() => {
    setLatStr(currentLat.toFixed(6));
    setLngStr(currentLng.toFixed(6));
  }, [currentLat, currentLng]);

  const handleApplyGps = () => {
    setError("");
    const lat = parseFloat(latStr.replace(",", "."));
    const lng = parseFloat(lngStr.replace(",", "."));
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      setError("Latitude invalide (-90 à 90)");
      return;
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      setError("Longitude invalide (-180 à 180)");
      return;
    }
    onSetPosition(lat, lng);
    setShowGpsForm(false);
  };

  const stopProp = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  const stopPropKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };
  const stopPropOnly = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (showGpsForm) {
    return (
      <div
        className="min-w-[200px] space-y-2 p-1"
        style={{ pointerEvents: "auto" }}
        onMouseDown={stopProp}
        onClick={stopProp}
        onKeyDown={stopPropKey}
      >
        <div className="text-sm font-medium text-muted-foreground">
          Point #{pointIndex + 1} – Coordonnées GPS
        </div>
        <div className="text-xs text-muted-foreground">
          Actuel : {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Latitude</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={latStr}
            onChange={(e) => setLatStr(e.target.value)}
            placeholder="ex: 46.603354"
            className="h-8 text-sm"
            onMouseDown={stopPropOnly}
            onClick={stopPropOnly}
            onKeyDown={stopPropKey}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Longitude</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={lngStr}
            onChange={(e) => setLngStr(e.target.value)}
            placeholder="ex: 1.888334"
            className="h-8 text-sm"
            onMouseDown={stopPropOnly}
            onClick={stopPropOnly}
            onKeyDown={stopPropKey}
          />
        </div>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <div className="flex gap-1">
          <Button size="sm" className="flex-1" onClick={(e) => { stopProp(e); handleApplyGps(); }}>
            Appliquer
          </Button>
          <Button size="sm" variant="outline" onClick={(e) => { stopProp(e); setShowGpsForm(false); }}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-w-[180px] space-y-2 p-1"
      style={{ pointerEvents: "auto" }}
      onMouseDown={stopProp}
      onClick={stopProp}
      onKeyDown={stopPropKey}
    >
      <p className="text-xs text-muted-foreground">
        Maintenez et glissez le point pour le déplacer.
      </p>
      <p className="text-xs font-medium">
        Coordonnées : {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
      </p>
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-start text-sm"
          onMouseDown={stopProp}
          onClick={(e) => { stopProp(e); setShowGpsForm(true); }}
        >
          Coordonnées GPS…
        </Button>
        {onRemove && (
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-sm text-destructive border-destructive/50 hover:bg-destructive/10"
            onMouseDown={stopProp}
            onClick={(e) => {
              stopProp(e);
              onRemove();
            }}
          >
            Supprimer le point
          </Button>
        )}
      </div>
    </div>
  );
}

interface DraftPointMarkersProps {
  draftLatLngs: [number, number][];
  onDraftPointMove?: (index: number, lat: number, lng: number) => void;
  onDraftPointRemove?: (index: number) => void;
}

export function DraftPointMarkers({
  draftLatLngs,
  onDraftPointMove,
  onDraftPointRemove,
}: DraftPointMarkersProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });
  useEffect(() => {
    setZoom(map.getZoom());
  }, [map]);
  const { draftIcon } = useMapIcons(zoom);

  if (!draftIcon || draftLatLngs.length === 0) return null;

  return (
    <>
      {draftLatLngs.map((pos, i) => (
        <Marker
          key={`draft-${i}-${pos[0]}-${pos[1]}`}
          position={pos}
          icon={draftIcon}
          draggable={!!onDraftPointMove}
          eventHandlers={
            onDraftPointMove
              ? {
                  dragend: (e: {
                    target: { getLatLng: () => { lat: number; lng: number } };
                  }) => {
                    const ll = e.target.getLatLng();
                    onDraftPointMove(i, ll.lat, ll.lng);
                  },
                }
              : undefined
          }
          zIndexOffset={500}
        >
          {(onDraftPointMove || onDraftPointRemove) && (
            <Popup>
              <PointMenu
                pointIndex={i}
                currentLat={pos[0]}
                currentLng={pos[1]}
                onRemove={onDraftPointRemove ? () => onDraftPointRemove(i) : undefined}
                onSetPosition={(lat, lng) => onDraftPointMove?.(i, lat, lng)}
              />
            </Popup>
          )}
        </Marker>
      ))}
    </>
  );
}
