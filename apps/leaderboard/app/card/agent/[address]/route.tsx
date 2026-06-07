import { ImageResponse } from "@vercel/og";
import { createPublicClient, http, formatUnits, type Chain } from "viem";
import { chainById, ledgerAbi, getAddresses, type Hex } from "@pharospay/shared";

export const runtime = "nodejs";

async function getStats(address: Hex) {
  try {
    const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688688");
    const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://testnet.dplabs-internal.com";
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

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const address = params.address as Hex;
  const s = await getStats(address);
  const shortAddr = `${address.slice(0, 8)}…${address.slice(-6)}`;

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
          <div style={{ fontSize: "24px", color: "#22d3ee", marginLeft: "auto" }}>agent economy · Pharos</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "26px", color: "#7d8aa3" }}>Agent</div>
          <div style={{ fontSize: "48px", fontWeight: 700, fontFamily: "monospace" }}>{shortAddr}</div>
        </div>

        <div style={{ display: "flex", gap: "28px" }}>
          {[
            { n: String(s.repScore), l: "reputation" },
            { n: `🔥 ${s.streak}`, l: "day streak" },
            { n: String(s.txCount), l: "payments" },
            { n: `${formatUnits(BigInt(s.totalPaid), 6)}`, l: "pUSD paid" },
          ].map((x) => (
            <div
              key={x.l}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                background: "#0e1626",
                border: "1px solid #1e2c45",
                borderRadius: "16px",
                padding: "24px 32px",
              }}
            >
              <div style={{ fontSize: "44px", fontWeight: 800 }}>{x.n}</div>
              <div style={{ fontSize: "20px", color: "#7d8aa3", textTransform: "uppercase" }}>{x.l}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
