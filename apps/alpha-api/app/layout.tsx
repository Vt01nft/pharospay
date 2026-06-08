import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharosPay Alpha API",
  description: "A paid analytics API for AI agents on Pharos. Pay per call over x402.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
