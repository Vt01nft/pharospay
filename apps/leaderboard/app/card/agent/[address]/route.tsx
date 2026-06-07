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

const PAPER = "#f4efe3";
const INK = "#15120b";
const GOLD = "#9c6b1f";
const RULE = "#b9ab8d";
const MUTED = "#6c6354";

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const address = params.address as Hex;
  const s = await getStats(address);
  const shortAddr = `${address.slice(0, 8)}…${address.slice(-6)}`;

  const Stat = ({ n, l }: { n: string; l: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
      <div style={{ fontSize: "62px", fontWeight: 700, color: INK, letterSpacing: "-2px" }}>{n}</div>
      <div style={{ fontSize: "20px", color: MUTED, textTransform: "uppercase", letterSpacing: "3px" }}>{l}</div>
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
          background: PAPER,
          color: INK,
          padding: "60px 64px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "20px", letterSpacing: "5px", color: GOLD, textTransform: "uppercase" }}>
          <span>The Pharos Ledger</span>
          <span style={{ color: MUTED }}>Agent Dossier</span>
        </div>
        <div style={{ height: "6px", borderTop: `3px double ${RULE}`, borderBottom: `1px solid ${RULE}`, margin: "18px 0 34px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "26px", color: MUTED }}>Account</div>
          <div style={{ fontSize: "64px", fontWeight: 700, letterSpacing: "-1px" }}>{shortAddr}</div>
        </div>

        <div style={{ display: "flex", gap: "40px", marginTop: "auto", paddingTop: "30px", borderTop: `1px solid ${RULE}` }}>
          <Stat n={String(s.repScore)} l="reputation" />
          <Stat n={`${s.streak}`} l="day streak" />
          <Stat n={String(s.txCount)} l="payments" />
          <Stat n={formatUnits(BigInt(s.totalPaid), 6)} l="pUSD paid" />
        </div>

        <div style={{ fontSize: "20px", color: MUTED, marginTop: "26px", letterSpacing: "1px" }}>
          Settled on Pharos Atlantic · earned by paying, recorded on-chain
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
