import { it, expect } from "vitest";
import { createApp } from "../src/app";
import type { Hex } from "@pharospay/shared";

const MERCHANT = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Hex;
const ANVIL_KEY_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;

const app = createApp({
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:1",
  network: "anvil-local",
  settlerPrivateKey: ANVIL_KEY_0,
  payTo: MERCHANT,
});

it("serves health without payment", async () => {
  const r = await app.request("/health");
  expect(r.status).toBe(200);
  expect((await r.json()).ok).toBe(true);
});

it("gates the analytics route behind a 402 with Pharos requirements", async () => {
  const r = await app.request("/alpha/wallet/0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  expect(r.status).toBe(402);
  const b = await r.json();
  expect(b.accepts[0].payTo).toBe(MERCHANT);
  expect(b.accepts[0].maxAmountRequired).toBe("10000");
  expect(b.accepts[0].description).toBe("Pharos wallet analytics");
});
