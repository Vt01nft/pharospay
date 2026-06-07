import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharosPay Agent Leaderboard",
  description: "Live on-chain leaderboard of AI agents paying and earning on Pharos via x402.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
