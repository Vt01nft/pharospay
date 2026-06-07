import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  anvilLocal,
  buildAuthorization,
  pusdAbi,
  ledgerAbi,
  signAuthorization,
  type Hex,
  type PaymentPayload,
} from "@pharospay/shared";
import { startAnvilWithContracts, ANVIL_KEY_0, ANVIL_KEY_1, type AnvilContext } from "@pharospay/shared/testing";
import { requirePayment } from "../src/hono";
import { encodePaymentHeader } from "../src/core";

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
      description: "test analytics",
    }),
  );
  app.get("/alpha", (c) => c.json({ ok: true, data: "secret-alpha" }));
}, 60000);

afterAll(() => ctx?.stop());

it("returns 402 with Pharos requirements when unpaid", async () => {
  const res = await app.request("/alpha");
  expect(res.status).toBe(402);
  const body = await res.json();
  expect(body.accepts[0].payTo).toBe(MERCHANT);
  expect(body.accepts[0].maxAmountRequired).toBe("10000");
});

it("settles a valid payment on-chain and returns the resource", async () => {
  const payer = privateKeyToAccount(ANVIL_KEY_1);
  const chain: Chain = { ...anvilLocal, rpcUrls: { default: { http: [ctx.rpcUrl] } } };
  const payerWallet = createWalletClient({ account: payer, chain, transport: http(ctx.rpcUrl) });

  // fund the payer from the faucet
  const claimHash = await payerWallet.writeContract({ address: ctx.pusd, abi: pusdAbi, functionName: "claim", args: [] });
  await ctx.publicClient.waitForTransactionReceipt({ hash: claimHash });

  // sign an EIP-3009 authorization to the merchant
  const auth = buildAuthorization({ from: payer.address, to: MERCHANT, value: "10000" });
  const signature = await signAuthorization({ account: payer, token: ctx.pusd, chainId: 31337, auth });
  const payload: PaymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: NETWORK,
    asset: ctx.pusd,
    authorization: auth,
    signature,
  };

  const res = await app.request("/alpha", { headers: { "X-PAYMENT": encodePaymentHeader(payload) } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.data).toBe("secret-alpha");

  const respHeader = res.headers.get("X-PAYMENT-RESPONSE");
  expect(respHeader).toBeTruthy();
  const resp = JSON.parse(Buffer.from(respHeader!, "base64").toString("utf8"));
  expect(resp.success).toBe(true);
  expect(resp.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

  // merchant actually received pUSD on-chain
  const bal = (await ctx.publicClient.readContract({
    address: ctx.pusd,
    abi: pusdAbi,
    functionName: "balanceOf",
    args: [MERCHANT],
  })) as bigint;
  expect(bal).toBe(10000n);

  // reputation recorded for the payer
  const st = (await ctx.publicClient.readContract({
    address: ctx.ledger,
    abi: ledgerAbi,
    functionName: "stats",
    args: [payer.address],
  })) as readonly bigint[] | Record<string, bigint>;
  const txCount = Array.isArray(st) ? st[0] : (st as any).txCount;
  expect(txCount).toBe(1n);
}, 60000);
