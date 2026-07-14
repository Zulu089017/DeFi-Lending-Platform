# OpenLend Architecture

This document is the canonical reference for how the OpenLend protocol is designed and how its components talk to each other.

## 1. Goals

1. **Cross-chain wrapping** — let any token on Ethereum / Solana / Polygon exist as a Stellar-native wrapped asset (`wTKN`) without bespoke contracts per token.
2. **Lending on Stellar** — supply, borrow, repay, withdraw, and liquidate against the wrapped assets, with ultra-low fees and ~5-second finality.
3. **Automated liquidation** — no human in the loop. Any position whose health factor drops below 1.0 is liquidatable permissionlessly.
4. **Real-time transparency** — every cross-chain mint, supply, borrow, and liquidation is observable live via Horizon streaming and pushed to the dashboard over WebSockets.

## 2. Component Map

| Component | Language | Lives where | Responsibility |
|---|---|---|---|
| Stellar contracts | Rust (Soroban) | `stellar-contracts/` | Wrapped asset, lending pool, collateral vault, oracle, liquidation |
| EVM bridge | Solidity | `evm-contracts/` | Lock/burn canonical token, emit cross-chain events |
| Solana bridge | Rust (Anchor) | (future) | Lock/burn SPL token, emit events |
| Bridge middleware | TypeScript | `bridge/` | Watches source-chain events, signs & submits mint/burn attestations to Stellar |
| Relayer | TypeScript | `relayer/` | Submits signed transactions to all chains with retries & gas bumps |
| Indexer | TypeScript | `indexer/` | Subscribes to Horizon + EVM RPC, persists to Postgres |
| API | TypeScript (Fastify) | `api/` | Public REST + WebSocket API for SDK & dashboard |
| SDK | TypeScript | `sdk/` | Client library: `openlend.wrap(...)`, `openlend.lend(...)`, etc. |
| Frontend | TypeScript (Next.js) | `frontend/` | Dashboard, bridge UI, lending UI, liquidation monitor |

## 3. Token Lifecycle

### Wrap (inbound to Stellar)
1. User calls `Bridge.lock(amount, stellarDest, salt)` on the source chain.
2. `Bridge` locks the canonical tokens in its contract and emits `Locked(sender, amount, dest, salt, nonce)`.
3. Bridge middleware catches the event, validates it, and signs an attestation.
4. Relayer submits a Soroban transaction calling `lending_controller.wrap(...)`.
5. Soroban contract mints `wTKN` to the user's Stellar account.
6. Horizon emits the mint; indexer stores it; WebSocket pushes it to the dashboard.

### Unwrap (outbound from Stellar)
1. User calls `lending_controller.unwrap(amount, sourceChain, sourceAddr)` on Stellar.
2. Soroban contract burns `wTKN` and emits `UnwrapInitiated(user, amount, chain, addr, nonce)`.
3. Bridge middleware catches the event and signs a release attestation.
4. Relayer submits a tx on the source chain calling `Bridge.release(addr, amount, sig)`.
5. Source chain sends canonical tokens to the user.

## 4. Lending Lifecycle

- **Supply** — user deposits `wTKN` (or any supported asset) into `lending_pool`. They receive `lTKN` shares (interest-bearing).
- **Borrow** — user supplies collateral (≥ 150% LTV by default), then borrows other assets. A `Loan` record is created.
- **Accrue** — interest accrues per block on borrows using a linear/kinked rate model.
- **Health factor** — `HF = (collateral_value * liq_threshold) / debt_value`. If `HF < 1.0`, the position is liquidatable.
- **Liquidate** — anyone calls `liquidation.liquidate(loanId, repayAmount)`. The liquidator repays debt, receives discounted collateral, and a 5% protocol fee is taken.

## 5. Security Model

- Bridge contracts are upgradeable via a 24h timelock + multisig.
- Bridge attesters are an off-chain quorum (2-of-3) of independent relayers.
- All Soroban admin functions are gated by the `lending_controller` with role-based access.
- A circuit-breaker pauses minting if the rate of mints exceeds `MAX_MINT_RATE` per hour.
- See [`security.md`](./security.md) for the full threat model.

## 6. Data Flow

```
Source chain ──events──▶ Bridge ──attest──▶ Relayer ──tx──▶ Soroban
   ▲                                                  │
   │                                                  ▼
   └────release tx ◀── attest ◀── Relayer ◀── events Horizon
```
