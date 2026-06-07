import { describe, it, expect } from "vitest";
import type { PublicClient } from "viem";
import { analyzeWallet } from "../src/analytics";
import type { Hex } from "@pharospay/shared";

const TOKEN = "0x0000000000000000000000000000000000000abc" as Hex;
const ADDR = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Hex;

function mockClient(over: { native: bigint; pusd: bigint; txCount: number }): PublicClient {
  return {
    getBalance: async () => over.native,
    readContract: async () => over.pusd,
    getTransactionCount: async () => over.txCount,
  } as unknown as PublicClient;
}

describe("analyzeWallet", () => {
  it("formats balances and computes no flags for an active funded wallet", async () => {
    const client = mockClient({ native: 5_000_000_000_000_000_000n, pusd: 100_000_000n, txCount: 12 });
    const r = await analyzeWallet(ADDR, client, TOKEN);
    expect(r.native).toBe("5");
    expect(r.pusd).toBe("100");
    expect(r.txCount).toBe(12);
    expect(r.riskFlags).toEqual([]);
  });

  it("flags a fresh, gasless, empty wallet", async () => {
    const client = mockClient({ native: 0n, pusd: 0n, txCount: 0 });
    const r = await analyzeWallet(ADDR, client, TOKEN);
    expect(r.riskFlags.sort()).toEqual(["fresh-wallet", "low-gas", "no-pusd"]);
  });
});
