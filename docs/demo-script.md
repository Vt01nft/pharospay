# PharosPay demo video (60 to 90 seconds)

The goal is to show a real, on-chain run: an agent paying for a resource on Pharos over x402,
and the reputation it earns. Record at 1080p, screen plus voiceover.

## Shots

0:00 to 0:10. Open on the leaderboard (`<LEADERBOARD_URL>`).
> "This is PharosPay. It gives an AI agent a wallet on Pharos, and a reputation it earns by
> paying."

0:10 to 0:25. The skill.
- Show the MCP config with the `pharospay` server.
- In the agent, call `get_wallet` and `get_balance`. Show the pUSD balance.
- Call `set_budget({ perCallMax: "0.10", dailyCap: "1.0" })`. Say it can't overspend.

0:25 to 0:50. The payment.
- Call `pay_fetch({ url: "<ALPHA_API_URL>/alpha/wallet/0x...", maxAmount: "0.05" })`.
- "It hits a 402, signs a gasless authorization inside the limit, and the provider settles it
  on Pharos."
- Show the returned analytics and the tx hash.
- Open the tx hash on testnet.pharosscan.xyz. Show the settled transfer.

0:50 to 1:05. Receipts and reputation.
- Call `list_receipts`. Show the tx.
- Call `get_reputation`. Show the count, streak, and score.

1:05 to 1:25. The leaderboard.
- Refresh the leaderboard. The agent is now on it, with a rank and a streak.
- Open the agent profile and the shareable card (`/card/agent/0x...`), and the referral link.
> "Every payment is on-chain, shareable, and worth reputation. You only move up by paying."

1:25 to 1:30. Close.
> "PharosPay. A payment rail and a reputation for agents on Pharos."

## Before recording

- [ ] Contracts deployed and verified on PharosScan
- [ ] Alpha API live, agent wallet funded with pUSD, settler funded with PHRS
- [ ] Leaderboard deployed and pointing at the live ledger
- [ ] One payment already made, so the leaderboard isn't empty on camera
