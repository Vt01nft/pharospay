import { serve } from "@hono/node-server";
import { createApp } from "./app";
import type { Hex } from "@pharospay/shared";

const cfg = {
  chainId: Number(process.env.PHAROS_CHAIN_ID ?? "688688"),
  rpcUrl: process.env.PHAROS_RPC_URL ?? "https://testnet.dplabs-internal.com",
  network: process.env.PHAROS_NETWORK ?? "pharos-testnet",
  settlerPrivateKey: process.env.SETTLER_PRIVATE_KEY as Hex,
  payTo: process.env.MERCHANT_ADDRESS as Hex,
  price: process.env.ALPHA_PRICE ?? "0.01",
};

if (!cfg.settlerPrivateKey || !cfg.payTo) {
  console.error("SETTLER_PRIVATE_KEY and MERCHANT_ADDRESS are required");
  process.exit(1);
}

const app = createApp(cfg);
const port = Number(process.env.PORT ?? "8787");
serve({ fetch: app.fetch, port });
console.error(`Pharos Alpha API on :${port}`);
