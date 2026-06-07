# PharosPay Skill — give your AI agent a wallet on Pharos

A **Pharos Agent Skill** (`SKILL.md` format) that lets an AI agent **pay for x402-protected
resources on Pharos** with a stablecoin — gasless for the payer, settled on-chain with
on-chain reputation — plus the core on-chain operations (balances, transfers, reads, deploys)
driven by `cast`/`forge`.

## Install

```bash
npx skills add https://github.com/<owner>/pharospay-skill
```

Then set your agent wallet key and (for payments) install the script deps:

```bash
export PRIVATE_KEY=0x...            # agent wallet (testnet only)
cd scripts && npm install          # installs viem for the x402 pay script
```

## Use it (natural language)

> "Pay for the premium analytics at `https://…/alpha/wallet/0xabc` on Pharos, spend at most
> 0.05 pUSD, and show the result and the transaction hash."

Under the hood:

```bash
PRIVATE_KEY=$PRIVATE_KEY node scripts/pay.mjs https://…/alpha/wallet/0xabc --max 0.05
```

→ detects `402`, signs an EIP-3009 authorization (gasless), pays, returns the resource and a
settlement tx on `testnet.pharosscan.xyz`.

## What it contains

- `SKILL.md` — the agent-facing skill (network config, capabilities, security, recipes).
- `assets/networks.json` — Pharos Atlantic config (chainId 688689, RPC, explorer, addresses).
- `scripts/pay.mjs` — self-contained x402 payer (EIP-3009 + `X-PAYMENT`).
- `references/recipes.md` — `cast`/`forge` recipes for every capability.

## Why it's different

Most on-chain skills *read* or *transfer*. PharosPay lets an agent **autonomously pay for
services** via the open **x402** standard — the core primitive of the agent economy — with
gasless settlement and on-chain reputation/streaks.

Full system (EIP-3009 stablecoin, settlement+reputation ledger, provider middleware, MCP
server, a real paid service, and a live leaderboard) + tests: **see the main PharosPay
repository.**

## License

MIT
