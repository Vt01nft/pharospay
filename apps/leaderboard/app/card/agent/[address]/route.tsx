import { ImageResponse } from "@vercel/og";
import { createPublicClient, http, formatUnits, type Chain } from "viem";
import { chainById, ledgerAbi, getAddresses, type Hex } from "../../../../lib/pharos";

export const runtime = "nodejs";

async function getStats(address: Hex) {
  try {
    const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688689");
    const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com";
    const base = chainById(chainId);
    const chain: Chain = { ...base, rpcUrls: { default: { http: [rpcUrl] } } };
    const client = createPublicClient({ chain, transport: http(rpcUrl) });
    const st = (await client.readContract({
      address: getAddresses(chainId).ledger,
      abi: ledgerAbi,
      functionName: "stats",
      args: [address],
    })) as readonly bigint[];
    return { txCount: Number(st[0]), totalPaid: st[1].toString(), streak: Number(st[4]), repScore: Number(st[5]) };
  } catch {
    return { txCount: 0, totalPaid: "0", streak: 0, repScore: 0 };
  }
}

const W2 = "rgba(255,255,255,0.62)";

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const address = params.address as Hex;
  const s = await getStats(address);
  const shortAddr = `${address.slice(0, 8)}…${address.slice(-6)}`;

  const Stat = ({ n, l }: { n: string; l: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
      <div style={{ fontSize: "60px", fontWeight: 700, color: "#fff", letterSpacing: "-2px" }}>{n}</div>
      <div style={{ fontSize: "19px", color: W2, textTransform: "uppercase", letterSpacing: "2px" }}>{l}</div>
    </div>
  );

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <path d="M5 21 L13 21 L10.2 26.4 L2.2 26.4 Z" fill="#fff" opacity="0.45" />
              <path d="M8.4 13.3 L19.6 13.3 L16.8 18.7 L5.6 18.7 Z" fill="#fff" opacity="0.72" />
              <path d="M11.8 5.6 L26.2 5.6 L23.4 11 L9 11 Z" fill="#fff" />
            </svg>
            <div style={{ fontSize: "30px", fontWeight: 700 }}>PharosPay</div>
          </div>
          <div style={{ fontSize: "20px", color: W2, letterSpacing: "3px", textTransform: "uppercase" }}>Agent Dossier</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "64px" }}>
          <div style={{ fontSize: "24px", color: W2 }}>Account</div>
          <div style={{ fontSize: "66px", fontWeight: 700, letterSpacing: "-2px" }}>{shortAddr}</div>
        </div>

        <div style={{ display: "flex", gap: "36px", marginTop: "auto", paddingTop: "32px", borderTop: "1px solid rgba(255,255,255,0.18)" }}>
          <Stat n={String(s.repScore)} l="reputation" />
          <Stat n={`${s.streak}`} l="day streak" />
          <Stat n={String(s.txCount)} l="payments" />
          <Stat n={formatUnits(BigInt(s.totalPaid), 6)} l="pUSD paid" />
        </div>

        <div style={{ fontSize: "20px", color: W2, marginTop: "24px" }}>
          Reputation earned by paying, settled on Pharos Atlantic over x402
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
