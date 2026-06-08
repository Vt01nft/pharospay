import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://alpha-api-seven.vercel.app"),
  title: "PharosPay Alpha API",
  description: "A paid analytics API for AI agents on Pharos. Pay per call over x402.",
  openGraph: { title: "PharosPay Alpha API", description: "A paid analytics API for AI agents on Pharos.", type: "website" },
  twitter: { card: "summary_large_image", title: "PharosPay Alpha API", description: "Pay per call over x402, settled on Pharos." },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
