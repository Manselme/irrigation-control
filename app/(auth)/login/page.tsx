"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Sprout, LogIn } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-surface text-foreground">
      <div className="absolute inset-0 technical-grid z-0" />
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.06] field-pattern-overlay pointer-events-none">
        <div className="h-[120vh] w-[120vh] rounded-full bg-primary/30 blur-3xl" />
      </div>

      <main className="flex-grow flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4 shadow-sm">
              <Sprout className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">
              CeresAnalytics
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1 font-semibold">
              Technical Irrigation Control
            </p>
          </div>

          <div className="rounded-xl p-8 bg-surface-lowest shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-foreground/5">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@ceresanalytics.ag"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-surface-low ring-border/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  System Key
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-surface-low ring-border/10"
                />
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="pt-2 space-y-4">
                <Button type="submit" className="w-full h-12 gap-2" disabled={loading}>
                  <LogIn className="h-4 w-4" />
                  {loading ? "Chargement…" : isSignUp ? "Créer le compte" : "Initialize Login"}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/30" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-semibold tracking-tight">
                    <span className="bg-surface-lowest px-2 text-muted-foreground">
                      Network Access
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="block w-full text-center text-xs font-semibold text-muted-foreground hover:text-primary transition-colors py-2"
                  onClick={() => {
                    setIsSignUp((v) => !v);
                    setError("");
                  }}
                >
                  {isSignUp ? (
                    <>
                      Déjà un compte ?{" "}
                      <span className="text-primary underline underline-offset-4 decoration-1">
                        Se connecter
                      </span>
                    </>
                  ) : (
                    <>
                      New operator?{" "}
                      <span className="text-primary underline underline-offset-4 decoration-1">
                        Create an account
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 text-center px-4">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Accès réservé au personnel autorisé. Les télémétries et les overrides sont journalisés.
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 w-full bg-surface-low/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-30" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                Status: Systems Online
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-medium uppercase text-muted-foreground tracking-tighter">
              v2.0.0
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
