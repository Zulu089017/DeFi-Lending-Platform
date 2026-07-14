# OpenLend — Relayer

A small service that takes signed transactions from the bridge or off-chain users and submits them to the appropriate chain with retry, gas-bump, and nonce-management logic.

## Responsibilities

- Submit pre-signed `wrap` calls to Stellar with proper sequence-number management
- Submit pre-signed `release` calls to EVM chains with EIP-1559 gas bumps
- Persist submission receipts to Postgres for the indexer

## Run

```bash
pnpm install
cp .env.example .env
pnpm dev
```
