import { createPublicClient, http, formatUnits, type Chain } from "viem";
import { chainById, ledgerAbi, getAddresses, type Hex } from "@pharospay/shared";

export interface AgentRow {
  address: Hex;
  txCount: number;
  totalPaid: string; // base units
  totalEarned: string; // base units
  streak: number;
  repScore: number;
}

const paymentSettledEvent = ledgerAbi.find(
  (x) => x.type === "event" && (x as { name?: string }).name === "PaymentSettled",
) as never;

function makeClient() {
  const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688688");
  const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://testnet.dplabs-internal.com";
  const base = chainById(chainId);
  const chain: Chain = { ...base, rpcUrls: { default: { http: [rpcUrl] } } };
  return { client: createPublicClient({ chain, transport: http(rpcUrl) }), ledger: getAddresses(chainId).ledger };
}

/** Read all agents that have transacted, with their on-chain reputation. */
export async function fetchAgents(): Promise<AgentRow[]> {
  try {
    const { client, ledger } = makeClient();
    const logs = await client.getLogs({ address: ledger, event: paymentSettledEvent, fromBlock: 0n, toBlock: "latest" });
    const addrs = new Set<Hex>();
    for (const l of logs) {
      const args = (l as { args: { payer: Hex; payee: Hex } }).args;
      addrs.add(args.payer);
      addrs.add(args.payee);
    }
    return await Promise.all(
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
  } catch {
    return [];
  }
}

const byBig = (k: "totalPaid" | "totalEarned") => (a: AgentRow, b: AgentRow) =>
  BigInt(b[k]) > BigInt(a[k]) ? 1 : BigInt(b[k]) < BigInt(a[k]) ? -1 : 0;

export function rank(rows: AgentRow[]) {
  return {
    payers: [...rows].sort(byBig("totalPaid")).slice(0, 25),
    earners: [...rows].sort(byBig("totalEarned")).slice(0, 25),
    streaks: [...rows].sort((a, b) => b.streak - a.streak || b.repScore - a.repScore).slice(0, 25),
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
