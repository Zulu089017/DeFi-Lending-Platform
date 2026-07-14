# Protocol Invariants

> Invariants are properties of the system that must hold in **every reachable state**, for every input, on every block. This document is the canonical list an audit will check against. Each invariant references the contract(s) it lives in and the test that exercises it.

## Notation

- `Σ` — total supply of an asset
- `D` — total deposits in a market
- `B` — total borrows in a market
- `S` — total deposit shares
- `U` — utilization, `U = B / D`
- `C[u, a]` — collateral balance of user `u` in asset `a`
- `P[u, a]` — debt (principal × index / snap.index) of user `u` in asset `a`
- `HF[u]` — health factor of user `u`

## 1. Wrapped Asset (`wrapped_asset`)

| # | Invariant | Type |
|---|---|---|
| W-1 | `Σ_wTKN = sum over all accounts of balance` | Conservation |
| W-2 | `Σ_wTKN >= 0` always (no `mint` ever reduces supply) | Monotone-increasing supply |
| W-3 | A `burn` that is not authorised by the holder reverts | Access control |
| W-4 | Only the configured `minter` may call `mint` | Access control |
| W-5 | `initialize` is callable exactly once | One-shot |
| W-6 | `mint`/`burn` amounts are `> 0` | Input validation |

## 2. Oracle (`oracle`)

| # | Invariant | Type |
|---|---|---|
| O-1 | A `set_price` from a non-publisher reverts | Access control |
| O-2 | A `get_price` for an asset that is stale reverts (stale = `now - updated_at > heartbeat`) | Liveness |
| O-3 | `set_price` with `price <= 0` reverts | Input validation |
| O-4 | `value_of(asset, amount) == amount * get_price(asset) / 10^7` (definition) | Algebraic |
| O-5 | Only the admin can add a publisher or change an asset config | Access control |

## 3. Collateral Vault (`collateral_vault`)

| # | Invariant | Type |
|---|---|---|
| V-1 | `total_by_asset(a) = sum over all users of position(u, a)` | Conservation |
| V-2 | `withdraw` cannot reduce a position below zero | Solvency |
| V-3 | Only an operator may `deposit`, `withdraw`, or `seize` | Access control |
| V-4 | `seize` transfers value atomically: `from` loses `amount`, `to` gains `amount` | Conservation |
| V-5 | `set_liq_threshold` rejects `bps > 10_000` | Input validation |

## 4. Lending Pool (`lending_pool`)

| # | Invariant | Type |
|---|---|---|
| L-1 | `Σ B <= Σ D` for every market (protocol is fully collateralised) | Solvency |
| L-2 | `borrow_index(asset)` is monotone non-decreasing | Monotonicity |
| L-3 | `debt_of(u, a) = principal(u, a) * borrow_index(a) / snap.index(u, a)` | Algebraic |
| L-4 | First supplier receives shares `1:1`; later suppliers receive proportional shares | Share math |
| L-5 | `withdraw` rejects if the user has insufficient shares | Input validation |
| L-6 | `repay` does not over-pay a user's outstanding debt | Bounded repayment |
| L-7 | `total_deposit_shares(asset) >= 0` always | Storage safety |
| L-8 | `accrue_interest` does not change `total_borrow` | Interest is index-based, not principal-based |
| L-9 | `borrow_apy_bps` is continuous across the kink (within rounding) | Rate model |
| L-10 | **(TODO, production)** `borrow` must verify `HF(u) >= 1` after the borrow | Risk control |

> ⚠️ The scaffold does **not** enforce L-10. See `docs/security.md` § "Open TODOs" and the `test_TODO_*` test stubs in `stellar-contracts/contracts/*/src/lib.rs`.

## 5. Liquidation Engine (`liquidation`)

| # | Invariant | Type |
|---|---|---|
| Q-1 | `liquidate(borrower, ...)` reverts if `HF(borrower) >= 1` | Only-liquidate-underwater |
| Q-2 | `liquidate` reverts if `repay_amount > close_factor_bps / 10_000 * debt_of(borrower, debt_asset)` | Close-factor |
| Q-3 | `liquidator_share = repay + bonus - fee`, where `fee = fee_bps * bonus / 10_000` | Algebraic |
| Q-4 | The protocol never receives more than `fee_bps * bonus / 10_000` of seized collateral | Fee bounded |
| Q-5 | **(TODO, production)** The on-chain engine must cross-call `lending_pool.repay` and `collateral_vault.seize` in a single transaction | Atomicity |
| Q-6 | **(TODO, production)** `lending_pool.repay` must succeed before `collateral_vault.seize` runs | Ordering |

