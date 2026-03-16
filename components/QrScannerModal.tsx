"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Extrait un ID d'usine (8 caractères hex) du contenu du QR (ex. MAC complète ou 8 hex). */
export function parseFactoryIdFromQr(content: string): string | null {
  const s = content.trim().replace(/[:-]/g, "").toUpperCase();
  if (/^[0-9A-F]{8}$/.test(s)) return s;
  if (/^[0-9A-F]{12}$/.test(s)) return s.slice(-8);
  if (/^[0-9A-F]{6,}$/.test(s)) return s.slice(0, 8);
  return null;
}

interface QrScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (factoryId: string) => void;
}

export function QrScannerModal({ open, onOpenChange, onScan }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<import("qr-scanner").QrScanner | null>(null);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    let mounted = true;
    const video = videoRef.current;

    import("qr-scanner")
      .then(({ QrScanner }) => {
        if (!mounted || !open || !video) return;
        const scanner = new QrScanner(
          video,
          (result) => {
            const id = parseFactoryIdFromQr(result.data);
            if (id) {
              stopScanner();
              onScan(id);
              onOpenChange(false);
            }
          },
          { returnDetailedScanResult: false }
        );
        scannerRef.current = scanner;
        scanner.start();
      })
      .catch(() => {
        stopScanner();
      });

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [open, onScan, onOpenChange, stopScanner]);

  useEffect(() => {
    if (!open) stopScanner();
  }, [open, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scanner le QR code</DialogTitle>
          <DialogDescription>
            Cadrez le QR code imprimé sur le module (ID d&apos;usine, 8 caractères hex).
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square max-w-sm mx-auto overflow-hidden rounded-md border border-border bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
