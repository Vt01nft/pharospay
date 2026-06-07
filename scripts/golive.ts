/**
 * One-shot live bring-up on Pharos:
 *  1. deploy pUSD + PharosPayLedger
 *  2. settler claims pUSD and seeds the agent
 *  3. agent signs an EIP-3009 authorization; settler relays it through the ledger
 *     -> a REAL PaymentSettled tx on Pharos, with reputation recorded
 *
 * Run after the SETTLER is funded:
 *   pnpm exec tsx scripts/golive.ts
 *
 * Reads .env (SETTLER_PRIVATE_KEY, PHAROSPAY_PRIVATE_KEY, PHAROS_RPC_URL, PHAROS_CHAIN_ID,
 * MERCHANT_ADDRESS) and writes PUSD_ADDRESS / LEDGER_ADDRESS back into .env.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  parseSignature,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  pharosTestnet,
  pusdAbi,
  ledgerAbi,
  buildAuthorization,
  signAuthorization,
} from "@pharospay/shared";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const txt = readFileSync(join(root, ".env"), "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function writeEnvVar(key: string, value: string) {
  const path = join(root, ".env");
  let txt = readFileSync(path, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  txt = re.test(txt) ? txt.replace(re, `${key}=${value}`) : `${txt}\n${key}=${value}`;
  writeFileSync(path, txt);
}

function artifact(name: string): { abi: any; bytecode: Hex } {
  const j = JSON.parse(
    readFileSync(join(root, "packages", "contracts", "out", `${name}.sol`, `${name}.json`), "utf8"),
  );
  return { abi: j.abi, bytecode: j.bytecode.object as Hex };
}

const explorer = (h: string) => `https://testnet.pharosscan.xyz/tx/${h}`;

async function main() {
  loadEnv();
  const rpcUrl = process.env.PHAROS_RPC_URL!;
  const settlerPk = process.env.SETTLER_PRIVATE_KEY as Hex;
  const agentPk = process.env.PHAROSPAY_PRIVATE_KEY as Hex;
  const merchant = process.env.MERCHANT_ADDRESS as Hex;
  const chainId = Number(process.env.PHAROS_CHAIN_ID ?? "688689");

  const chain: Chain = { ...pharosTestnet, id: chainId, rpcUrls: { default: { http: [rpcUrl] } } };
  const settler = privateKeyToAccount(settlerPk);
  const agent = privateKeyToAccount(agentPk);
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });
  const wallet = createWalletClient({ account: settler, chain, transport: http(rpcUrl) });

  const bal = await pub.getBalance({ address: settler.address });
  console.log(`Settler ${settler.address} balance: ${formatUnits(bal, 18)} PHRS`);
  console.log(`Agent   ${agent.address}\n`);

  // 1) deploy
  console.log("Deploying pUSD ...");
  const usd = artifact("PharosPayUSD");
  const pusdHash = await wallet.deployContract({ abi: usd.abi, bytecode: usd.bytecode, account: settler, chain });
  const pusd = (await pub.waitForTransactionReceipt({ hash: pusdHash })).contractAddress as Hex;
  console.log(`  pUSD: ${pusd}  ${explorer(pusdHash)}`);

  console.log("Deploying PharosPayLedger ...");
  const led = artifact("PharosPayLedger");
  const ledgerHash = await wallet.deployContract({ abi: led.abi, bytecode: led.bytecode, account: settler, chain, args: [pusd] });
  const ledger = (await pub.waitForTransactionReceipt({ hash: ledgerHash })).contractAddress as Hex;
  console.log(`  Ledger: ${ledger}  ${explorer(ledgerHash)}`);

  writeEnvVar("PUSD_ADDRESS", pusd);
  writeEnvVar("LEDGER_ADDRESS", ledger);

  // 2) seed: settler claims pUSD, sends half to the agent
  console.log("\nSeeding pUSD ...");
  const claimHash = await wallet.writeContract({ address: pusd, abi: pusdAbi, functionName: "claim", args: [], account: settler, chain });
  await pub.waitForTransactionReceipt({ hash: claimHash });
  const sendHash = await wallet.writeContract({
    address: pusd,
    abi: [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] }],
    functionName: "transfer",
    args: [agent.address, parseUnits("50", 6)],
    account: settler,
    chain,
  });
  await pub.waitForTransactionReceipt({ hash: sendHash });
  console.log(`  Agent pUSD: ${formatUnits((await pub.readContract({ address: pusd, abi: pusdAbi, functionName: "balanceOf", args: [agent.address] })) as bigint, 6)}`);

  // 3) real payment: agent signs, settler relays through the ledger
  console.log("\nRunning a live x402 settlement (agent -> merchant) ...");
  const auth = buildAuthorization({ from: agent.address, to: merchant, value: parseUnits("0.01", 6).toString() });
  const signature = await signAuthorization({ account: agent, token: pusd, chainId, auth });
  const sig = parseSignature(signature);
  const v = sig.v !== undefined ? Number(sig.v) : (sig.yParity ?? 0) + 27;
  const resourceHash = "0x" + Buffer.from("GET /alpha/wallet/live").toString("hex").padEnd(64, "0").slice(0, 64);

  const settleHash = await wallet.writeContract({
    address: ledger,
    abi: ledgerAbi,
    functionName: "settle",
    args: [auth.from, auth.to, BigInt(auth.value), BigInt(auth.validAfter), BigInt(auth.validBefore), auth.nonce, v, sig.r, sig.s, resourceHash as Hex],
    account: settler,
    chain,
  });
  await pub.waitForTransactionReceipt({ hash: settleHash });
  console.log(`  Settled: ${explorer(settleHash)}`);

  const st = (await pub.readContract({ address: ledger, abi: ledgerAbi, functionName: "stats", args: [agent.address] })) as readonly bigint[];
  console.log(`  Agent reputation -> txCount ${st[0]}, totalPaid ${formatUnits(st[1], 6)} pUSD, streak ${st[4]}, score ${st[5]}`);

  console.log("\n✅ LIVE on Pharos.");
  console.log(`PUSD_ADDRESS=${pusd}`);
  console.log(`LEDGER_ADDRESS=${ledger}`);
  console.log(`Settlement tx: ${explorer(settleHash)}`);
}

main().catch((e) => {
  console.error("golive failed:", e);
  process.exit(1);
});
