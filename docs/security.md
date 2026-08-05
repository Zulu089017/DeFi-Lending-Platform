# Security Model

> **Status: scaffold — this protocol has not yet been audited. The notes below
> describe the intended security model and the known TODOs that must be resolved
> before mainnet deployment.**

## Threat model

| Adversary                      | Capability                                    | Mitigation                                                                        |
| ------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------- |
| Single attester key compromise | Sign a malicious `wrap` or `release`          | 2-of-3 (or better) attester quorum                                                |
| Source-chain reorg             | Replay a `Locked` event                       | Replay-protection salts on both sides; `confirmations` requirement on EVM watcher |
| Stale oracle                   | Borrow against bad prices                     | Per-asset `heartbeat` enforced by `Oracle::get_price`; multi-publisher redundancy |
| Underwater position            | Manual liquidator required                    | Permissionless `liquidation.liquidate(...)` callable by anyone                    |
| Bridge rate-limit bypass       | Mint $1B in one hour                          | `lending_controller.check_mint_rate` circuit-breaker                              |
| Admin key compromise           | Upgrade contracts, drain protocol             | 24h timelock + multisig on every admin action                                     |
| Replay across chains           | Use an Ethereum `wrap` attestation on Polygon | `chain_id` is part of the signed payload                                          |
| ECDSA malleability             | Submit a second valid sig for the same digest | `s` value bound to lower half-order                                               |

## Open TODOs (must close before mainnet)

The current scaffold contains a number of **known placeholders**. They are
listed here so they cannot be forgotten:

- [x] `lending_controller.wrap` must verify the ed25519 attestation via
      `env.crypto().ed25519_verify(bridge_pub, payload, sig)`. **Closed
      (2026-07)** — `require_bridge` verifies `sha256(build_canonical_payload)`
      against the registered bridge pubkey; see `docs/invariants.md` § 6 (C-1).
- [x] `lending_pool.borrow` must enforce a **health factor check** (sum
      collateral value across all assets, multiply by `ltv_bps`, compare to
      total debt). **Closed (2026-08)** — `borrow` now enforces
      `collateral_value >= total_debt` with a `health_factor` view; see
      `docs/invariants.md` § 4 (L-10 through L-16).
- [x] `lending_pool.repay` math was simplified to `interest.max(principal)`. The
      correct accrued-debt formula is `principal * borrow_index / snap.index`.
      **Closed (2026-08)** — `repay` now uses the index-accrued formula.
- [x] `lending_pool.accrue_interest` must be **time-based**
      (per-ledger-sequence-delta) — the scaffold uses a constant additive bump.
      **Closed (2026-08)** — `accrue_interest` now uses ledger-sequence delta.
- [ ] `lending_pool` uses a non-virtual share counter (first-depositor attack
      risk). Production should use a virtual shares offset.
- [ ] `liquidation.fee` is taken from the **gross** in the scaffold (it should
      be from the **bonus**). The fix in the scaffold makes the fee
      `fee_bps × (gross - repay)`.
- [x] `liquidation` should enforce `close_factor_bps` against the borrower's
      outstanding debt before allowing a `liquidate`. **Closed (2026-08)** —
      `liquidate` now enforces close factor; see `docs/invariants.md` § 5 (Q-1 through Q-9).
- [x] The EVM `Bridge.release` should use **EIP-712** with a domain separator,
      not a raw `keccak256`. **Closed (2026-01)** — `Bridge` now inherits
      `EIP712Upgradeable` and `_hashTypedDataV4` replaces the raw digest; see
      `docs/invariants.md` § 7 (B-7) and `CHANGELOG.md`.
- [ ] The off-chain `bridge` service should use **multi-attester signing** with
      **staggered key release** (e.g. one key in HSM, one in cold storage, one
      on a hot server).
- [ ] The `oracle` should aggregate from at least two independent publishers and
      use a **median** rather than accepting the first reported value.
- [ ] The `lending_controller` admin functions should be guarded by a
      **timelock + multisig**, not a single EOA.

## Audit

A formal audit by an independent firm is required before any non-trivial TVL is
deployed. Recommended firms:

- Trail of Bits
- OpenZeppelin
- Certora
- Spearbit

## Bug bounty

A bug bounty program is planned for after the audit. Bounties will be paid in
wTKN. Scope, rules, and reward tiers will be published at
`spg.xyz/security`.

## Disclosure

Please email `security@spg.xyz` for responsible disclosure. **Do not** open
public issues for security vulnerabilities.
