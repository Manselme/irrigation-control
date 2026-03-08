import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contrôle d'irrigation intelligent",
  description: "Pilotez et surveillez votre irrigation à distance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="light">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
