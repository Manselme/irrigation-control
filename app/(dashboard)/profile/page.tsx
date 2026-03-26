"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Upload, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

function passwordScore(value: string): number {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

const strengthLabels = ["Weak", "Fair", "Good", "Secure"];
const strengthColors = ["bg-destructive", "bg-amber-500", "bg-amber-400", "bg-primary"];

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

  const score = passwordScore(password);

  if (loading) return <p className="text-muted-foreground">Chargement du profil…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">Profile Settings</h1>
        <p className="text-xs text-muted-foreground font-medium mt-1">Identité, avatar et sécurité.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Avatar + Identity (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Avatar Section */}
          <div className="bg-surface-low p-8 rounded-xl ring-1 ring-border/10 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div
                className="relative w-32 h-32 md:w-40 md:h-40 rounded-none bg-surface-highest flex-shrink-0 overflow-hidden group cursor-pointer"
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
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt="Profile"
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Upload className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-8 w-8 text-white" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="font-headline text-2xl font-bold tracking-tight mb-2">System Identity</h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Glissez-déposez votre photo ou sélectionnez un fichier. Max 5 Mo.
                </p>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
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
                    <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer rounded-md">
                      <Upload className="h-4 w-4" />
                      Upload New
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Identity Fields */}
          <div className="bg-surface-low p-8 rounded-xl ring-1 ring-border/10">
            <div className="flex items-center gap-2 mb-8">
              <span className="w-8 h-px bg-primary" />
              <h3 className="font-headline text-sm font-bold uppercase tracking-[0.2em]">Personal Parameters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prénom</label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-white ring-1 ring-border/20 border-none focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nom</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-white ring-1 ring-border/20 border-none focus:ring-primary"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nom affiché</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white ring-1 ring-border/20 border-none focus:ring-primary"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email (lecture seule)</label>
                <div className="flex items-center w-full bg-surface-highest py-3 px-4 text-sm text-muted-foreground opacity-70 rounded-md">
                  <Lock className="h-4 w-4 mr-2 shrink-0" />
                  {profile?.email ?? user?.email ?? ""}
                </div>
              </div>
            </div>
            <Button
              className="mt-6 font-bold uppercase tracking-widest text-xs px-8"
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
              {saving ? "Enregistrement…" : "Save System Profile"}
            </Button>
          </div>
        </div>

        {/* Right Column: Security (4 cols) */}
        <div className="lg:col-span-4 space-y-8">
          {/* Password Card */}
          <div className="bg-surface-low p-8 rounded-xl ring-1 ring-border/10">
            <div className="flex items-center gap-2 mb-8">
              <span className="w-8 h-px bg-primary" />
              <h3 className="font-headline text-sm font-bold uppercase tracking-[0.2em]">Security Access</h3>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nouveau mot de passe</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="bg-white ring-1 ring-border/20 border-none focus:ring-primary"
                />
                {password.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <div className="flex gap-1.5 h-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex-1 h-full rounded-full",
                            i < score ? strengthColors[score - 1] : "bg-surface-highest"
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-tighter",
                        score >= 3 ? "text-primary" : score >= 2 ? "text-amber-500" : "text-destructive"
                      )}>
                        Strength: {score > 0 ? strengthLabels[score - 1] : "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{score * 25}%</span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  8+ chars, majuscule, chiffre, symbole
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full py-3 font-bold uppercase tracking-widest text-xs"
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
                Update Credentials
              </Button>
            </div>
          </div>

          {/* Access Level Card */}
          <div className="bg-primary p-6 rounded-xl text-primary-foreground relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-5 w-5 opacity-80" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Access Level</span>
              </div>
              <h4 className="font-headline text-xl font-bold mb-2">Agronomist</h4>
              <p className="text-xs opacity-80 leading-relaxed">
                Full authority over all irrigation sectors. Manual override enabled for critical stress events.
              </p>
            </div>
          </div>
        </div>
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground bg-surface-lowest rounded-lg px-4 py-3 ring-1 ring-border/10">
          {message}
        </p>
      ) : null}
    </div>
  );
}
