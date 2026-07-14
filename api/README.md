# OpenLend — API

Public REST + WebSocket API that fronts the protocol. The dashboard and the SDK both talk to this service. It also streams real-time updates from the indexer DB to any connected WebSocket client.

## Endpoints (REST)

- `GET  /health`
- `GET  /v1/wrap-events`
- `GET  /v1/unwrap-events`
- `GET  /v1/lending-events?user=…&asset=…`
- `GET  /v1/markets` — list of supported assets with rates, total supply, total borrow, utilization
- `GET  /v1/markets/:asset` — single market detail
- `GET  /v1/positions/:user` — all open positions for a user
- `GET  /v1/health-factor/:user` — computed health factor
- `POST /v1/quote/wrap` — body: `{ sourceChain, token, amount, stellarDest }` → return fee estimate
- `POST /v1/quote/unwrap` — body: `{ amount, sourceChain, sourceAddr }` → return fee estimate
- `WS   /v1/stream` — push: `wrap`, `unwrap`, `supply`, `borrow`, `repay`, `liquidate` events

## Run

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm dev
```

## Testing

Integration tests use [Vitest](https://vitest.dev/) + [testcontainers](https://node.testcontainers.org/) to spin up a real Postgres 16 in Docker and exercise every JSON route end-to-end via Fastify's in-process `app.inject()`. **Docker is required** — the suite will fail fast with a clear error if `docker info` doesn't succeed.

```bash
# one-time (--legacy-peer-deps is required: `prisma@^5.16.1` and
# `testcontainers@^10.13.0` declare peer ranges that conflict with
# the workspace's resolved versions of `@types/node` and
# `@nomicfoundation/hardhat-toolbox`; the runtime is fine, only the
# strict resolver refuses)
npm install --legacy-peer-deps

# run the suite (23 tests, ~10s on a warm cache)
npm test
```

What's covered:
- `src/tests/markets.test.ts` — `/v1/markets`, `/v1/markets/:asset` (6 tests)
- `src/tests/positions.test.ts` — `/v1/positions/:user`, `/v1/health-factor/:user` (8 tests)
- `src/tests/quote.test.ts` — `/v1/quote/wrap`, `/v1/quote/unwrap` (6 tests)

Helpers in `src/tests/helpers/`:
- `global-setup.ts` — starts the Postgres container, runs `prisma db push`, exports `DATABASE_URL` to the fork pool
- `setup-env.ts` — `setupFile` that asserts `DATABASE_URL` was propagated (clear error if not)
- `db.ts` — `resetDb()` truncates the event tables for per-test isolation
- `seed.ts` — `seedLendingEvent({ type, user, asset, amount })` with monotonic id + txHash counters

In CI, mount `/var/run/docker.sock` (DinD) or set `DOCKER_HOST`. The suite uses `pool: "forks"` + `singleFork: true` to serialise tests against the single shared container.
