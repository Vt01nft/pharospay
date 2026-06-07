import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store";

function tmpStore(): Store {
  return new Store(join(tmpdir(), `pp-store-${Math.random().toString(36).slice(2)}.json`));
}

describe("Store guardrails", () => {
  it("rejects amounts over the per-call max", () => {
    const s = tmpStore();
    s.setBudget({ perCallMax: "50000" }); // 0.05 pUSD
    expect(s.checkAllowed({ host: "a.com", amount: 60000n }).ok).toBe(false);
    expect(s.checkAllowed({ host: "a.com", amount: 40000n }).ok).toBe(true);
  });

  it("enforces the daily cap using tracked spend", () => {
    const s = tmpStore();
    s.setBudget({ dailyCap: "100000" });
    s.addSpend(70000n);
    expect(s.getSpentToday()).toBe(70000n);
    expect(s.checkAllowed({ host: "a.com", amount: 40000n }).ok).toBe(false);
    expect(s.checkAllowed({ host: "a.com", amount: 30000n }).ok).toBe(true);
  });

  it("respects allowlist then denylist", () => {
    const s = tmpStore();
    s.setBudget({ allowlist: ["good.com"] });
    expect(s.checkAllowed({ host: "bad.com", amount: 1n }).ok).toBe(false);
    expect(s.checkAllowed({ host: "good.com", amount: 1n }).ok).toBe(true);

    s.setBudget({ allowlist: [], denylist: ["evil.com"] });
    expect(s.checkAllowed({ host: "evil.com", amount: 1n }).ok).toBe(false);
  });

  it("records and lists receipts (newest first)", () => {
    const s = tmpStore();
    s.recordReceipt({ url: "u1", host: "h", amount: "1", asset: "0x01", to: "0x02", txHash: "0xaa", network: "n", timestamp: 1 });
    s.recordReceipt({ url: "u2", host: "h", amount: "2", asset: "0x01", to: "0x02", txHash: "0xbb", network: "n", timestamp: 2 });
    const r = s.listReceipts();
    expect(r.length).toBe(2);
    expect(r[0].url).toBe("u2");
  });
});
