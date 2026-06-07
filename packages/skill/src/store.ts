import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Hex } from "@pharospay/shared";

/** Spending guardrails. Amounts are base units (6 decimals). "0" = unlimited. */
export interface Budget {
  perCallMax: string;
  dailyCap: string;
  allowlist: string[];
  denylist: string[];
}

export interface Receipt {
  url: string;
  host: string;
  amount: string;
  asset: Hex;
  to: Hex;
  txHash: Hex;
  network: string;
  timestamp: number;
}

interface Data {
  budget: Budget;
  spent: { day: number; amount: string };
  receipts: Receipt[];
}

const DEFAULT: Data = {
  budget: { perCallMax: "0", dailyCap: "0", allowlist: [], denylist: [] },
  spent: { day: 0, amount: "0" },
  receipts: [],
};

function defaultPath(): string {
  return process.env.PHAROSPAY_STORE ?? join(homedir(), ".pharospay", "store.json");
}

/** JSON-file-backed budget + receipt store for the payer Skill. */
export class Store {
  constructor(private path: string = defaultPath()) {}

  private read(): Data {
    if (!existsSync(this.path)) return structuredClone(DEFAULT);
    try {
      return { ...structuredClone(DEFAULT), ...JSON.parse(readFileSync(this.path, "utf8")) };
    } catch {
      return structuredClone(DEFAULT);
    }
  }

  private write(d: Data): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(d, null, 2));
  }

  private today(): number {
    return Math.floor(Date.now() / 86_400_000);
  }

  getBudget(): Budget {
    return this.read().budget;
  }

  setBudget(p: Partial<Budget>): Budget {
    const d = this.read();
    d.budget = { ...d.budget, ...p };
    this.write(d);
    return d.budget;
  }

  getSpentToday(): bigint {
    const d = this.read();
    return d.spent.day === this.today() ? BigInt(d.spent.amount) : 0n;
  }

  addSpend(amount: bigint): void {
    const d = this.read();
    const t = this.today();
    const cur = d.spent.day === t ? BigInt(d.spent.amount) : 0n;
    d.spent = { day: t, amount: (cur + amount).toString() };
    this.write(d);
  }

  recordReceipt(r: Receipt): void {
    const d = this.read();
    d.receipts.unshift(r);
    this.write(d);
  }

  listReceipts(limit = 20): Receipt[] {
    return this.read().receipts.slice(0, limit);
  }

  /** Enforce guardrails for a candidate payment. */
  checkAllowed(p: { host: string; amount: bigint }): { ok: boolean; reason?: string } {
    const b = this.getBudget();
    if (b.denylist.includes(p.host)) return { ok: false, reason: `host ${p.host} is denylisted` };
    if (b.allowlist.length > 0 && !b.allowlist.includes(p.host)) {
      return { ok: false, reason: `host ${p.host} not in allowlist` };
    }
    if (b.perCallMax !== "0" && p.amount > BigInt(b.perCallMax)) {
      return { ok: false, reason: "amount exceeds per-call max" };
    }
    if (b.dailyCap !== "0") {
      const spent = this.getSpentToday();
      if (spent + p.amount > BigInt(b.dailyCap)) return { ok: false, reason: "amount exceeds daily cap" };
    }
    return { ok: true };
  }
}
