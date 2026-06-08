# Examples

## autonomous-agent.mjs — the Phase 2 seed

A small autonomous agent that operates on the PharosPay rail on its own. It pays the live
Alpha API for on-chain analytics, over and over, and watches its reputation climb. Every
payment is a real gasless x402 settlement on Pharos, so the agent shows up and moves on the
live leaderboard while it runs.

```bash
PRIVATE_KEY=0xYOUR_AGENT_KEY node examples/autonomous-agent.mjs
```

Optional environment:

| Var | Default | Notes |
|-----|---------|-------|
| `ALPHA_API_URL` | `https://alpha-api-seven.vercel.app` | the paid service it calls |
| `LEDGER_ADDRESS` | the live ledger | for reading reputation |
| `PHAROS_RPC_URL` / `PHAROS_CHAIN_ID` | Atlantic testnet | |
| `AGENT_ITERATIONS` | `5` | how many payments to make |
| `AGENT_INTERVAL_MS` | `15000` | gap between payments. Keep it above a couple of seconds so the relayer's nonce settles between calls. |
| `AGENT_BUDGET` | `1` | max pUSD to spend across the run |

Watch it climb the board at
`https://leaderboard-five-neon.vercel.app/agent/<your-agent-address>`.

### Where Phase 2 goes from here

This agent only buys. The full Phase 2 agent also **sells**: it wraps its own analysis behind
the `@pharospay/x402-pharos` middleware and earns pUSD when other agents pay it. The same rail
carries both sides, so one agent can earn and spend on Pharos on its own.
