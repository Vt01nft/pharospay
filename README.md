# PharosPay — give your AI agent a wallet on Pharos

> The x402 payment rail for the Pharos agent economy. An AI agent can **autonomously
> discover, pay for, and account for** on-chain services using stablecoins — safely,
> within spending guardrails, with on-chain-verifiable receipts and a live reputation
> leaderboard.

Built for the **Skill-to-Agent Dual Cascade Hackathon** (Pharos × Anvita Flow), Phase 1.

---

## Why

Pharos is built to power the AI agent economy — and **on-chain payments come first** in
that mission. Anvita Flow's thesis is *trusted value exchange between machines* via the
**x402** micropayment standard. PharosPay makes Pharos a first-class **x402 network**: it
ships the missing on-chain pieces (an EIP-3009 stablecoin + a settlement/reputation
ledger), a reusable **MCP Skill** that gives any agent a wallet, a drop-in provider
middleware, a real paid service, and a social leaderboard that turns invisible payments
into a daily, viral habit.

Nothing in the prior Pharos builder cohort did agent payments — this is net-new, on-thesis
infrastructure.

## What's in here

```
 Agent (MCP host: Claude / OpenAI)
        │  pay_fetch(url)                    ┌──────────────────────────────┐
        ▼                                    │  ③ PharosPay Skill (MCP)      │
   ┌─────────┐   402 + requirements          │  pay_fetch · get_balance      │
   │ Provider │◀───────────────────────────  │  set_budget(guardrails)       │
   │ ② x402   │   X-PAYMENT (EIP-3009 sig)    │  list_receipts · get_reputation│
   │ middleware│ ─────────────────────────▶  │  share_receipt · referral     │
   └────┬─────┘                              └──────────────────────────────┘
        │ settle()                                   ▲ reads reputation
        ▼                                            │
   ┌──────────────────────┐   relays    ┌────────────┴───────────┐
   │ ⑥ PharosPayLedger    │────────────▶│ ① pUSD (EIP-3009)      │
   │ records rep + streak │  transfer   │ + faucet + referral    │
   └──────────┬───────────┘  WithAuth   └────────────────────────┘
              │ PaymentSettled events
              ▼
   ⑥ Leaderboard + shareable OG cards (Next.js)        ④ Alpha API (real paid service)
```

| Package | What it is |
|---------|------------|
| [`packages/contracts`](packages/contracts) | `PharosPayUSD` (EIP-3009 stablecoin + faucet + referral), `PharosPayLedger` (settlement relay + on-chain reputation/streak). Foundry. |
| [`packages/shared`](packages/shared) | viem Pharos chain config, EIP-712 sign/verify helpers, ABIs, addresses. |
| [`packages/x402-pharos`](packages/x402-pharos) | Provider middleware: `requirePayment()` — paywall any route behind x402 on Pharos, settle inline. |
| [`packages/skill`](packages/skill) | **The hero**: PharosPay MCP Skill — the agent's wallet. `npx pharospay-skill`. |
| [`apps/alpha-api`](apps/alpha-api) | A real paid service: Pharos wallet analytics, gated by x402. |
| [`apps/leaderboard`](apps/leaderboard) | Live agent-economy leaderboard + shareable proof-of-payment cards + referrals. |

## How a payment works (real, on-chain)

1. Agent calls `pay_fetch(url)`; the resource replies **`402`** with x402 requirements
   (`asset`, `payTo`, `maxAmountRequired`, `network`).
2. The Skill enforces **budget guardrails** (per-call cap, daily cap, allowlist) *before signing*.
3. It signs a gasless **EIP-3009 `TransferWithAuthorization`** (the agent never needs gas).
4. It resends with an `X-PAYMENT` header; the provider verifies the signature and
   **settles through `PharosPayLedger`**, which relays the transfer **and** updates the
   agent's on-chain reputation + streak in one tx.
5. The Skill records a receipt; the settlement tx is visible on **PharosScan**, and the
   agent climbs the leaderboard.

## Quickstart — give your agent a wallet

```jsonc
// MCP client config
{
  "mcpServers": {
    "pharospay": {
      "command": "npx",
      "args": ["pharospay-skill"],
      "env": {
        "PHAROSPAY_PRIVATE_KEY": "0xYOUR_AGENT_KEY",
        "PHAROS_CHAIN_ID": "688688",
        "PHAROS_RPC_URL": "https://testnet.dplabs-internal.com"
      }
    }
  }
}
```

```
set_budget({ perCallMax: "0.10", dailyCap: "1.0" })
pay_fetch({ url: "<ALPHA_API_URL>/alpha/wallet/0xabc...", maxAmount: "0.05" })
# → analytics + { txHash, amount, asset, to }; tx on pharosscan.xyz
list_receipts({})
get_reputation({})
```

## Live deployment (Pharos Atlantic testnet, chainId 688688)

<!-- filled after deploy -->
- pUSD: `<PUSD_ADDRESS>`
- PharosPayLedger: `<LEDGER_ADDRESS>`
- Alpha API: `<ALPHA_API_URL>`
- Leaderboard: `<LEADERBOARD_URL>`
- Explorer: https://testnet.pharosscan.xyz

## Develop & verify

```bash
pnpm install
# contracts (Foundry)
cd packages/contracts && forge test
# everything else (TS) — integration tests run against a local anvil chain
pnpm -r test
```

38 tests across 6 packages. Integration tests run the **full sign → verify → settle loop
on a real EVM** (local anvil); the deployed artifact lives on Pharos testnet.

## Retention — the agent economy, made social

Every payment is visible: a **live leaderboard** ranks agents by spend, earnings, and
**daily streaks**; every payment yields a **shareable proof-of-payment card**; and a
**referral loop** (`claimWithReferrer`) grants both sides bonus pUSD. You can only climb by
transacting — so the hook pumps the exact metric Pharos cares about: on-chain payment volume.

## Phase 2 seed (Agent Arena)

An autonomous Pharos agent that **buys** data via the Skill and **sells** its own analysis
via the middleware — earning and spending on Pharos. Phase 1 ships the rails; Phase 2 ships
the agent that lives on them.

## Tech

TypeScript · viem · Foundry/Solidity · `@modelcontextprotocol/sdk` · Hono · Next.js +
`@vercel/og` · x402 (EIP-3009) · pnpm workspaces.

## License

MIT
