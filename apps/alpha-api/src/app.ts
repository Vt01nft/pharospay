import { Hono } from "hono";
import { createPublicClient, http, type Chain } from "viem";
import { chainById, getAddresses, type Hex } from "@pharospay/shared";
import { requirePayment } from "@pharospay/x402-pharos";
import { analyzeWallet } from "./analytics";

export interface AlphaConfig {
  chainId: number;
  rpcUrl: string;
  network: string;
  settlerPrivateKey: Hex;
  payTo: Hex;
  price?: string;
  token?: Hex;
  ledger?: Hex;
}

/** Build the Pharos Alpha API: a real paid analytics service gated by x402. */
export function createApp(cfg: AlphaConfig): Hono {
  const deployed = getAddresses(cfg.chainId);
  const token = cfg.token ?? deployed.pusd;
  const ledger = cfg.ledger ?? deployed.ledger;

  const base = chainById(cfg.chainId);
  const chain: Chain = { ...base, rpcUrls: { default: { http: [cfg.rpcUrl] } } };
  const client = createPublicClient({ chain, transport: http(cfg.rpcUrl) });

  const app = new Hono();

  app.get("/", (c) => c.json({ service: "pharos-alpha", paid: "/alpha/wallet/:address", price: cfg.price ?? "0.01" }));
  app.get("/health", (c) => c.json({ ok: true, network: cfg.network }));

  app.use(
    "/alpha/wallet/:address",
    requirePayment({
      price: cfg.price ?? "0.01",
      payTo: cfg.payTo,
      token,
      ledger,
      network: cfg.network,
      chainId: cfg.chainId,
      rpcUrl: cfg.rpcUrl,
      settlerPrivateKey: cfg.settlerPrivateKey,
      description: "Pharos wallet analytics",
    }),
  );
  app.get("/alpha/wallet/:address", async (c) => {
    const address = c.req.param("address") as Hex;
    return c.json(await analyzeWallet(address, client, token));
  });

  return app;
}
