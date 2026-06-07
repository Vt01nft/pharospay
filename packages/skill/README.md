# @pharospay/skill — PharosPay MCP Skill

Give your AI agent a wallet on **Pharos**. An MCP server that lets an agent autonomously
pay for **x402**-protected resources with stablecoins, within spending guardrails, with
on-chain-verifiable receipts.

> Part of **PharosPay** — the x402 payment rail for Pharos. See the repo root README.

## Install / run

```bash
# from a published package
npx pharospay-skill

# or from this monorepo
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

`pay_fetch` · `get_wallet` · `get_balance` · `set_budget` · `get_budget` · `list_receipts`

See [SKILL.md](./SKILL.md) for full descriptions.

## Example

```
set_budget({ perCallMax: "0.10", dailyCap: "1.0" })
pay_fetch({ url: "https://alpha.pharospay.xyz/alpha/wallet/0xabc...", maxAmount: "0.05" })
# -> returns analytics + { txHash, amount, asset, to }; tx visible on pharosscan.xyz
list_receipts({})
```

## Environment

| Var | Default | Notes |
|-----|---------|-------|
| `PHAROSPAY_PRIVATE_KEY` | — | Required. The agent's wallet. |
| `PHAROS_CHAIN_ID` | `688689` | Pharos Atlantic testnet. |
| `PHAROS_RPC_URL` | `https://atlantic.dplabs-internal.com` | |
| `PUSD_ADDRESS` / `LEDGER_ADDRESS` | — | Deployed addresses (required off-anvil). |
| `PHAROSPAY_STORE` | `~/.pharospay/store.json` | Budget + receipts file. |

## Develop

```bash
pnpm --filter @pharospay/skill test   # store, tools, payClient (anvil integration), server smoke
```
