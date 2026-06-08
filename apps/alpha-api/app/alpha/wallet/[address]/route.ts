import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainById, getAddresses, type Hex } from "../../../../src/lib/pharos";
import { build402Body, parsePaymentHeader, verifyPayment, settle, resourceHash } from "../../../../src/lib/x402";
import { analyzeWallet } from "../../../../src/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function setup() {
  const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688689");
  const rpcUrl = process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com";
  const network = process.env.PHAROS_NETWORK ?? "pharos-testnet";
  const payTo = process.env.MERCHANT_ADDRESS as Hex;
  const price = process.env.ALPHA_PRICE ?? "0.01";
  const settlerPk = process.env.SETTLER_PRIVATE_KEY as Hex;
  if (!payTo || !settlerPk) throw new Error("missing MERCHANT_ADDRESS / SETTLER_PRIVATE_KEY");
  const { pusd, ledger } = getAddresses(chainId);
  const base = chainById(chainId);
  const chain: Chain = { ...base, rpcUrls: { default: { http: [rpcUrl] } } };
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account: privateKeyToAccount(settlerPk), chain, transport: http(rpcUrl) });
  return { chainId, network, payTo, price, token: pusd, ledger, publicClient, walletClient };
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

export async function GET(req: Request, { params }: { params: { address: string } }) {
  const address = params.address as Hex;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return Response.json({ error: "invalid address" }, { status: 400 });

  let s: ReturnType<typeof setup>;
  try {
    s = setup();
  } catch (e) {
    return Response.json({ error: "server not configured", detail: String((e as Error).message) }, { status: 500 });
  }

  const resource = `/alpha/wallet/${address}`;
  const body = build402Body({ price: s.price, payTo: s.payTo, asset: s.token, network: s.network, resource, description: "Pharos wallet analytics" });
  const required = body.accepts[0];

  const header = req.headers.get("x-payment");
  if (!header) return Response.json(body, { status: 402 });

  let payload;
  try {
    payload = parsePaymentHeader(header);
  } catch {
    return Response.json({ ...body, error: "invalid X-PAYMENT header" }, { status: 402 });
  }

  const v = await verifyPayment(payload, required, s.chainId);
  if (!v.ok) return Response.json({ ...body, error: v.reason }, { status: 402 });

  let txHash: Hex;
  try {
    txHash = await settle(payload, { walletClient: s.walletClient, publicClient: s.publicClient, ledger: s.ledger, resourceHash: resourceHash("GET", resource) });
  } catch (e) {
    return Response.json({ error: "settlement failed", detail: String((e as Error).message) }, { status: 502 });
  }

  const data = await analyzeWallet(address, s.publicClient, s.token);
  return Response.json(data, { status: 200, headers: { "X-PAYMENT-RESPONSE": b64({ success: true, txHash, network: s.network }) } });
}
