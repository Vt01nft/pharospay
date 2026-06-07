# PharosPay — Agent Payment Rail for Pharos (x402 Skill)

**Date:** 2026-06-07
**Hackathon:** Skill-to-Agent Dual Cascade Hackathon (Pharos × Anvita Flow) — Phase 1 (Skill)
**Status:** Design approved, pending spec review

---

## 1. One-liner

Make Pharos an **x402 payment network** so any AI agent can **autonomously discover, pay for, and sell on-chain services** — safely, with built-in spending guardrails. Shipped as a reusable **MCP Skill** (+ SKILL.md) plus the on-chain infrastructure that makes it real.

## 2. Why this (alignment + differentiation)

- **On Pharos's mission, first item:** Pharos is "built to power the AI Agent economy, designed for on-chain payments." We build exactly that primitive.
- **The partnership thesis:** Anvita Flow's headline feature is native **x402 micropayments** for "trusted value exchange between machines." This is that, on Pharos.
- **First-mover:** As of 2026-06-07 the hackathon has **0 submissions**; the entire prior Pharos cohort (Agent Kit, PharosGPT, optiFi, Buzzing Club, PlanDAO, Gotchipus) built read-tooling / DeFi automation / apps — **nobody built agent payments**. x402 is a validated hot category on other chains (Solana, Cronos, Google/Coinbase/SKALE) but **not yet on Pharos**.
- **Original twist:** spending **guardrails** (per-call cap, daily budget, allowlist) + on-chain-verifiable **receipts** — an agent that *cannot* drain a wallet = the "trust" half of "trusted machine value exchange."

### Judging-criteria mapping (Phase 1)
| Criterion | Coverage |
|---|---|
| Originality / creativity | First x402 rail on Pharos + guardrail twist |
| Technical quality / completeness | Contract + middleware + MCP Skill + live paid service + real settlement |
| Practical use case for agents | Canonical agent-economy action: pay for what you need |
| Reusability / composability | MCP tools (drop-in) + `npm`-installable middleware + shared token/registry |
| Successful deployment on Pharos | Verified contracts + real settlement tx on Pharos testnet |
| UX / docs clarity | One-command install, clear READMEs, 60–90s demo video |
| Alignment with Pharos vision | Highest possible — x402 agent payments = the partnership thesis |

## 3. Goals / Non-goals

**Goals**
- Ship a reusable, composable **payer Skill** (the hero) that any MCP/OpenAI agent can install.
- Make Pharos genuinely x402-settleable (deploy the missing token + settlement path).
- Prove the full loop end-to-end with a **real** paid service on Pharos testnet (real on-chain tx visible on explorer).
- Satisfy the stated submission requirements: **public GitHub repo** + **60–90s demo video**.
- Leave a clean **Phase-2 seed**: an agent that both earns (sells) and spends (buys) on Pharos.

**Non-goals (YAGNI for Phase 1)**
- Mainnet deployment, audits, production-grade key management.
- Multi-chain support (Pharos testnet only).
- Fancy frontend dashboard (a minimal status page only, if any).
- Permit2 path (EIP-3009 only; Permit2 is a future enhancement).

## 4. Architecture / Components

All components are **real and deployed on Pharos Atlantic testnet** (chainId `688688`).

### ① `pUSD` — EIP-3009 test stablecoin *(MUST)*
A real ERC-20 implementing **EIP-3009** (`transferWithAuthorization`, `receiveWithAuthorization`, `cancelAuthorization`) with an **EIP-712** domain matched to the verifier, plus a public test **faucet** so anyone (and judges) can get tokens.
- 6 decimals, symbol `pUSD`, name `PharosPay USD`.
- `claim()` mints a fixed amount per address per cooldown (testnet faucet).
- EIP-712 domain: `{ name: "PharosPay USD", version: "1", chainId: 688688, verifyingContract }`.
- Deployed + verified on `https://testnet.pharosscan.xyz`.
- **This is net-new ecosystem infra:** without an EIP-3009 token, x402 cannot settle on Pharos.

### ② `@pharos-pay/x402` — provider middleware (merchant side) *(MUST)*
A reusable Express/Hono middleware that paywalls any route behind x402 on Pharos, with the **facilitator colocated** (no Coinbase/external dependency).

