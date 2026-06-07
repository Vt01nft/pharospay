/**
 * Test helper: spawn a local anvil node, deploy pUSD + PharosPayLedger from the
 * Foundry artifacts, and return clients + addresses. Used by integration tests
 * across packages so the full sign -> verify -> settle loop runs on a real EVM.
 *
 * Requires `forge build` to have produced packages/contracts/out/*.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvilLocal } from "./chain";
import type { Hex } from "./types";

export const ANVIL_KEY_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
export const ANVIL_KEY_1 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "contracts", "out");

function artifact(name: string): { abi: any; bytecode: Hex } {
  const json = JSON.parse(readFileSync(join(outDir, `${name}.sol`, `${name}.json`), "utf8"));
  return { abi: json.abi, bytecode: json.bytecode.object as Hex };
}

function anvilBin(): string {
  if (process.env.ANVIL_PATH) return process.env.ANVIL_PATH;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, "Foundry", "bin", "anvil.exe");
  }
  return "anvil";
}

export interface AnvilContext {
  rpcUrl: string;
  chainId: number;
  pusd: Hex;
  ledger: Hex;
  publicClient: PublicClient;
  walletClient: WalletClient;
  stop: () => void;
}

export async function startAnvilWithContracts(): Promise<AnvilContext> {
  const port = 8600 + Math.floor(Math.random() * 300);
  const rpcUrl = `http://127.0.0.1:${port}`;
  const proc: ChildProcess = spawn(anvilBin(), ["--port", String(port), "--silent"], {
    stdio: "ignore",
  });

  const chain = { ...anvilLocal, rpcUrls: { default: { http: [rpcUrl] } } };
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const account = privateKeyToAccount(ANVIL_KEY_0);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  // wait for RPC readiness
  for (let i = 0; i < 100; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (i === 99) {
      proc.kill();
      throw new Error("anvil did not start");
    }
  }

  const usd = artifact("PharosPayUSD");
  const led = artifact("PharosPayLedger");

  const pusdHash = await walletClient.deployContract({ abi: usd.abi, bytecode: usd.bytecode, account, chain });
  const pusdRcpt = await publicClient.waitForTransactionReceipt({ hash: pusdHash });
  const pusd = pusdRcpt.contractAddress as Hex;

  const ledgerHash = await walletClient.deployContract({
    abi: led.abi,
    bytecode: led.bytecode,
    account,
    chain,
    args: [pusd],
  });
  const ledgerRcpt = await publicClient.waitForTransactionReceipt({ hash: ledgerHash });
  const ledger = ledgerRcpt.contractAddress as Hex;

  return {
    rpcUrl,
    chainId: anvilLocal.id,
    pusd,
    ledger,
    publicClient,
    walletClient,
    stop: () => proc.kill(),
  };
}
