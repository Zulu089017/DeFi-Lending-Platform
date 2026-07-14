# OpenLend — Stellar (Soroban) Contracts

The on-chain core of the OpenLend protocol, written in Rust for [Soroban](https://soroban.stellar.org/) — Stellar's smart-contract runtime.

## Contracts

| Contract | Purpose |
|---|---|
| `wrapped_asset` | Canonical wrapped token (wTKN) — mint/burn driven by the bridge |
| `oracle`       | Price feed aggregator (Reflector / Chainlink reflect) |
| `collateral_vault` | Per-asset collateral accounting |
| `lending_pool` | Supply, borrow, repay, withdraw; interest-rate model |
| `liquidation` | Automated liquidation engine |
| `lending_controller` | Orchestrator + cross-chain entrypoint |

## Build

```bash
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release
```

## Test

```bash
cargo test
```

## Deploy to testnet

```bash
bash scripts/deploy-testnet.sh
```

## Architecture

See [`docs/architecture.md`](../docs/architecture.md) for the full protocol design.

## Layout

```
stellar-contracts/
├── contracts/
│   ├── wrapped_asset/
│   ├── oracle/
│   ├── collateral_vault/
│   ├── lending_pool/
│   ├── liquidation/
│   └── lending_controller/
├── tests/                  # Cross-contract integration tests
├── scripts/                # deploy / upgrade scripts
└── Cargo.toml              # workspace
```
