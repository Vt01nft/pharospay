import { defineChain } from "viem";

/** Pharos Atlantic testnet (chainId 688688). */
export const pharosTestnet = defineChain({
  id: 688688,
  name: "Pharos Atlantic Testnet",
  nativeCurrency: { name: "Pharos", symbol: "PHRS", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.PHAROS_RPC_URL ?? "https://testnet.dplabs-internal.com"],
    },
  },
  blockExplorers: {
    default: { name: "PharosScan", url: "https://testnet.pharosscan.xyz" },
  },
  testnet: true,
});

/** Local anvil chain used for deterministic integration tests. */
export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export function chainById(id: number) {
  if (id === pharosTestnet.id) return pharosTestnet;
  if (id === anvilLocal.id) return anvilLocal;
  throw new Error(`Unsupported chainId ${id}`);
}
