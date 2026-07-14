# Polyrepo Split Guide

OpenLend is intentionally a **polyrepo** of independent services. The local monorepo layout (`/stellar-contracts`, `/bridge`, `/api`, etc.) is a development convenience. In production each one should live in its own repository:

| Path | Standalone repo | Owner team |
|---|---|---|
| `stellar-contracts/` | `openlend/stellar-contracts` | Protocol |
| `evm-contracts/` | `openlend/evm-contracts` | Protocol |
| `bridge/` | `openlend/bridge` | Bridge |
| `relayer/` | `openlend/relayer` | Bridge |
| `indexer/` | `openlend/indexer` | Data |
| `api/` | `openlend/api` | Data |
| `sdk/` | `openlend/sdk` | SDK |
| `frontend/` | `openlend/dashboard` | Frontend |
| `infra/` | `openlend/infra` | DevOps |
| `docs/` | `openlend/docs` | Docs |

## Versioning

All packages use **Semantic Versioning** and are published with deterministic versions. The `sdk` consumes a **versioned manifest** (see `sdk/src/manifest.json`) so that a frontend can pin to a known-good set of contract addresses and ABIs.

## Inter-repo contracts

Subprojects communicate only over:
1. On-chain transactions (Stellar + EVM)
2. Public REST/WS API (`api/`)
3. Postgres tables (shared DB between `indexer` and `api`)

No subproject imports source code from another subproject. This keeps deploys independent and blast radius small.