```ts
requirePayment({
  price: "0.01",            // human units of asset
  payTo: "0xMerchant...",   // receiver
  asset?: PUSD_ADDRESS,     // default pUSD
  network?: "pharos-testnet",
  description?: "Pharos Alpha — wallet analytics",
}): Middleware
```
Behavior:
- **No / invalid payment →** respond `402` with x402 body:
  `{ x402Version, accepts: [{ scheme: "exact", network, maxAmountRequired, asset, payTo, resource, description, mimeType, maxTimeoutSeconds }] }`.
- **Valid `X-PAYMENT` header →** verify the EIP-712 / EIP-3009 signature, **settle `transferWithAuthorization` on Pharos** via a settler wallet (pays gas in PHRS), attach `X-PAYMENT-RESPONSE: { success, txHash, network }`, then `next()`.
- Verification + settlement built on `@x402/evm` primitives where they fit; viem for chain calls.

### ③ PharosPay Skill — payer side (the hero) *(MUST)*
An **MCP server** (also shipped as `SKILL.md` / AgentSkill so both tags are covered). Composable tools:

| Tool | Signature | Purpose |
|---|---|---|
| `pay_fetch` | `({ url, method?, body?, maxAmount? }) → { status, data, payment? }` | Full x402 flow vs. Pharos; returns the resource + `{ txHash, amount, asset, to }` |
| `get_wallet` | `() → { address, network }` | Agent wallet identity |
| `get_balance` | `() → { pUSD, PHRS }` | Funds available |
| `set_budget` | `({ perCallMax?, dailyCap?, allowlist?, denylist? }) → policy` | **Guardrails** |
| `get_budget` | `() → { policy, spentToday }` | Inspect guardrails |
| `list_receipts` | `({ limit? }) → Receipt[]` | On-chain-verifiable payment log (tx hashes) |

`pay_fetch` internals: request → on `402`, parse requirements → **enforce guardrails** (perCall, dailyCap, allowlist; reject otherwise with a clear error) → sign EIP-3009 authorization with the agent wallet → resend with `X-PAYMENT` → return data + receipt; persist receipt locally (JSON) keyed by txHash.
- Wallet key from env (`PHAROSPAY_PRIVATE_KEY`); budget/policy + receipts persisted to a local store file.

### ④ Pharos Alpha API — a real paid service *(MUST — real, not a demo prop)*
A live HTTP service built **with ②**, serving **real Pharos on-chain analytics** computed from Pharos RPC/explorer (e.g. `GET /alpha/wallet/:address` → balances, recent-activity summary, simple risk flags). Genuinely useful, self-contained (no external paid API keys), and it closes the loop. Deployed on Vercel; the paid route returns `402` until paid.

### ⑤ On-chain Skill Registry — marketplace layer *(STRETCH; the cut line)*
A small Solidity `ServiceRegistry`: providers `register(url, price, asset, description, category)`; reads via `getServices()`. The Skill gains `discover({ category? })` / `list_services()` tools that read it. Turns the rail into a **discoverable agent service marketplace**. If the clock runs out, ①–④ are already a complete, real, deployed product.

## 5. End-to-end data flow (real, on-chain)

1. Agent (via MCP host) calls `pay_fetch({ url: "https://alpha.../alpha/wallet/0xabc", maxAmount: "0.05" })`.
2. Alpha API (④) replies `402` + Pharos payment requirements (asset = pUSD, amount, payTo).
3. Skill (③) enforces guardrails (per-call ≤ maxAmount, under daily cap, host allowlisted).
4. Skill signs an EIP-3009 `transferWithAuthorization` authorization (off-chain, gasless for agent).
5. Skill resends the request with `X-PAYMENT` (the signed authorization).
6. Middleware (②) verifies the signature and **settles on Pharos** — submits `transferWithAuthorization` to pUSD (①); merchant receives pUSD.
7. Middleware returns the analytics + `X-PAYMENT-RESPONSE { txHash }`.
8. Skill records a receipt; `list_receipts()` shows the txHash, viewable on the Pharos explorer.

## 6. Tech stack

