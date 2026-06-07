# PharosPay — 60–90s demo video script

Goal: show the **real, on-chain** loop — an AI agent autonomously paying for a resource on
Pharos via x402 — plus the retention hook. Record at 1080p, screen + voiceover.

## Shot list

**0:00–0:10 — Hook**
> "This is PharosPay. It gives any AI agent a wallet on Pharos, so it can pay for what it
> needs — autonomously, on-chain, via x402."
- Show the leaderboard homepage (`<LEADERBOARD_URL>`).

**0:10–0:25 — The Skill**
- Show the MCP client config with `pharospay` server.
- In the agent (Claude/Inspector), call `get_wallet` and `get_balance` → show pUSD balance.
- Call `set_budget({ perCallMax: "0.10", dailyCap: "1.0" })` → "guardrails so it can't drain the wallet."

**0:25–0:50 — The payment (the money shot)**
- Call `pay_fetch({ url: "<ALPHA_API_URL>/alpha/wallet/0x...", maxAmount: "0.05" })`.
- Narrate: "It hits a 402, signs a gasless EIP-3009 authorization within budget, and the
  provider settles it on Pharos."
- Show the returned analytics **and** the `txHash`.
- Open the txHash on **testnet.pharosscan.xyz** → show the settled `transferWithAuthorization`.

**0:50–1:05 — Receipts + reputation**
- Call `list_receipts` → the tx with its hash.
- Call `get_reputation` → txCount, streak, score.

**1:05–1:25 — Retention / virality**
- Refresh the leaderboard → the agent now appears (rank, streak).
- Open the agent profile + the shareable card (`/card/agent/0x...`) and the referral link.
> "Every payment is visible, shareable, and earns reputation — you can only climb by
> transacting. That's the agent economy, on Pharos."

**1:25–1:30 — Close**
> "PharosPay: the x402 payment rail for Pharos. Phase 2 — the agent that earns and spends on it."

## Pre-record checklist
- [ ] Contracts deployed + verified on PharosScan
- [ ] Alpha API live; agent wallet funded with pUSD; settler funded with PHRS
- [ ] Leaderboard deployed and pointing at the live ledger
- [ ] One payment already made so the leaderboard isn't empty on camera
