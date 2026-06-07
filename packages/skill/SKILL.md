---
name: pharospay
description: Give your AI agent a wallet on Pharos. Use when an agent needs to autonomously pay for an x402-protected resource (an API, dataset, or tool that returns HTTP 402 Payment Required) using stablecoins on the Pharos network — safely, within spending guardrails, with on-chain-verifiable receipts.
license: MIT
---

# PharosPay — the agent payment rail for Pharos

PharosPay lets an AI agent **discover, pay for, and account for** paid resources on the
Pharos network using the open **x402** standard. When a request returns `402 Payment
Required`, the Skill signs a gasless **EIP-3009** authorization for the exact amount,
the provider settles it on-chain through the `PharosPayLedger`, and the agent gets the
resource back — all within budget guardrails you control.

## When to use this skill

- The agent calls an API/tool and receives **HTTP 402** with x402 payment requirements.
- You want an agent that can **pay-per-call** for data/compute/tools autonomously.
- You need **spending guardrails** so the agent cannot drain the wallet.
- You want **on-chain receipts** (Pharos tx hashes) for every payment.

## Tools

| Tool | What it does |
|------|--------------|
| `pay_fetch` | Fetch a URL; if it returns 402, pay via x402 on Pharos (within guardrails) and return the resource + a receipt `{ txHash, amount, asset, to }`. |
| `get_wallet` | The agent's wallet address and the Pharos chain id. |
| `get_balance` | pUSD and native PHRS balances. |
| `set_budget` | Set guardrails: `perCallMax`, `dailyCap` (pUSD human units; `"0"` = unlimited), `allowlist`, `denylist` (hostnames). |
| `get_budget` | Current guardrails + amount spent today. |
| `list_receipts` | Recent payments, each with a Pharos tx hash you can open on the explorer. |

## How it works

1. `pay_fetch(url)` → request returns `402` with `{ asset, payTo, maxAmountRequired, network }`.
2. The Skill enforces guardrails (per-call cap, daily cap, allowlist) **before signing**.
3. It signs an EIP-3009 `TransferWithAuthorization` (gasless for the agent).
4. It resends with an `X-PAYMENT` header; the provider verifies + settles on Pharos.
5. The Skill records a receipt; the settlement tx is visible on `pharosscan.xyz`.

## Setup

Set `PHAROSPAY_PRIVATE_KEY` (the agent's wallet) and run the MCP server:

```json
{
  "mcpServers": {
    "pharospay": {
      "command": "npx",
      "args": ["pharospay-skill"],
      "env": {
        "PHAROSPAY_PRIVATE_KEY": "0x...",
        "PHAROS_CHAIN_ID": "688688",
        "PHAROS_RPC_URL": "https://testnet.dplabs-internal.com"
      }
    }
  }
}
```

Fund the wallet with test PHRS (gas) from the Pharos faucet and pUSD via the token's
`claim()` faucet. Then set a budget, e.g. `set_budget({ perCallMax: "0.10", dailyCap: "1.0" })`.
