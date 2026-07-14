# OpenLend — Indexer

Subscribes to **Horizon** (Stellar), **EVM RPC logs** (Ethereum/Polygon), and **Solana program logs** to build a queryable Postgres mirror of every OpenLend event.

The indexer is read-only and idempotent — it can be safely re-run from any cursor.

## Events indexed

| Event | Source | Schema table |
|---|---|---|
| `wrap`            | Stellar (Horizon) | `wrap_event` |
| `unwrap`          | Stellar (Horizon) | `unwrap_event` |
| `mint` / `burn`   | Stellar           | `w_token_event` |
| `supply` / `borrow` / `repay` / `liquidate` | Stellar | `lending_event` |
| `Locked` / `Burned` / `Released` | EVM | `bridge_event` |

## Run

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm dev
```

The HTTP API is also exposed (see `src/api.ts`) — used by the OpenLend dashboard.
