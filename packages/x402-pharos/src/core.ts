import {
  keccak256,
  parseSignature,
  parseUnits,
  toBytes,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  ledgerAbi,
  pusdAbi,
  recoverAuthorizationSigner,
  type Authorization,
  type Hex,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
} from "@pharospay/shared";

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

export function encodePaymentHeader(p: PaymentPayload): string {
  return Buffer.from(JSON.stringify(p)).toString("base64");
}

export function parsePaymentHeader(h: string): PaymentPayload {
  return JSON.parse(Buffer.from(h, "base64").toString("utf8")) as PaymentPayload;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export async function verifyPayment(
  payload: PaymentPayload,
  req: PaymentRequirements,
  chainId: number,
): Promise<VerifyResult> {
  if (payload.scheme !== "exact") return { ok: false, reason: "unsupported scheme" };
  if (payload.network !== req.network) return { ok: false, reason: "wrong network" };
  if (payload.asset.toLowerCase() !== req.asset.toLowerCase()) return { ok: false, reason: "wrong asset" };

  const a: Authorization = payload.authorization;
  if (a.to.toLowerCase() !== req.payTo.toLowerCase()) return { ok: false, reason: "wrong payTo" };
  if (BigInt(a.value) < BigInt(req.maxAmountRequired)) return { ok: false, reason: "insufficient amount" };

  const now = Math.floor(Date.now() / 1000);
  if (Number(a.validBefore) <= now) return { ok: false, reason: "authorization expired" };

  const signer = await recoverAuthorizationSigner({
    token: payload.asset,
    chainId,
    auth: a,
    signature: payload.signature,
  });
  if (signer.toLowerCase() !== a.from.toLowerCase()) return { ok: false, reason: "bad signature" };

  return { ok: true };
}

function splitSig(signature: Hex): { v: number; r: Hex; s: Hex } {
  const sig = parseSignature(signature);
  const v = sig.v !== undefined ? Number(sig.v) : (sig.yParity ?? 0) + 27;
  return { v, r: sig.r, s: sig.s };
}

/** Settle by relaying through PharosPayLedger (records reputation/streak). */
export async function settle(
  payload: PaymentPayload,
  opts: { walletClient: WalletClient; publicClient: PublicClient; ledger: Hex; resourceHash: Hex },
): Promise<Hex> {
  const a = payload.authorization;
  const { v, r, s } = splitSig(payload.signature);
  const hash = await opts.walletClient.writeContract({
    address: opts.ledger,
    abi: ledgerAbi,
    functionName: "settle",
    args: [a.from, a.to, BigInt(a.value), BigInt(a.validAfter), BigInt(a.validBefore), a.nonce, v, r, s, opts.resourceHash],
    account: opts.walletClient.account!,
    chain: opts.walletClient.chain,
  });
  await opts.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/** Fallback: settle straight through the token (no reputation recording). */
export async function settleDirect(
  payload: PaymentPayload,
  opts: { walletClient: WalletClient; publicClient: PublicClient; token: Hex },
): Promise<Hex> {
  const a = payload.authorization;
  const { v, r, s } = splitSig(payload.signature);
  const hash = await opts.walletClient.writeContract({
    address: opts.token,
    abi: pusdAbi,
    functionName: "transferWithAuthorization",
    args: [a.from, a.to, BigInt(a.value), BigInt(a.validAfter), BigInt(a.validBefore), a.nonce, v, r, s],
    account: opts.walletClient.account!,
    chain: opts.walletClient.chain,
  });
  await opts.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
