import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseSignature,
  parseUnits,
  toBytes,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { MiddlewareHandler } from "hono";
import {
  chainById,
  ledgerAbi,
  recoverAuthorizationSigner,
  type Hex,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
} from "./pharos";

export function toBaseUnits(human: string, decimals = 6): bigint {
  return parseUnits(human, decimals);
}

export function resourceHash(method: string, resource: string): Hex {
  return keccak256(toBytes(`${method} ${resource}`));
}

export function build402Body(o: {
  price: string;
  payTo: Hex;
  asset: Hex;
  network: string;
  resource: string;
  description: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  decimals?: number;
}): PaymentRequired {
  const req: PaymentRequirements = {
    scheme: "exact",
    network: o.network,
    maxAmountRequired: toBaseUnits(o.price, o.decimals ?? 6).toString(),
    asset: o.asset,
    payTo: o.payTo,
    resource: o.resource,
    description: o.description,
    mimeType: o.mimeType ?? "application/json",
    maxTimeoutSeconds: o.maxTimeoutSeconds ?? 120,
  };
  return { x402Version: 1, accepts: [req] };
}

export function parsePaymentHeader(h: string): PaymentPayload {
  return JSON.parse(Buffer.from(h, "base64").toString("utf8")) as PaymentPayload;
}

export async function verifyPayment(
  payload: PaymentPayload,
  req: PaymentRequirements,
  chainId: number,
): Promise<{ ok: boolean; reason?: string }> {
  if (payload.scheme !== "exact") return { ok: false, reason: "unsupported scheme" };
  if (payload.network !== req.network) return { ok: false, reason: "wrong network" };
  if (payload.asset.toLowerCase() !== req.asset.toLowerCase()) return { ok: false, reason: "wrong asset" };
  const a = payload.authorization;
  if (a.to.toLowerCase() !== req.payTo.toLowerCase()) return { ok: false, reason: "wrong payTo" };
  if (BigInt(a.value) < BigInt(req.maxAmountRequired)) return { ok: false, reason: "insufficient amount" };
  const now = Math.floor(Date.now() / 1000);
  if (Number(a.validBefore) <= now) return { ok: false, reason: "authorization expired" };
  const signer = await recoverAuthorizationSigner({ token: payload.asset, chainId, auth: a, signature: payload.signature });
  if (signer.toLowerCase() !== a.from.toLowerCase()) return { ok: false, reason: "bad signature" };
  return { ok: true };
}

export async function settle(
  payload: PaymentPayload,
  opts: { walletClient: WalletClient; publicClient: PublicClient; ledger: Hex; resourceHash: Hex },
): Promise<Hex> {
  const a = payload.authorization;
  const sig = parseSignature(payload.signature);
  const v = sig.v !== undefined ? Number(sig.v) : (sig.yParity ?? 0) + 27;
  const hash = await opts.walletClient.writeContract({
    address: opts.ledger,
    abi: ledgerAbi,
    functionName: "settle",
    args: [a.from, a.to, BigInt(a.value), BigInt(a.validAfter), BigInt(a.validBefore), a.nonce, v, sig.r, sig.s, opts.resourceHash],
    account: opts.walletClient.account!,
    chain: opts.walletClient.chain,
  });
  await opts.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export interface RequirePaymentOptions {
  price: string;
  payTo: Hex;
  token: Hex;
  ledger: Hex;
  network: string;
  chainId: number;
  rpcUrl: string;
  settlerPrivateKey: Hex;
  description?: string;
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

export function requirePayment(opts: RequirePaymentOptions): MiddlewareHandler {
  const account = privateKeyToAccount(opts.settlerPrivateKey);
  const base = chainById(opts.chainId);
  const chain: Chain = { ...base, rpcUrls: { default: { http: [opts.rpcUrl] } } };
  const publicClient = createPublicClient({ chain, transport: http(opts.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(opts.rpcUrl) });

  return async (c, next) => {
    const resource = c.req.path;
    const body = build402Body({
      price: opts.price,
      payTo: opts.payTo,
      asset: opts.token,
      network: opts.network,
      resource,
      description: opts.description ?? "Paid resource",
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
      txHash = await settle(payload, { walletClient, publicClient, ledger: opts.ledger, resourceHash: resourceHash(c.req.method, resource) });
    } catch (e) {
      return c.json({ error: "settlement failed", detail: String((e as Error).message ?? e) }, 502);
    }
    c.header("X-PAYMENT-RESPONSE", b64({ success: true, txHash, network: opts.network }));
    await next();
  };
}
