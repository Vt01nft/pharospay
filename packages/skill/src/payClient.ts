import { createPublicClient, http, parseUnits, formatUnits, type Chain, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  chainById,
  pusdAbi,
  ledgerAbi,
  buildAuthorization,
  signAuthorization,
  type Hex,
  type PaymentPayload,
  type PaymentRequired,
} from "@pharospay/shared";
import { Store, type Receipt } from "./store";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PayClientConfig {
  privateKey: Hex;
  chainId: number;
  rpcUrl: string;
  token: Hex;
  ledger?: Hex;
  network?: string;
  store?: Store;
  fetchImpl?: FetchLike;
}

export interface Reputation {
  address: Hex;
  txCount: number;
  totalPaid: string;
  totalEarned: string;
  streak: number;
  repScore: number;
}

export interface PayResult {
  status: number;
  data: unknown;
  payment?: { txHash: Hex; amount: string; asset: Hex; to: Hex };
}

async function safeJson(r: Response): Promise<unknown> {
  try {
    return await r.json();
  } catch {
    return await r.text();
  }
}

/**
 * SSRF guard (CWE-918). Reject non-http(s) schemes and private/internal hosts before the agent
 * fetches a URL, so it cannot be steered into cloud metadata (169.254.169.254), localhost, or
 * internal network ranges. Set PHAROSPAY_ALLOW_LOCAL=1 to allow localhost during local dev.
 */
export function assertSafeUrl(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`invalid url: ${raw}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`refusing url with scheme "${u.protocol}" (only http and https are allowed)`);
  }
  if (process.env.PHAROSPAY_ALLOW_LOCAL === "1") return;
  if (isPrivateHost(u.hostname.toLowerCase())) {
    throw new Error(`refusing to fetch a private or internal address: ${u.hostname}`);
  }
}

function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1" || h === "::") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true; // IPv6 link-local + ULA
  return false;
}

/** The agent's x402 payer: runs the 402 flow against Pharos within budget guardrails. */
export class PayClient {
  private account: ReturnType<typeof privateKeyToAccount>;
  private chain: Chain;
  private publicClient: PublicClient;
  private store: Store;
  private fetchImpl: FetchLike;

  constructor(private cfg: PayClientConfig) {
    this.account = privateKeyToAccount(cfg.privateKey);
    const base = chainById(cfg.chainId);
    this.chain = { ...base, rpcUrls: { default: { http: [cfg.rpcUrl] } } };
    this.publicClient = createPublicClient({ chain: this.chain, transport: http(cfg.rpcUrl) });
    this.store = cfg.store ?? new Store();
    this.fetchImpl = cfg.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  get address(): Hex {
    return this.account.address;
  }

  get chainId(): number {
    return this.cfg.chainId;
  }

  async getBalance(): Promise<{ pUSD: string; PHRS: string; pUSDRaw: string }> {
    const [pusd, native] = await Promise.all([
      this.publicClient.readContract({
        address: this.cfg.token,
        abi: pusdAbi,
        functionName: "balanceOf",
        args: [this.account.address],
      }) as Promise<bigint>,
      this.publicClient.getBalance({ address: this.account.address }),
    ]);
    return { pUSD: formatUnits(pusd, 6), PHRS: formatUnits(native, 18), pUSDRaw: pusd.toString() };
  }

  async getReputation(): Promise<Reputation> {
    if (!this.cfg.ledger) throw new Error("ledger address not configured");
    const st = (await this.publicClient.readContract({
      address: this.cfg.ledger,
      abi: ledgerAbi,
      functionName: "stats",
      args: [this.account.address],
    })) as readonly bigint[];
    return {
      address: this.account.address,
      txCount: Number(st[0]),
      totalPaid: st[1].toString(),
      totalEarned: st[2].toString(),
      streak: Number(st[4]),
      repScore: Number(st[5]),
    };
  }

  async payFetch(p: { url: string; method?: string; body?: string; maxAmount?: string }): Promise<PayResult> {
    assertSafeUrl(p.url);
    const method = p.method ?? "GET";
    const first = await this.fetchImpl(p.url, { method, body: p.body });
    if (first.status !== 402) {
      return { status: first.status, data: await safeJson(first) };
    }

    const required = (await first.json()) as PaymentRequired;
    const req = required.accepts?.[0];
    if (!req) throw new Error("402 response missing payment requirements");

    const host = new URL(p.url).host;
    const amount = BigInt(req.maxAmountRequired);

    // Guardrails, enforced BEFORE signing anything.
    if (p.maxAmount !== undefined) {
      const cap = parseUnits(p.maxAmount, 6);
      if (amount > cap) throw new Error(`required ${req.maxAmountRequired} exceeds maxAmount ${cap.toString()}`);
    }
    const allowed = this.store.checkAllowed({ host, amount });
    if (!allowed.ok) throw new Error(`blocked by guardrails: ${allowed.reason}`);

    const auth = buildAuthorization({ from: this.account.address, to: req.payTo, value: req.maxAmountRequired });
    const signature = await signAuthorization({ account: this.account, token: req.asset, chainId: this.cfg.chainId, auth });
    const payload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: req.network,
      asset: req.asset,
      authorization: auth,
      signature,
    };
    const header = Buffer.from(JSON.stringify(payload)).toString("base64");

    const second = await this.fetchImpl(p.url, { method, body: p.body, headers: { "X-PAYMENT": header } });
    if (!second.ok) {
      throw new Error(`payment failed (${second.status}): ${JSON.stringify(await safeJson(second))}`);
    }

    const respHeader = second.headers.get("X-PAYMENT-RESPONSE");
    const resp = respHeader ? JSON.parse(Buffer.from(respHeader, "base64").toString("utf8")) : {};
    const txHash = resp.txHash as Hex;

    this.store.addSpend(amount);
    const receipt: Receipt = {
      url: p.url,
      host,
      amount: req.maxAmountRequired,
      asset: req.asset,
      to: req.payTo,
      txHash,
      network: req.network,
      timestamp: Date.now(),
    };
    this.store.recordReceipt(receipt);

    return { status: 200, data: await safeJson(second), payment: { txHash, amount: req.maxAmountRequired, asset: req.asset, to: req.payTo } };
  }
}
