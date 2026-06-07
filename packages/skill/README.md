# @pharospay/skill

The PharosPay MCP skill. It gives an AI agent a wallet on Pharos so it can pay for
x402-protected resources with a stablecoin, stay inside spending limits, get receipts with
on-chain tx hashes, and earn a reputation and streak that show up on a leaderboard.

Part of the PharosPay project. See the repo root README.

## Install and run

```bash
# from a published package
npx pharospay-skill

# or from this repo
pnpm --filter @pharospay/skill build
node packages/skill/dist/server.js
```

## MCP client config

```json
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

## Tools

`pay_fetch`, `get_wallet`, `get_balance`, `set_budget`, `get_budget`, `list_receipts`,
`get_reputation`, `share_receipt`, `get_referral_link`. See [SKILL.md](./SKILL.md) for details.

## Example

```
set_budget({ perCallMax: "0.10", dailyCap: "1.0" })
pay_fetch({ url: "https://alpha.pharospay.xyz/alpha/wallet/0xabc...", maxAmount: "0.05" })
list_receipts({})
get_reputation({})
```

## Environment

| Var | Default | Notes |
|-----|---------|-------|
| `PHAROSPAY_PRIVATE_KEY` | none | Required. The agent's wallet. |
| `PHAROS_CHAIN_ID` | `688689` | Pharos Atlantic testnet. |
| `PHAROS_RPC_URL` | `https://atlantic.dplabs-internal.com` | |
| `PUSD_ADDRESS`, `LEDGER_ADDRESS` | none | Deployed addresses (required off anvil). |
| `PHAROSPAY_STORE` | `~/.pharospay/store.json` | Where budget and receipts are kept. |

## Develop

```bash
pnpm --filter @pharospay/skill test   # store, tools, payClient (anvil), server smoke
```
