"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function passwordScore(value: string): number {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { profile, loading, saveProfile, uploadAvatar, changePassword } = useUserProfile(user?.uid);
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
    setDisplayName(profile?.displayName ?? "");
  }, [profile?.firstName, profile?.lastName, profile?.displayName]);

  if (loading) return <p className="text-muted-foreground">Chargement du profil…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres & Compte</h1>
        <p className="text-muted-foreground">Identité, avatar et sécurité.</p>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-4 shadow-sm">
        <h2 className="text-base font-medium">Identité</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Prénom</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Nom affiché</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Email</Label>
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </div>
        </div>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setMessage("");
            try {
              await saveProfile({ firstName, lastName, displayName, email: user?.email ?? "" });
              setMessage("Profil enregistré.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Erreur d'enregistrement.");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Enregistrement…" : "Enregistrer le profil"}
        </Button>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3 shadow-sm">
        <h2 className="text-base font-medium">Avatar (drag & drop / sélection)</h2>
        <div
          className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            setMessage("");
            try {
              await uploadAvatar(file);
              setMessage("Avatar mis à jour.");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Upload avatar impossible.");
            }
          }}
        >
          Glissez une image ici ou sélectionnez un fichier.
          <div className="mt-3">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setMessage("");
                try {
                  await uploadAvatar(file);
                  setMessage("Avatar mis à jour.");
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Upload avatar impossible.");
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3 shadow-sm">
        <h2 className="text-base font-medium">Sécurité</h2>
        <div className="space-y-1">
          <Label>Nouveau mot de passe</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Force: {passwordScore(password)}/4 (8+ chars, majuscule, chiffre, symbole)
          </p>
        </div>
        <Button
          variant="outline"
          disabled={passwordScore(password) < 3}
          onClick={async () => {
            setMessage("");
            try {
              await changePassword(password);
              setPassword("");
              setMessage("Mot de passe mis à jour.");
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Impossible de changer le mot de passe (re-auth possible)."
              );
            }
          }}
        >
          Mettre à jour le mot de passe
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