## 6. Lending Controller (`lending_controller`)

| # | Invariant | Type |
|---|---|---|
| C-1 | `wrap` is callable only with a valid ed25519 attestation from the registered bridge pubkey | Access control |
| C-2 | A `wrap` with a `salt` that has already been used reverts | Replay protection |
| C-3 | The rate of `wrap` calls cannot exceed `MAX_PER_HOUR` over a rolling window | Circuit breaker |
| C-4 | When `paused = true`, all user-facing entry points revert | Pause surface |
| C-5 | `set_bridge` and `set_paused` are admin-only | Access control |
| C-6 | `(chain_id, source_addr, amount, to, salt, nonce)` is bound to the attestation | Domain separation |
| C-7 | **(TODO, production)** `wrap` must actually cross-call `wrapped_asset.mint(to, amount)` | Cross-contract integration |
| C-8 | **(TODO, production)** `supply_collateral` and `borrow` must cross-call the lending pool and collateral vault | Cross-contract integration |

## 7. Bridge (`Bridge.sol`)

| # | Invariant | Type |
|---|---|---|
| B-1 | `lock` rejects a `salt` that has already been used | Replay protection |
| B-2 | `lock` rejects an amount outside `[min, max]` for the configured token | Limits |
| B-3 | `release` requires `>= threshold` distinct attester signatures | Quorum |
| B-4 | `release` rejects duplicate signatures from the same attester | Uniqueness |
| B-5 | The `attester` set cannot be `threshold == length` (must be strict-less) | Quorum sanity |
| B-6 | `setPaused(true)` halts all `lock`/`burn`/`release` calls | Pause surface |
| B-7 | `release` uses **EIP-712** (domain `OpenLend Bridge` / `1`, type `Release(address,address,uint256,bytes32,uint256)`); replays across chains / contracts / versions revert | Domain separation |

> ✅ **Closed (2026-01).** `Bridge` now inherits `EIP712Upgradeable`,
> the `RELEASE_TYPEHASH` is pinned in storage, and `_hashTypedDataV4`
> replaces the raw `keccak256(abi.encodePacked("RELEASE", ...))` digest.
> Off-chain counterpart: `bridge/src/attest/signer.ts` →
> `signEvmRelease`. A regression test (`release rejects signatures
> signed for a different domain (B-7)` in
> `evm-contracts/test/Bridge.test.ts`) proves cross-contract replay
> protection. **Note:** `EIP712Upgradeable` is now in the inheritance
> chain. On any pre-existing proxy deployment, this requires a
> storage-layout-compatible upgrade path (or a redeploy). For new
> deployments the layout is finalised in this contract version.

## 8. Cross-system invariants

| # | Invariant | Type |
|---|---|---|
| X-1 | `Σ_wTKN_on_stellar == total canonical tokens locked + burned on EVM/source chains` | Backing |
| X-2 | Every `wrap` event on Stellar corresponds to exactly one `Locked` or `Burned` event on a source chain (within confirmation depth) | Causality |
| X-3 | Every `unwrap` event on Stellar results in exactly one `Released` event on the destination chain | Causality |
| X-4 | The canonical API `/v1/markets` total-supply numbers equal the on-chain `lending_pool.total_deposit` summed across assets | View consistency |

## 9. How auditors will check these

1. **Property-based testing.** The `cargo test` suite will be extended with `proptest`-style randomised flows that assert each invariant after every operation.
2. **Symbolic execution.** `certora` or `mythril` will be run on the Soroban WASM and the Solidity bytecode to assert the invariant predicates.
3. **Manual review.** The contract-level `*_TODO_*` markers in code point auditors at the specific lines that still need human review.

> **⚠️ Status of the invariant tests in this repo.** The 18 `invariant_*` tests
> across `stellar-contracts/contracts/*/src/lib.rs` are **static-reviewed
> as well-formed** (they mirror existing test patterns verbatim and use
> only standard Soroban test-client APIs) but have **not been executed**.
> The current `soroban-sdk 21.x` dependency tree has a fundamental split
> between two `ed25519-dalek` majors and `elliptic-curve` that prevents
> `cargo test --workspace` from resolving. See
> [`stellar-contracts/BUILD_ENV_NOTES.md`](../stellar-contracts/BUILD_ENV_NOTES.md)
> for the two real paths forward (bump `soroban-sdk` to 22+, or use
> Docker with a pre-baked `Cargo.lock`). Once the build is unblocked,
> these tests should pass without modification.
