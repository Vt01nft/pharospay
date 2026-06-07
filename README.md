# PharosPay

PharosPay gives an AI agent a wallet on Pharos and a payment record that lives on-chain. The
agent pays for things over x402 (gasless for the agent), and every payment is settled by a
contract that keeps a reputation score, a daily streak, and a leaderboard rank. There is a
referral that hands both sides some test pUSD.

Plenty of agent skills read balances or move tokens. The thing that's new here is the
reputation: a way to see, on-chain, which agents actually pay and keep paying.

Built for the Skill-to-Agent Dual Cascade Hackathon (Pharos and Anvita Flow), Phase 1.

## Why

Pharos is built for an economy where agents transact, and on-chain payments are the first thing
it lists in that mission. Anvita Flow's pitch is trusted value exchange between machines, using
the x402 micropayment standard. PharosPay makes Pharos a place x402 actually settles: it ships
the missing pieces (an EIP-3009 stablecoin and a settlement and reputation ledger), a reusable
skill that gives an agent a wallet, a small provider middleware, a real paid service, and a
leaderboard that makes the activity visible.

We checked the other Pharos skills. There are skills for wallet health, audits, token launches,
RWA, and a couple for x402 payments. None of them give an agent a reputation it earns by paying.
That is the part we lead with.

## What's in here

```
 Agent (MCP host: Claude or OpenAI)
        |  pay_fetch(url)                    +------------------------------+
        v                                    |  Skill (MCP)                 |
   +---------+   402 + terms                 |  pay_fetch, get_balance      |
   | Provider |<--------------------------   |  set_budget (guardrails)     |
   | x402     |   X-PAYMENT (EIP-3009 sig)   |  list_receipts, get_reputation|
   | middleware|--------------------------> |  share_receipt, referral     |
   +----+-----+                              +------------------------------+
        | settle()                                   ^ reads reputation
        v                                            |
   +----------------------+   relays    +------------+-----------+
   | PharosPayLedger      |------------>| pUSD (EIP-3009)        |
   | records rep + streak |  transfer   | + faucet + referral    |
   +----------+-----------+  WithAuth   +------------------------+
              | PaymentSettled events
              v
   Leaderboard + shareable cards (Next.js)        Alpha API (a real paid service)
```

| Package | What it is |
|---------|------------|
| `packages/contracts` | `PharosPayUSD` (EIP-3009 stablecoin, faucet, referral) and `PharosPayLedger` (settlement plus on-chain reputation and streak). Foundry. |
| `packages/shared` | viem chain config for Pharos, EIP-712 signing and verification, ABIs, addresses. |
| `packages/x402-pharos` | Provider middleware: `requirePayment()` puts an x402 paywall on any route and settles it. |
| `packages/skill` | The MCP skill: the agent's wallet. `npx pharospay-skill`. |
| `apps/alpha-api` | A real paid service: Pharos wallet analytics behind an x402 paywall. |
| `apps/leaderboard` | The leaderboard, the agent profiles, and the shareable cards. |
| `pharos-skill` | The same thing packaged as a Pharos Agent Skill (SKILL.md format). |

## How a payment works

1. The agent calls `pay_fetch(url)`. The resource answers `402` with the terms (asset, who to
   pay, how much, which network).
2. The skill checks the spending limits (per call, per day, allowed hosts) before it signs.
3. It signs an EIP-3009 `TransferWithAuthorization`. The agent needs no gas for this.
4. It resends with an `X-PAYMENT` header. The provider verifies the signature and settles
   through `PharosPayLedger`, which moves the pUSD and updates reputation and streak in one
   transaction.
5. The skill records a receipt. The settlement shows up on PharosScan, and the agent moves on
   the leaderboard.

## Quickstart

```jsonc
// MCP client config
{
  "mcpServers": {
    "pharospay": {
      "command": "npx",
      "args": ["pharospay-skill"],
      "env": {
        "PHAROSPAY_PRIVATE_KEY": "0xYOUR_AGENT_KEY",
        "PHAROS_CHAIN_ID": "688689",
        "PHAROS_RPC_URL": "https://atlantic.dplabs-internal.com"
      }
    }
  }
}
```

```
set_budget({ perCallMax: "0.10", dailyCap: "1.0" })
pay_fetch({ url: "<ALPHA_API_URL>/alpha/wallet/0xabc...", maxAmount: "0.05" })
list_receipts({})
get_reputation({})
```

## Live deployment (Pharos Atlantic testnet, chain id 688689)

- pUSD: `0x3c37a2a0ebe4683f6242189733b352f05641cb73`
- PharosPayLedger: `0x4ce02b05b3fa4e04404cdaea15c1f82be1781ca8`
- Example x402 settlement: https://testnet.pharosscan.xyz/tx/0xd95c1836af9e44fe9c5795bbf736548040ae2426742b7dd99572ba21200621c8
- Explorer: https://testnet.pharosscan.xyz

The Alpha API and the leaderboard run locally for now (see each package README). The contracts
above are live, and the settlement above is a real x402 payment that raised the paying agent's
on-chain reputation.

## Run it and check it

```bash
pnpm install
cd packages/contracts && forge test     # contracts
pnpm -r test                            # everything else
```

38 tests across the packages. The integration tests run the whole sign, verify, settle loop on a
local anvil chain, so the path is exercised end to end before anything touches the testnet.

## The reputation part

Every payment is visible. The leaderboard ranks agents by how much they've paid, how much
they've earned, and their streak. Each payment can be turned into a shareable card, and the
referral hands out bonus pUSD. You only move up by transacting, so the thing it encourages is the
thing Pharos wants: more on-chain payments.

## Where this goes next (Phase 2)

An agent that both pays for data through the skill and sells its own analysis through the
middleware, earning and spending on Pharos. Phase 1 is the rails. Phase 2 is the agent that runs
on them.

## Tech

TypeScript, viem, Foundry and Solidity, `@modelcontextprotocol/sdk`, Hono, Next.js with
`@vercel/og`, x402 over EIP-3009, pnpm workspaces.

## License

MIT
