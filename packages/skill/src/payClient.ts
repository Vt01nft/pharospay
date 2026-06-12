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
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

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

// ipaddr.js range names that are not safe to reach from an outbound request.
const BLOCKED_RANGES = new Set([
  "unspecified", // 0.0.0.0, ::
  "broadcast", // 255.255.255.255
  "loopback", // 127.0.0.0/8, ::1
  "private", // 10/8, 172.16/12, 192.168/16
  "linkLocal", // 169.254/16 (incl. cloud metadata), fe80::/10
  "uniqueLocal", // fc00::/7
  "carrierGradeNat", // 100.64/10
  "reserved", // 192.0.2.0/24, 240/4, etc.
]);

/** True if an IP literal (any form ipaddr.js accepts) sits in a private/internal range. */
function isBlockedIp(addr: string): boolean {
  let ip;
  try {
    ip = ipaddr.parse(addr);
  } catch {
    return false; // not an IP literal
  }
  if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress()) {
    ip = (ip as ipaddr.IPv6).toIPv4Address(); // unwrap ::ffff:127.0.0.1 and check the v4 range
  }
  return BLOCKED_RANGES.has(ip.range());
}

/**
 * Synchronous SSRF guard (CWE-918). Rejects non-http(s) schemes and IP-literal hosts in
 * private/internal ranges. WHATWG URL normalization plus ipaddr.js canonicalization mean
 * hex/octal/decimal IPv4 (0x7f000001, 2130706433) and IPv4-mapped IPv6 are caught here.
 * Set PHAROSPAY_ALLOW_LOCAL=1 to allow localhost/internal targets during local development.
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
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error(`refusing to fetch a private or internal address: ${u.hostname}`);
  }
  if (isBlockedIp(host)) {
    throw new Error(`refusing to fetch a private or internal address: ${u.hostname}`);
  }
}

/**
 * Async SSRF guard for the real-network path. Runs the sync checks, then for hostnames that are
 * not IP literals it resolves DNS and rejects if ANY resolved address is private/internal. This
 * closes the DNS-rebinding and "hostname points at an internal IP" bypass.
 */
async function assertSafeUrlResolved(raw: string): Promise<void> {
  assertSafeUrl(raw);
  if (process.env.PHAROSPAY_ALLOW_LOCAL === "1") return;
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host)) return; // already checked as a literal
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error(`could not resolve host: ${host}`);
  }
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new Error(`refusing to fetch ${host}: it resolves to a private/internal address (${a.address})`);
    }
  }
}

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/**
 * Fetch that re-checks the SSRF guard on every hop. Redirects are handled manually so a public
 * URL cannot 3xx-redirect the agent onto an internal address. `resolveDns` is true on the real
 * fetch path and false when a transport is injected (the caller controls where requests go).
 */
async function safeFetch(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  resolveDns: boolean,
  depth = 0,
): Promise<Response> {
  if (resolveDns) await assertSafeUrlResolved(url);
  else assertSafeUrl(url);
  const res = await fetchImpl(url, { ...init, redirect: "manual" });
  if (REDIRECT_STATUS.has(res.status) && depth < 5) {
    const location = res.headers.get("location");
    if (location) {
      const next = new URL(location, url).href;
      return safeFetch(fetchImpl, next, init, resolveDns, depth + 1);
    }
  }
  return res;
}

/** The agent's x402 payer: runs the 402 flow against Pharos within budget guardrails. */
export class PayClient {
  private account: ReturnType<typeof privateKeyToAccount>;
  private chain: Chain;
  private publicClient: PublicClient;
  private store: Store;
  private fetchImpl: FetchLike;
  private resolveDns: boolean;

  constructor(private cfg: PayClientConfig) {
    this.account = privateKeyToAccount(cfg.privateKey);
    const base = chainById(cfg.chainId);
    this.chain = { ...base, rpcUrls: { default: { http: [cfg.rpcUrl] } } };
    this.publicClient = createPublicClient({ chain: this.chain, transport: http(cfg.rpcUrl) });
    this.store = cfg.store ?? new Store();
    // Sanitizer at the sink: the default transport validates the destination (scheme +
    // canonicalized IP range) before the request leaves the process, so even a direct call
    // cannot reach an internal address. safeFetch adds DNS resolution and redirect re-checks.
    this.fetchImpl =
      cfg.fetchImpl ??
      ((input, init) => {
        assertSafeUrl(input);
        return fetch(input, init);
      });
    // Only resolve DNS for the SSRF check when we own the transport (the default global fetch).
    // An injected fetchImpl is a controlled transport, so the caller is responsible for routing.
    this.resolveDns = !cfg.fetchImpl;
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
    const method = p.method ?? "GET";
    const first = await safeFetch(this.fetchImpl, p.url, { method, body: p.body }, this.resolveDns);
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

    const second = await safeFetch(this.fetchImpl, p.url, { method, body: p.body, headers: { "X-PAYMENT": header } }, this.resolveDns);
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
