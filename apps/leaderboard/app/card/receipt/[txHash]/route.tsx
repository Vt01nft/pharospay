import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

const W2 = "rgba(255,255,255,0.62)";

export async function GET(_req: Request, { params }: { params: { txHash: string } }) {
  const tx = params.txHash;
  const shortTx = `${tx.slice(0, 12)}…${tx.slice(-10)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(150deg, #1b2ddd 0%, #0012b8 48%, #000a5e 100%)",
          color: "#fff",
          padding: "58px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <path d="M5 21 L13 21 L10.2 26.4 L2.2 26.4 Z" fill="#fff" opacity="0.45" />
            <path d="M8.4 13.3 L19.6 13.3 L16.8 18.7 L5.6 18.7 Z" fill="#fff" opacity="0.72" />
            <path d="M11.8 5.6 L26.2 5.6 L23.4 11 L9 11 Z" fill="#fff" />
          </svg>
          <div style={{ fontSize: "30px", fontWeight: 700 }}>PharosPay</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "72px" }}>
          <div style={{ fontSize: "26px", color: "#bfe9c9" }}>✓ Payment settled on Pharos</div>
          <div style={{ fontSize: "24px", color: W2 }}>x402 · gasless EIP-3009 settlement</div>
          <div style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-1px" }}>{shortTx}</div>
        </div>

        <div style={{ fontSize: "20px", color: W2, marginTop: "auto", paddingTop: "26px", borderTop: "1px solid rgba(255,255,255,0.18)" }}>
          Verify on testnet.pharosscan.xyz · a wallet and a reputation for agents on Pharos
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
