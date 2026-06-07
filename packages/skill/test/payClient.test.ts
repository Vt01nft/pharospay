import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvilLocal, pusdAbi, type Hex } from "@pharospay/shared";
import { startAnvilWithContracts, ANVIL_KEY_0, ANVIL_KEY_1, type AnvilContext } from "@pharospay/shared/testing";
import { requirePayment } from "@pharospay/x402-pharos";
import { PayClient } from "../src/payClient";
import { Store } from "../src/store";

const MERCHANT = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Hex;
const NETWORK = "anvil-local";

let ctx: AnvilContext;
let app: Hono;

beforeAll(async () => {
  ctx = await startAnvilWithContracts();

  app = new Hono();
  app.use(
    "/alpha",
    requirePayment({
      price: "0.01",
      payTo: MERCHANT,
      token: ctx.pusd,
      ledger: ctx.ledger,
      network: NETWORK,
      chainId: 31337,
      rpcUrl: ctx.rpcUrl,
      settlerPrivateKey: ANVIL_KEY_0,
      description: "alpha",
    }),
  );
  app.get("/alpha", (c) => c.json({ secret: 42 }));

  // fund the payer (anvil key #1) from the faucet
  const payer = privateKeyToAccount(ANVIL_KEY_1);
  const chain: Chain = { ...anvilLocal, rpcUrls: { default: { http: [ctx.rpcUrl] } } };
  const w = createWalletClient({ account: payer, chain, transport: http(ctx.rpcUrl) });
  const h = await w.writeContract({ address: ctx.pusd, abi: pusdAbi, functionName: "claim", args: [] });
  await ctx.publicClient.waitForTransactionReceipt({ hash: h });
}, 60000);

afterAll(() => ctx?.stop());

function makeClient(store: Store): PayClient {
  return new PayClient({
    privateKey: ANVIL_KEY_1,
    chainId: 31337,
    rpcUrl: ctx.rpcUrl,
    token: ctx.pusd,
    network: NETWORK,
    store,
    fetchImpl: (input, init) => app.request(input, init as RequestInit),
  });
}

it("pays a 402 endpoint and returns the resource + records a receipt", async () => {
  const store = new Store(join(tmpdir(), `pp-pay-${Math.random().toString(36).slice(2)}.json`));
  const client = makeClient(store);

  const res = await client.payFetch({ url: "http://alpha.test/alpha", maxAmount: "0.05" });
  expect(res.status).toBe(200);
  expect((res.data as { secret: number }).secret).toBe(42);
  expect(res.payment?.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  expect(store.listReceipts().length).toBe(1);
  expect(store.getSpentToday()).toBe(10000n);
}, 60000);

it("refuses to pay above maxAmount without signing", async () => {
  const store = new Store(join(tmpdir(), `pp-pay2-${Math.random().toString(36).slice(2)}.json`));
  const client = makeClient(store);

  await expect(client.payFetch({ url: "http://alpha.test/alpha", maxAmount: "0.001" })).rejects.toThrow(/exceeds maxAmount/);
  expect(store.listReceipts().length).toBe(0);
}, 60000);
