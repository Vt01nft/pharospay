import { describe, it, expect } from "vitest";
import { rank, totals, fmtUsd, short, type AgentRow } from "../lib/leaderboard";

const rows: AgentRow[] = [
  { address: "0xaaaa000000000000000000000000000000000001", txCount: 5, totalPaid: "500000", totalEarned: "0", streak: 2, repScore: 15 },
  { address: "0xbbbb000000000000000000000000000000000002", txCount: 2, totalPaid: "100000", totalEarned: "900000", streak: 7, repScore: 40 },
  { address: "0xcccc000000000000000000000000000000000003", txCount: 9, totalPaid: "300000", totalEarned: "100000", streak: 1, repScore: 12 },
];

describe("leaderboard ranking", () => {
  it("ranks payers by total paid desc", () => {
    expect(rank(rows).payers.map((r) => r.address)).toEqual([
      "0xaaaa000000000000000000000000000000000001",
      "0xcccc000000000000000000000000000000000003",
      "0xbbbb000000000000000000000000000000000002",
    ]);
  });

  it("ranks earners by total earned desc", () => {
    expect(rank(rows).earners[0].address).toBe("0xbbbb000000000000000000000000000000000002");
  });

  it("ranks streaks desc with repScore tiebreak", () => {
    expect(rank(rows).streaks.map((r) => r.streak)).toEqual([7, 2, 1]);
  });

  it("computes totals and formats pUSD", () => {
    const t = totals(rows);
    expect(t.tx).toBe(16);
    expect(t.agents).toBe(3);
    expect(t.volume).toBe("0.9");
    expect(fmtUsd("1500000")).toBe("1.5");
  });

  it("shortens addresses", () => {
    expect(short("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
});
