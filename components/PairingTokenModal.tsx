"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createPairingToken } from "@/lib/pairingToken";

interface PairingTokenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  motherModuleId: string;
  moduleName?: string;
}

export function PairingTokenModal({
  open,
  onOpenChange,
  userId,
  motherModuleId,
  moduleName,
}: PairingTokenModalProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setError("");
    setLoading(true);
    try {
      const { token: t } = await createPairingToken(userId, motherModuleId);
      setToken(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la génération.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (token && navigator.clipboard) {
      navigator.clipboard.writeText(token);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) setToken(null);
    setError("");
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Token d&apos;appairage</DialogTitle>
          <DialogDescription>
            {moduleName
              ? `Générez un token pour le module Mère « ${moduleName} ». Entrez ce token dans le portail WiFi AgriFlow-Setup. Valide environ 15 minutes.`
              : "Générez un token à entrer dans le portail du Module Mère (WiFi AgriFlow-Setup). Valide environ 15 minutes."}
          </DialogDescription>
        </DialogHeader>
        {!token ? (
          <div className="space-y-4">
            <Button onClick={handleGenerate} disabled={loading} className="w-full">
              {loading ? "Génération…" : "Générer un token"}
            </Button>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/50 p-3 font-mono text-sm break-all">
              {token}
            </div>
            <Button variant="outline" onClick={handleCopy} className="w-full">
              Copier le token
            </Button>
            <p className="text-xs text-muted-foreground">
              Connectez-vous au WiFi « AgriFlow-Setup », ouvrez la page de configuration et collez ce token.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
