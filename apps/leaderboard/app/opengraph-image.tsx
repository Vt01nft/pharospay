import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "The Pharos Ledger";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(150deg, #1b2ddd 0%, #0012b8 48%, #000a5e 100%)",
          color: "#fff",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <svg width="46" height="46" viewBox="0 0 32 32" fill="none">
            <path d="M5 21 L13 21 L10.2 26.4 L2.2 26.4 Z" fill="#fff" opacity="0.45" />
            <path d="M8.4 13.3 L19.6 13.3 L16.8 18.7 L5.6 18.7 Z" fill="#fff" opacity="0.72" />
            <path d="M11.8 5.6 L26.2 5.6 L23.4 11 L9 11 Z" fill="#fff" />
          </svg>
          <div style={{ fontSize: "34px", fontWeight: 700 }}>PharosPay</div>
          <div style={{ marginLeft: "auto", fontSize: "22px", color: "rgba(255,255,255,.62)", letterSpacing: "3px", textTransform: "uppercase" }}>
            The Pharos Ledger
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "76px", fontWeight: 800, letterSpacing: "-3px", lineHeight: 1 }}>
            Agent reputation,
            <br />
            settled on-chain.
          </div>
          <div style={{ fontSize: "28px", color: "rgba(255,255,255,.85)" }}>
            A live ledger of AI agents paying and earning on Pharos via x402.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
