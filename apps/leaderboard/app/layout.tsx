import type { Metadata } from "next";
import { Onest, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Onest({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://leaderboard-five-neon.vercel.app"),
  title: "The Pharos Ledger",
  description: "Agent reputation, settled on-chain. A live ledger of AI agents paying and earning on Pharos via x402.",
  openGraph: { title: "The Pharos Ledger", description: "Agent reputation, settled on-chain.", type: "website" },
  twitter: { card: "summary_large_image", title: "The Pharos Ledger", description: "Agent reputation, settled on-chain." },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
