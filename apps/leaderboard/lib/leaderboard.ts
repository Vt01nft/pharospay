import { createPublicClient, http, formatUnits, type Chain } from "viem";
import { chainById, ledgerAbi, getAddresses, type Hex } from "./pharos";

export interface AgentRow {
  address: Hex;
  txCount: number;
  totalPaid: string;
  totalEarned: string;
  streak: number;
  repScore: number;
}

export interface Settlement {
  payer: Hex;
  payee: Hex;
  amount: string;
  ts: number;
}

const paymentSettledEvent = ledgerAbi.find(
  (x) => x.type === "event" && (x as { name?: string }).name === "PaymentSettled",
) as never;

function makeClient() {
  const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688689");
  const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com";
  const base = chainById(chainId);
  const chain: Chain = { ...base, rpcUrls: { default: { http: [rpcUrl] } } };
  return { client: createPublicClient({ chain, transport: http(rpcUrl) }), ledger: getAddresses(chainId).ledger };
}

// The Pharos RPC caps eth_getLogs to a small block range, so we scan a bounded recent
// window in small parallel chunks, and always read known seed addresses directly.
const CHUNK = 800n;
const WINDOW = 9000n;
const MAX_CHUNKS = 14;

export async function fetchLedger(): Promise<{ agents: AgentRow[]; settlements: Settlement[] }> {
  try {
    const { client, ledger } = makeClient();
    const latest = await client.getBlockNumber();
    const envFrom = process.env.LEADERBOARD_FROM_BLOCK ? BigInt(process.env.LEADERBOARD_FROM_BLOCK) : 0n;
    let from = envFrom > latest - WINDOW ? envFrom : latest - WINDOW;
    if (from < 0n) from = 0n;

    const ranges: [bigint, bigint][] = [];
    for (let s = from; s <= latest && ranges.length < MAX_CHUNKS; s += CHUNK) {
      ranges.push([s, s + CHUNK - 1n > latest ? latest : s + CHUNK - 1n]);
    }

    const addrs = new Set<Hex>();
    const settlements: Settlement[] = [];
    const results = await Promise.allSettled(
      ranges.map(([s, e]) => client.getLogs({ address: ledger, event: paymentSettledEvent, fromBlock: s, toBlock: e })),
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const l of r.value) {
        const a = (l as { args: { payer: Hex; payee: Hex; amount: bigint; ts: bigint } }).args;
        addrs.add(a.payer);
        addrs.add(a.payee);
        settlements.push({ payer: a.payer, payee: a.payee, amount: a.amount.toString(), ts: Number(a.ts) });
      }
    }

    // always include known participants so the ledger is never falsely empty
    for (const seed of (process.env.SEED_ADDRESSES ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
      addrs.add(seed as Hex);
    }

    const agents = await Promise.all(
      [...addrs].map(async (address) => {
        const st = (await client.readContract({
          address: ledger,
          abi: ledgerAbi,
          functionName: "stats",
          args: [address],
        })) as readonly bigint[];
        return {
          address,
          txCount: Number(st[0]),
          totalPaid: st[1].toString(),
          totalEarned: st[2].toString(),
          streak: Number(st[4]),
          repScore: Number(st[5]),
        };
      }),
    );

    settlements.reverse();
    return { agents, settlements: settlements.slice(0, 14) };
  } catch {
    return { agents: [], settlements: [] };
  }
}

const byBig = (k: "totalPaid" | "totalEarned") => (a: AgentRow, b: AgentRow) =>
  BigInt(b[k]) > BigInt(a[k]) ? 1 : BigInt(b[k]) < BigInt(a[k]) ? -1 : 0;

export function rank(rows: AgentRow[]) {
  return {
    payers: [...rows].filter((r) => r.txCount > 0).sort(byBig("totalPaid")).slice(0, 20),
    earners: [...rows].filter((r) => BigInt(r.totalEarned) > 0n).sort(byBig("totalEarned")).slice(0, 20),
    streaks: [...rows].sort((a, b) => b.streak - a.streak || b.repScore - a.repScore).slice(0, 20),
  };
}

export function totals(rows: AgentRow[]) {
  const vol = rows.reduce((s, r) => s + BigInt(r.totalPaid), 0n);
  const tx = rows.reduce((s, r) => s + r.txCount, 0);
  return { volume: formatUnits(vol, 6), tx, agents: rows.length };
}

export function fmtUsd(base: string): string {
  return formatUnits(BigInt(base), 6);
}

export function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
