import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCARTO — Ogni mossa lascia un’eco",
  description: "Un’arena. Due giocatori. Ogni scatto torna dopo due secondi.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
