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
