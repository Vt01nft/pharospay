import { formatUnits, type PublicClient } from "viem";
import { pusdAbi, type Hex } from "@pharospay/shared";

export interface WalletAnalytics {
  address: Hex;
  native: string;
  pusd: string;
  txCount: number;
  riskFlags: string[];
  computedAt: number;
}

const LOW_GAS_WEI = 10_000_000_000_000_000n; // 0.01 PHRS

/** Compute real on-chain analytics for a wallet from a Pharos public client. */
export async function analyzeWallet(address: Hex, client: PublicClient, token: Hex): Promise<WalletAnalytics> {
  const [native, pusd, txCount] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({ address: token, abi: pusdAbi, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
    client.getTransactionCount({ address }),
  ]);

  const riskFlags: string[] = [];
  if (txCount === 0) riskFlags.push("fresh-wallet");
  if (native < LOW_GAS_WEI) riskFlags.push("low-gas");
  if (pusd === 0n) riskFlags.push("no-pusd");

  return {
    address,
    native: formatUnits(native, 18),
    pusd: formatUnits(pusd, 6),
    txCount,
    riskFlags,
    computedAt: Date.now(),
  };
}
