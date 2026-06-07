// Self-contained Pharos config + ABI for the leaderboard, so it deploys to Vercel
// without depending on the workspace package.
import { defineChain } from "viem";

export type Hex = `0x${string}`;

export const pharosTestnet = defineChain({
  id: 688689,
  name: "Pharos Atlantic Testnet",
  nativeCurrency: { name: "Pharos", symbol: "PHRS", decimals: 18 },
  rpcUrls: { default: { http: [process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com"] } },
  blockExplorers: { default: { name: "PharosScan", url: "https://testnet.pharosscan.xyz" } },
  testnet: true,
});

export function chainById(id: number) {
  if (id === 688689) return pharosTestnet;
  if (id === 31337) {
    return defineChain({
      id: 31337,
      name: "Anvil",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
    });
  }
  throw new Error(`unsupported chainId ${id}`);
}

export function getAddresses(_chainId: number): { pusd: Hex; ledger: Hex } {
  const pusd = process.env.PUSD_ADDRESS as Hex | undefined;
  const ledger = process.env.LEDGER_ADDRESS as Hex | undefined;
  if (!pusd || !ledger) throw new Error("PUSD_ADDRESS / LEDGER_ADDRESS env not set");
  return { pusd, ledger };
}

export const ledgerAbi = [
  {
    type: "function",
    name: "stats",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [
      { name: "txCount", type: "uint256" },
      { name: "totalPaid", type: "uint256" },
      { name: "totalEarned", type: "uint256" },
      { name: "lastActiveDay", type: "uint256" },
      { name: "streak", type: "uint256" },
      { name: "repScore", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "PaymentSettled",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "resourceHash", type: "bytes32", indexed: false },
      { name: "ts", type: "uint256", indexed: false },
    ],
  },
] as const;
