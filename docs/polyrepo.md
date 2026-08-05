# Polyrepo Split Guide

StellarPay is intentionally a **polyrepo** of independent services. The local
monorepo layout (`/contracts`, `/bridge`, `/api`, etc.) is a development
convenience. In production each one should live in its own repository:

| Path                 | Standalone repo              | Owner team |
| -------------------- | ---------------------------- | ---------- |
| `contracts/` | `spg/contracts` | Protocol   |
| `contracts/`     | `spg/contracts`     | Protocol   |
| `services/payment/`            | `spg/bridge`            | Bridge     |
| `services/cron/`           | `spg/relayer`           | Bridge     |
| `services/services/indexer/`           | `spg/indexer`           | Data       |
| `api/`               | `spg/api`               | Data       |
| `packages/packages/sdk/`               | `spg/sdk`               | SDK        |
| `apps/web/`          | `spg/dashboard`         | Frontend   |
| `infra/`             | `spg/infra`             | DevOps     |
| `docs/`              | `spg/docs`              | Docs       |

## Versioning

All packages use **Semantic Versioning** and are published with deterministic
versions. The `sdk` consumes a **versioned manifest** (see
`packages/packages/sdk/src/manifest.json`) so that a frontend can pin to a known-good set of
contract addresses and ABIs.

## Inter-repo contracts

Subprojects communicate only over:

1. On-chain transactions (Stellar + EVM)
2. Public REST/WS API (`api/`)
3. Postgres tables (shared DB between `indexer` and `api`)

No subproject imports source code from another subproject. This keeps deploys
independent and blast radius small.
