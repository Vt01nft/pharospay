// PharosPay autonomous agent (Phase 2 teaser).
//
// An agent that operates on the rail on its own: it pays the live PharosPay Alpha API for
// on-chain analytics, over and over, and watches its reputation climb. Every payment is a real
// gasless x402 settlement on Pharos, so the agent shows up and moves on the live leaderboard.
//
//   PRIVATE_KEY=0x...agent-wallet node examples/autonomous-agent.mjs
//
// Optional env: ALPHA_API_URL, LEDGER_ADDRESS, PHAROS_RPC_URL, PHAROS_CHAIN_ID,
//   AGENT_ITERATIONS (default 5), AGENT_INTERVAL_MS (default 15000), AGENT_BUDGET (pUSD, default 1).
import { createPublicClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

const ALPHA = process.env.ALPHA_API_URL ?? "https://alpha-api-seven.vercel.app";
const LEDGER = (process.env.LEDGER_ADDRESS ?? "0x4ce02b05b3fa4e04404cdaea15c1f82be1781ca8");
const RPC = process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com";
const CHAIN_ID = Number(process.env.PHAROS_CHAIN_ID ?? "688689");
const ITERATIONS = Number(process.env.AGENT_ITERATIONS ?? "5");
const INTERVAL = Number(process.env.AGENT_INTERVAL_MS ?? "15000");
const BUDGET = parseUnits(process.env.AGENT_BUDGET ?? "1", 6);
const EXPLORER = "https://testnet.pharosscan.xyz/tx/";

// wallets the agent decides to research
const TARGETS = [
  "0x6e1468951F22c899D413B1c172baa7Fdf11E6B2A",
  "0xAf530e928C76Dc36E4C247Ac603A6c39E78DE044",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
];

const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.error("PRIVATE_KEY env var required (the agent wallet)");
  process.exit(1);
}
const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);

const transferTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
  ],
};
const ledgerAbi = [{
  type: "function", name: "stats", stateMutability: "view", inputs: [{ name: "a", type: "address" }],
  outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
}];

const pub = createPublicClient({
  chain: { id: CHAIN_ID, name: "pharos", nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } },
  transport: http(RPC),
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function payForAnalytics(target) {
  const url = `${ALPHA}/alpha/wallet/${target}`;
  const first = await fetch(url);
  if (first.status !== 402) return { error: `expected 402, got ${first.status}` };
  const req = (await first.json()).accepts[0];
  const now = Math.floor(Date.now() / 1000);
  const auth = { from: account.address, to: req.payTo, value: req.maxAmountRequired, validAfter: "0", validBefore: String(now + 3600), nonce: `0x${randomBytes(32).toString("hex")}` };
  const signature = await account.signTypedData({
    domain: { name: "PharosPay USD", version: "1", chainId: CHAIN_ID, verifyingContract: req.asset },
    types: transferTypes, primaryType: "TransferWithAuthorization",
    message: { from: auth.from, to: auth.to, value: BigInt(auth.value), validAfter: 0n, validBefore: BigInt(auth.validBefore), nonce: auth.nonce },
  });
  const header = Buffer.from(JSON.stringify({ x402Version: 1, scheme: "exact", network: req.network, asset: req.asset, authorization: auth, signature })).toString("base64");
  const res = await fetch(url, { headers: { "X-PAYMENT": header } });
  if (!res.ok) return { error: `payment failed ${res.status}` };
  const data = await res.json();
  const resp = res.headers.get("X-PAYMENT-RESPONSE");
  const txHash = resp ? JSON.parse(Buffer.from(resp, "base64").toString("utf8")).txHash : undefined;
  return { amount: req.maxAmountRequired, data, txHash };
}

async function reputation() {
  const st = await pub.readContract({ address: LEDGER, abi: ledgerAbi, functionName: "stats", args: [account.address] });
  return { txCount: Number(st[0]), totalPaid: st[1], streak: Number(st[4]), repScore: Number(st[5]) };
}

async function main() {
  console.log(`\n  PharosPay autonomous agent`);
  console.log(`  wallet ${account.address}`);
  console.log(`  paying ${ALPHA} for analytics, ${ITERATIONS} times\n`);

  let spent = 0n;
  for (let i = 1; i <= ITERATIONS; i++) {
    if (spent + parseUnits("0.01", 6) > BUDGET) { console.log("  budget reached, stopping."); break; }
    const target = TARGETS[i % TARGETS.length];
    process.stdout.write(`  [${i}/${ITERATIONS}] researching ${target.slice(0, 8)}…  `);
    let r = await payForAnalytics(target);
    if (r.error) {
      // a 502 here is usually the relayer's nonce still settling; give it a moment and retry once
      await sleep(5000);
      r = await payForAnalytics(target);
    }
    if (r.error) { console.log(`failed: ${r.error}`); await sleep(INTERVAL); continue; }
    spent += BigInt(r.amount);
    const rep = await reputation();
    console.log(`paid ${formatUnits(BigInt(r.amount), 6)} pUSD · ${r.data.pusd} pUSD held · tx ${r.txHash?.slice(0, 10)}…`);
    console.log(`        reputation: ${rep.txCount} payments · streak ${rep.streak} · score ${rep.repScore} · ${EXPLORER}${r.txHash}`);
    if (i < ITERATIONS) await sleep(INTERVAL);
  }

  const rep = await reputation();
  console.log(`\n  done. total spent ${formatUnits(spent, 6)} pUSD over ${rep.txCount} lifetime payments (streak ${rep.streak}, score ${rep.repScore}).`);
  console.log(`  see it on the leaderboard: https://leaderboard-five-neon.vercel.app/agent/${account.address}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
