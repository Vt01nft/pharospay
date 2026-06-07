---
name: pharospay
description: >
  Give an AI agent a wallet on Pharos. REQUIRED for x402 stablecoin payments and core
  on-chain actions on the Pharos network (Atlantic testnet, chainId 688689). Contains the
  RPC endpoints, chain ids, explorer URLs, pUSD/ledger addresses, and the exact cast/forge
  and script commands to: pay for x402-protected resources, check balances, send
  transactions, read contracts, estimate gas, and deploy — without reading it you will use
  the wrong network config.
version: 0.1.0
license: MIT
requires:
  anyBins:
    - cast
    - forge
    - node
---

# PharosPay — the agent payment skill for Pharos

PharosPay gives an agent the ability to **pay for x402-protected resources on Pharos** with
a stablecoin (pUSD, an EIP-3009 token) — plus the core on-chain operations needed to operate
on Pharos. Payments are **gasless for the payer**: the agent signs an EIP-3009
authorization, and the settlement is relayed on-chain through the `PharosPayLedger`, which
also records the agent's reputation and daily streak.

## Prerequisites

1. **Foundry** (`cast`, `forge`):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash && foundryup
   ```
   Verify: `cast --version` and `forge --version`.
2. **Node 18+** (for the x402 pay script): `node --version`.
3. Install script deps once: `cd scripts && npm install` (installs `viem`).

## Network configuration

Read `assets/networks.json`. Default network is **Atlantic testnet**:

| Field | Value |
|-------|-------|
| chainId | `688689` |
| RPC | `https://atlantic.dplabs-internal.com` |
| Explorer | `https://testnet.pharosscan.xyz` |
| Native token | `PHRS` |
| pUSD (EIP-3009) | see `assets/networks.json → contracts.pUSD` |
| PharosPayLedger | see `assets/networks.json → contracts.PharosPayLedger` |

Always pass `--rpc-url https://atlantic.dplabs-internal.com` to `cast`/`forge`.

## Security (read before any write)

- The agent's key is **`$PRIVATE_KEY`** (env var only — never hardcode or echo it).
- Before any write/transaction:
  1. Confirm `$PRIVATE_KEY` is set: `cast wallet address --private-key $PRIVATE_KEY`.
  2. Confirm the network is **Atlantic testnet** (this skill is testnet-only).
  3. Check balance: `cast balance <addr> --rpc-url $RPC --ether`.
- Spending guardrail: never authorize more than the user asked for; echo the amount and
  recipient and proceed only within the stated limit.

## Capabilities

### ⭐ Pay for an x402 resource (the headline capability)

When a URL returns **HTTP 402 Payment Required**, pay it on Pharos and fetch the resource:

```bash
PRIVATE_KEY=$PRIVATE_KEY node scripts/pay.mjs <url> [--max <pUSD>]
```

The script: fetches the URL → on `402` reads the x402 requirements → signs an EIP-3009
`TransferWithAuthorization` for the exact amount (gasless) → resends with an `X-PAYMENT`
header → returns the resource and a settlement tx hash you can open on the explorer.

> Natural-language example: *"Pay for the premium analytics at <url> on Pharos, spending at
> most 0.05 pUSD, and show me the result and the transaction hash."*

### Get pUSD + native balances

```bash
cast balance <addr> --rpc-url $RPC --ether                       # PHRS (gas)
cast call <pUSD> "balanceOf(address)(uint256)" <addr> --rpc-url $RPC   # pUSD (6 decimals)
```

### Claim test pUSD (faucet) and seed a wallet

```bash
cast send <pUSD> "claim()" --private-key $PRIVATE_KEY --rpc-url $RPC
cast send <pUSD> "transfer(address,uint256)" <to> 50000000 --private-key $PRIVATE_KEY --rpc-url $RPC  # 50 pUSD
```

### Read the agent's on-chain reputation

```bash
cast call <PharosPayLedger> "stats(address)(uint256,uint256,uint256,uint256,uint256,uint256)" <addr> --rpc-url $RPC
# returns: txCount, totalPaid, totalEarned, lastActiveDay, streak, repScore
```

### Core on-chain operations

- **Check tx status:** `cast tx <txhash> --rpc-url $RPC` and `cast receipt <txhash> --rpc-url $RPC`.
- **Read contract:** `cast call <addr> "<sig>" [args] --rpc-url $RPC`.
- **Send native:** `cast send <to> --value <wei> --private-key $PRIVATE_KEY --rpc-url $RPC`.
- **Estimate gas:** `cast estimate <addr> "<sig>" [args] --rpc-url $RPC`.
- **Deploy:** `forge create <Contract> --private-key $PRIVATE_KEY --rpc-url $RPC --broadcast`.

See `references/` for detailed recipes and error handling.

## Error handling

| Symptom | Cause | Fix |
|---------|-------|-----|
| `insufficient funds` | settler has no PHRS | fund the address from the Pharos faucet |
| `auth used` | EIP-3009 nonce replay | the pay script uses a fresh random nonce each call |
| `invalid signature` | wrong chainId/domain | this skill pins chainId 688689 (matches the token) |
| 402 loops | provider didn't accept payment | check the `X-PAYMENT-RESPONSE` header for the error |

## What makes this different

Most on-chain skills *read* or *transfer*. PharosPay lets an agent **autonomously pay for
services** via the open x402 standard on Pharos — the core primitive of the agent economy —
with gasless settlement and on-chain reputation. Full source, contracts, and tests:
see the repository README.
