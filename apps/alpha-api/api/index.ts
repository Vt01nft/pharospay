import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  http,
  keccak256,
  parseSignature,
  parseUnits,
  recoverTypedDataAddress,
  toBytes,
  type Chain,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const config = { runtime: "nodejs" };

type Hex = `0x${string}`;

const pharosTestnet = (rpc: string) =>
  defineChain({
    id: 688689,
    name: "Pharos Atlantic Testnet",
    nativeCurrency: { name: "Pharos", symbol: "PHRS", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
    blockExplorers: { default: { name: "PharosScan", url: "https://testnet.pharosscan.xyz" } },
    testnet: true,
  });

const pusdAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const ledgerAbi = [
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
      { name: "resourceHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

interface Authorization {
  from: Hex;
  to: Hex;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}
interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  asset: Hex;
  authorization: Authorization;
  signature: Hex;
}

const transferTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

function env() {
  const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688689");
  const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com";
  const network = process.env.PHAROS_NETWORK ?? "pharos-testnet";
  const payTo = process.env.MERCHANT_ADDRESS as Hex;
  const price = process.env.ALPHA_PRICE ?? "0.01";
  const token = process.env.PUSD_ADDRESS as Hex;
  const ledger = process.env.LEDGER_ADDRESS as Hex;
  const settlerPk = process.env.SETTLER_PRIVATE_KEY as Hex;
  if (!payTo || !token || !ledger || !settlerPk) throw new Error("missing env (MERCHANT_ADDRESS / PUSD_ADDRESS / LEDGER_ADDRESS / SETTLER_PRIVATE_KEY)");
  const chain: Chain = pharosTestnet(rpcUrl);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account: privateKeyToAccount(settlerPk), chain, transport: http(rpcUrl) });
  return { chainId, network, payTo, price, token, ledger, publicClient, walletClient };
}

function build402(price: string, payTo: Hex, asset: Hex, network: string, resource: string) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact" as const,
        network,
        maxAmountRequired: parseUnits(price, 6).toString(),
        asset,
        payTo,
        resource,
        description: "Pharos wallet analytics",
        mimeType: "application/json",
        maxTimeoutSeconds: 120,
      },
    ],
  };
}

async function analyze(address: Hex, client: PublicClient, token: Hex) {
  const [native, pusd, txCount] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({ address: token, abi: pusdAbi, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
    client.getTransactionCount({ address }),
  ]);
  const riskFlags: string[] = [];
  if (txCount === 0) riskFlags.push("fresh-wallet");
  if (native < 10_000_000_000_000_000n) riskFlags.push("low-gas");
  if (pusd === 0n) riskFlags.push("no-pusd");
  return { address, native: formatUnits(native, 18), pusd: formatUnits(pusd, 6), txCount, riskFlags, computedAt: Date.now() };
}

export async function GET(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  if (path === "/" || path === "/health" || path === "/api") {
    return json({ service: "pharos-alpha", paid: "/alpha/wallet/:address", price: process.env.ALPHA_PRICE ?? "0.01", network: process.env.PHAROS_NETWORK ?? "pharos-testnet" });
  }
  const m = path.match(/^\/alpha\/wallet\/(0x[0-9a-fA-F]{40})\/?$/);
  if (!m) return json({ error: "not found" }, { status: 404 });
  const address = m[1] as Hex;

  let s: ReturnType<typeof env>;
  try {
    s = env();
  } catch (e) {
    return json({ error: "server not configured", detail: String((e as Error).message) }, { status: 500 });
  }

  const body = build402(s.price, s.payTo, s.token, s.network, path);
  const required = body.accepts[0];

  const header = req.headers.get("x-payment");
  if (!header) return json(body, { status: 402 });

  let payload: PaymentPayload;
  try {
    payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return json({ ...body, error: "invalid X-PAYMENT header" }, { status: 402 });
  }

  const a = payload.authorization;
  if (payload.scheme !== "exact") return json({ ...body, error: "unsupported scheme" }, { status: 402 });
  if (payload.network !== required.network) return json({ ...body, error: "wrong network" }, { status: 402 });
  if (payload.asset.toLowerCase() !== required.asset.toLowerCase()) return json({ ...body, error: "wrong asset" }, { status: 402 });
  if (a.to.toLowerCase() !== required.payTo.toLowerCase()) return json({ ...body, error: "wrong payTo" }, { status: 402 });
  if (BigInt(a.value) < BigInt(required.maxAmountRequired)) return json({ ...body, error: "insufficient amount" }, { status: 402 });
  if (Number(a.validBefore) <= Math.floor(Date.now() / 1000)) return json({ ...body, error: "authorization expired" }, { status: 402 });

  const signer = await recoverTypedDataAddress({
    domain: { name: "PharosPay USD", version: "1", chainId: s.chainId, verifyingContract: payload.asset },
    types: transferTypes,
    primaryType: "TransferWithAuthorization",
    message: {
      from: a.from,
      to: a.to,
      value: BigInt(a.value),
      validAfter: BigInt(a.validAfter),
      validBefore: BigInt(a.validBefore),
      nonce: a.nonce,
    },
    signature: payload.signature,
  });
  if (signer.toLowerCase() !== a.from.toLowerCase()) return json({ ...body, error: "bad signature" }, { status: 402 });

  let txHash: Hex;
  try {
    const sig = parseSignature(payload.signature);
    const v = sig.v !== undefined ? Number(sig.v) : (sig.yParity ?? 0) + 27;
    txHash = await s.walletClient.writeContract({
      address: s.ledger,
      abi: ledgerAbi,
      functionName: "settle",
      args: [a.from, a.to, BigInt(a.value), BigInt(a.validAfter), BigInt(a.validBefore), a.nonce, v, sig.r, sig.s, keccak256(toBytes(`GET ${path}`))],
      account: s.walletClient.account!,
      chain: s.walletClient.chain,
    });
    await s.publicClient.waitForTransactionReceipt({ hash: txHash });
  } catch (e) {
    return json({ error: "settlement failed", detail: String((e as Error).message) }, { status: 502 });
  }

  const data = await analyze(address, s.publicClient, s.token);
  return json(data, { status: 200, headers: { "X-PAYMENT-RESPONSE": b64({ success: true, txHash, network: s.network }) } });
}
