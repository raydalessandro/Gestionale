import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VISTA Gestionale",
  description:
    "Il gestionale dell'ottico indipendente — clienti, prescrizioni, ordini. Il cuore della suite VISTA.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body
        className={`${sora.variable} ${fraunces.variable} ${jetbrains.variable} f-ui antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
