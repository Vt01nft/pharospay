---
name: pharospay
description: Use this when an AI agent needs to pay for something on Pharos and build a record while it does. The agent pays for x402-protected resources (an API, dataset, or tool that answers HTTP 402) with a stablecoin, stays inside spending limits you set, gets receipts with on-chain transaction hashes, and earns a reputation score and daily streak that show up on a leaderboard.
license: MIT
---

# PharosPay

PharosPay lets an agent pay for things on Pharos using the x402 standard, and it keeps a record
of those payments on-chain. When a request comes back with `402 Payment Required`, the skill
signs a gasless EIP-3009 authorization for the exact amount, the provider settles it through the
`PharosPayLedger`, and the agent gets the resource. That settlement also raises the agent's
reputation and streak. Spending limits keep the agent from overspending.

## When to use it

- The agent calls an API or tool and gets back `402` with x402 payment terms.
- You want an agent that can pay per call for data, compute, or tools on its own.
- You want limits so the agent can't drain the wallet.
- You want a receipt (a Pharos tx hash) for every payment, and a reputation the agent earns.

## Tools

| Tool | What it does |
|------|--------------|
| `pay_fetch` | Fetch a url. If it answers 402, pay over x402 on Pharos (inside the limits) and return the resource plus a receipt. |
| `get_wallet` | The agent's wallet address and the Pharos chain id. |
| `get_balance` | pUSD and native PHRS balances. |
| `set_budget` | Spending limits: `perCallMax`, `dailyCap` (pUSD, "0" means no limit), `allowlist`, `denylist` (hostnames). |
| `get_budget` | The current limits and how much was spent today. |
| `list_receipts` | Recent payments, each with a Pharos tx hash. |
| `get_reputation` | The agent's reputation score, streak, totals, and leaderboard profile link. |
| `share_receipt` | A shareable card image url for a payment or for the agent profile. |
| `get_referral_link` | The agent's referral link. A new agent that claims through it gives both sides bonus pUSD. |

## How it works

1. `pay_fetch(url)` gets a `402` with the terms (asset, who to pay, how much, network).
2. The skill checks the limits before it signs anything.
3. It signs an EIP-3009 `TransferWithAuthorization`. The agent needs no gas.
4. It resends with an `X-PAYMENT` header. The provider verifies and settles on Pharos.
5. The skill records a receipt. The settlement is on testnet.pharosscan.xyz, and the payment
   raises reputation and streak.

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
        "PHAROS_CHAIN_ID": "688689",
        "PHAROS_RPC_URL": "https://atlantic.dplabs-internal.com"
      }
    }
  }
}
```

Fund the wallet with test PHRS for gas from the Pharos faucet, and get pUSD from the token's
`claim()` faucet. Then set a limit, for example `set_budget({ perCallMax: "0.10", dailyCap: "1.0" })`.
