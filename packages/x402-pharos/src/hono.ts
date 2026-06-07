import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { MiddlewareHandler } from "hono";
import { chainById, type Hex, type PaymentResponse } from "@pharospay/shared";
import {
  build402Body,
  parsePaymentHeader,
  resourceHash,
  settle,
  settleDirect,
  verifyPayment,
} from "./core";

export interface RequirePaymentOptions {
  price: string;
  payTo: Hex;
  token: Hex;
  /** If set, settle through the ledger (records reputation). Else settle direct. */
  ledger?: Hex;
  network: string;
  chainId: number;
  rpcUrl: string;
  settlerPrivateKey: Hex;
  description?: string;
  asset?: Hex;
  mimeType?: string;
}

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

/** Hono middleware that paywalls a route behind x402 on Pharos. */
export function requirePayment(opts: RequirePaymentOptions): MiddlewareHandler {
  const account = privateKeyToAccount(opts.settlerPrivateKey);
  const base = chainById(opts.chainId);
  const chain: Chain = { ...base, rpcUrls: { default: { http: [opts.rpcUrl] } } };
  const publicClient = createPublicClient({ chain, transport: http(opts.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(opts.rpcUrl) });
  const asset = opts.asset ?? opts.token;

  return async (c, next) => {
    const resource = c.req.path;
    const body = build402Body({
      price: opts.price,
      payTo: opts.payTo,
      asset,
      network: opts.network,
      resource,
      description: opts.description ?? "Paid resource",
      mimeType: opts.mimeType,
    });
    const req = body.accepts[0];

    const header = c.req.header("X-PAYMENT");
    if (!header) return c.json(body, 402);

    let payload;
    try {
      payload = parsePaymentHeader(header);
    } catch {
      return c.json({ ...body, error: "invalid X-PAYMENT header" }, 402);
    }

    const verdict = await verifyPayment(payload, req, opts.chainId);
    if (!verdict.ok) return c.json({ ...body, error: verdict.reason }, 402);

    let txHash: Hex;
    try {
      const rh = resourceHash(c.req.method, resource);
      txHash = opts.ledger
        ? await settle(payload, { walletClient, publicClient, ledger: opts.ledger, resourceHash: rh })
        : await settleDirect(payload, { walletClient, publicClient, token: opts.token });
    } catch (e) {
      const err = (e as Error).message ?? String(e);
      const resp: PaymentResponse = { success: false, network: opts.network, error: err };
      c.header("X-PAYMENT-RESPONSE", b64(resp));
      return c.json({ error: "settlement failed", detail: err }, 502);
    }

    const resp: PaymentResponse = { success: true, txHash, network: opts.network };
    c.header("X-PAYMENT-RESPONSE", b64(resp));
    await next();
  };
}
