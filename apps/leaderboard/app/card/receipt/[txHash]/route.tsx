import { ImageResponse } from "@vercel/og";

export const runtime = "nodejs";

const PAPER = "#f4efe3";
const INK = "#15120b";
const GOLD = "#9c6b1f";
const RULE = "#b9ab8d";
const MUTED = "#6c6354";
const GREEN = "#2f6248";

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
          background: PAPER,
          color: INK,
          padding: "60px 64px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "20px", letterSpacing: "5px", color: GOLD, textTransform: "uppercase" }}>
          <span>The Pharos Ledger</span>
          <span style={{ color: MUTED }}>Receipt</span>
        </div>
        <div style={{ height: "6px", borderTop: `3px double ${RULE}`, borderBottom: `1px solid ${RULE}`, margin: "18px 0 40px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "20px" }}>
          <div style={{ fontSize: "44px", color: GREEN, fontWeight: 700 }}>Payment settled</div>
          <div style={{ fontSize: "26px", color: MUTED }}>x402 · gasless EIP-3009 settlement on Pharos</div>
          <div style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.5px" }}>{shortTx}</div>
        </div>

        <div style={{ fontSize: "22px", color: MUTED, marginTop: "auto", letterSpacing: "1px", borderTop: `1px solid ${RULE}`, paddingTop: "24px" }}>
          Verify on testnet.pharosscan.xyz · a wallet and a reputation for agents on Pharos
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
