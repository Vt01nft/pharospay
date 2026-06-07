import { defineChain, recoverTypedDataAddress } from "viem";

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

export function getAddresses(chainId: number): { pusd: Hex; ledger: Hex } {
  const pusd = process.env.PUSD_ADDRESS as Hex | undefined;
  const ledger = process.env.LEDGER_ADDRESS as Hex | undefined;
  if (chainId === 31337) {
    return {
      pusd: pusd ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      ledger: ledger ?? "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    };
  }
  if (!pusd || !ledger) throw new Error(`PUSD_ADDRESS / LEDGER_ADDRESS not set for chain ${chainId}`);
  return { pusd, ledger };
}

export const pusdAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export const ledgerAbi = [
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
      { name: "resourceHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export interface Authorization {
  from: Hex;
  to: Hex;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  asset: Hex;
  payTo: Hex;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
}

export interface PaymentRequired {
  x402Version: number;
  accepts: PaymentRequirements[];
}

export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  asset: Hex;
  authorization: Authorization;
  signature: Hex;
}

const transferTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const authDomain = (chainId: number, token: Hex) =>
  ({ name: "PharosPay USD", version: "1", chainId, verifyingContract: token }) as const;

export async function recoverAuthorizationSigner(p: {
  token: Hex;
  chainId: number;
  auth: Authorization;
  signature: Hex;
}): Promise<Hex> {
  return recoverTypedDataAddress({
    domain: authDomain(p.chainId, p.token),
    types: transferTypes,
    primaryType: "TransferWithAuthorization",
    message: {
      from: p.auth.from,
      to: p.auth.to,
      value: BigInt(p.auth.value),
      validAfter: BigInt(p.auth.validAfter),
      validBefore: BigInt(p.auth.validBefore),
      nonce: p.auth.nonce,
    },
    signature: p.signature,
  });
}
