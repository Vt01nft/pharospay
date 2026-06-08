# Security notes

PharosPay runs on Pharos Atlantic **testnet**. The tokens have no real value and the keys used
in the demo are throwaway. This file is an honest review of the security model and its limits.

## Contracts

- **EIP-3009 (`PharosPayUSD`).** Transfers are authorized by an off-chain EIP-712 signature.
  Replay is prevented by a per-signer `nonce` marked used on first redemption. The signature is
  recovered with OpenZeppelin `ECDSA.recover`, which rejects malformed and malleable signatures.
  `validAfter` / `validBefore` bound the time window. There are no external calls in the path, so
  there is no reentrancy.
- **`PharosPayLedger`.** `settle` is permissionless on purpose: anyone can relay a valid signed
  authorization. The relayer cannot redirect funds, because the `from`, `to`, and `value` are
  fixed by the signature. The ledger only calls the one trusted token address set in its
  constructor, so settlement cannot reenter through an attacker-controlled contract.
- **Faucet.** `claim` mints a fixed test amount on a cooldown. Supply is intentionally
  unbounded; this is a testnet faucet, not a real stablecoin.

## Known limitations (and how a production version would handle them)

1. **On-chain reputation can be gamed.** Because anyone can settle a signed transfer, an agent
   can pay itself, and two agents can ping-pong payments, to inflate their counts. This is the
   usual sybil problem for on-chain reputation. A production version would: require `from != to`
   in settlement, weight reputation by distinct counterparties, decay idle scores, and gate
   ranking behind a small stake or an identity signal. The current contracts are deployed and
   immutable, so these are noted rather than patched.

2. **Settler nonce under concurrency.** The Alpha API signs and submits settlements from one
   relayer wallet. Many near-simultaneous requests can collide on that wallet's transaction
   nonce and return a 502. The demo spaces calls out (the autonomous agent retries once). A
   production version would serialize settlements through a queue or manage the nonce explicitly.

3. **Key handling.** The agent never needs gas: it only signs gasless EIP-3009 authorizations,
   and the settler relays them. Only the settler holds PHRS for gas. The settler key lives in the
   Alpha API's server environment. On testnet this is acceptable; for real value it would move to
   a KMS or a dedicated relayer service, and the faucet would be removed.

## Reporting

This is a hackathon project on testnet. For anything you find, open an issue on the repository.
