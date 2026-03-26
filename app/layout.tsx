import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "../globals.css";

export const metadata: Metadata = {
  title: "Contrôle d'irrigation intelligent",
  description: "Pilotez et surveillez votre irrigation à distance",
};

const fontBody = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fontHeadline = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fontBody.variable} ${fontHeadline.variable} light`}>
      <body className="min-h-screen antialiased font-body">{children}</body>
    </html>
  );
}