- **Language:** TypeScript everywhere.
- **Contracts:** Solidity + **Foundry** (① and ⑤). OpenZeppelin ERC-20 + an EIP-3009 mixin.
- **Chain:** **viem** (chain config for Pharos testnet), `@x402/evm` primitives for x402 schemes.
- **Skill:** `@modelcontextprotocol/sdk` (stdio MCP server) + `SKILL.md`.
- **Middleware / service:** Hono (or Express) + `@x402/evm`; Alpha API deployed on **Vercel**.
- **Monorepo:** pnpm workspaces.

### Network params (Pharos Atlantic testnet)
- chainId: `688688`
- RPC: `https://testnet.dplabs-internal.com`
- Explorer: `https://testnet.pharosscan.xyz`
- Native gas token: `PHRS` (faucet: official + gas.zip)

## 7. Repo structure

```
pharospay/
├─ packages/
│  ├─ contracts/        # Foundry: pUSD.sol, ServiceRegistry.sol, tests, deploy scripts
│  ├─ shared/           # chain config, ABIs, x402 types, EIP-712 helpers
│  ├─ x402-pharos/      # ② provider middleware (requirePayment) + colocated settler
│  └─ skill/            # ③ MCP server + SKILL.md (pay_fetch, budget, receipts, discover)
├─ apps/
│  └─ alpha-api/        # ④ real paid service (Pharos analytics) — deploy to Vercel
├─ docs/                # READMEs, quickstart, demo script
└─ README.md            # headline: "PharosPay — give your agent a wallet on Pharos"
```

## 8. Priority / cut line (so we always have a submittable product)

- **MUST (core, guaranteed):** ① pUSD token · ② provider middleware w/ inline settle · ③ payer Skill (pay_fetch, get_balance, set_budget, list_receipts) · ④ real Alpha API · README + 60–90s demo video + deployed links.
- **SHOULD:** get_wallet/get_budget tools; faucet UX; polished docs; SKILL.md packaging verified in a real MCP host; show an OpenAI-driven agent using it.
- **STRETCH:** ⑤ on-chain Service Registry + `discover()` marketplace tools.

**Framing for submission:** headline = the **Skill** ("give your AI agent a wallet on Pharos"); token/middleware/service framed as "what makes it work + proof of on-chain deployment." Present the payer side as a small **composable skill set** (pay · budget · receipts · discover), not a monolith.

## 9. Risks & mitigations

- **EIP-3009 EIP-712 domain/signature must match across signer ↔ token ↔ verifier (chainId/domain quirks on Pharos's EVM).** Mitigation: we **own the token**, so we set its EIP-712 domain to exactly what the verifier expects; integration-test sign→verify→settle against Pharos early (first build milestone).
- **External facilitator won't support Pharos.** Mitigation: facilitator is **colocated** in ② (we settle ourselves) — no Coinbase dependency. Fallback "direct-settle" mode if `@x402/evm` settle helpers don't fit Pharos: Skill signs, middleware submits raw `transferWithAuthorization` via viem.
- **Pharos RPC instability / faucet limits during build.** Mitigation: cache deploy artifacts; pre-fund the settler + a demo agent wallet early; keep a devnet fallback (chainId 2525).
- **18-hour clock.** Mitigation: strict MUST/STRETCH cut line; ⑤ is the only thing that can drop; spec doubles as README to avoid rework.

## 10. Submission checklist (DoraHacks BUIDL)

- [ ] Public GitHub repo (monorepo, real READMEs) — **required**
- [ ] 60–90s demo video of the real loop (agent hits 402 → auto-pays on Pharos → gets data → tx on explorer) — **required**
- [ ] Live deployed Alpha API link + deployed/verified contract addresses on `pharosscan.xyz`
- [ ] Install instructions for the Skill (MCP config snippet) + SKILL.md
- [ ] Written description (≥250 words) framing it as the Skill, with the Pharos-vision alignment
- [ ] Phase-2 note: the agent that earns + spends on Pharos

## 11. Phase-2 seed (Agent Arena)

An autonomous Pharos agent that **buys** data via the Skill (③) and **sells** its own analysis via the middleware (②) — earning and spending pUSD/PHRS on Pharos. Phase 1 ships the rails; Phase 2 ships the agent that lives on them.
