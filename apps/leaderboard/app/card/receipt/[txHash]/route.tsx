import { ImageResponse } from "@vercel/og";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { txHash: string } }) {
  const tx = params.txHash;
  const shortTx = `${tx.slice(0, 10)}…${tx.slice(-8)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b1428 0%, #070b16 60%)",
          color: "#e6edf7",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "linear-gradient(135deg,#22d3ee,#6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              fontWeight: 800,
              color: "#04121a",
            }}
          >
            P
          </div>
          <div style={{ fontSize: "40px", fontWeight: 800 }}>PharosPay</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ fontSize: "30px", color: "#22d3ee" }}>✓ Payment settled on Pharos</div>
          <div style={{ fontSize: "30px", color: "#7d8aa3" }}>x402 · gasless EIP-3009 settlement</div>
          <div style={{ fontSize: "40px", fontWeight: 700, fontFamily: "monospace" }}>{shortTx}</div>
        </div>

        <div style={{ fontSize: "24px", color: "#7d8aa3" }}>
          Verify on testnet.pharosscan.xyz. A wallet and a reputation for agents on Pharos.
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
