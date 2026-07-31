# OpenLend Monitoring & Observability Guide

## Architecture overview

```
  ┌──────────┐    ┌───────────┐    ┌──────────┐
  │  Bridge  │    │  Relayer  │    │ Indexer  │
  │  (TS)    │    │  (TS)     │    │  (TS)    │
  └────┬─────┘    └─────┬─────┘    └────┬─────┘
       │                │               │
       ▼                ▼               ▼
  ┌──────────────────────────────────────────┐
  │              Prometheus                   │
  │  (scrapes /metrics from each service)    │
  └────────────────────┬─────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │    Grafana     │
              │  (dashboards,  │
              │   alerts)      │
              └────────────────┘
```

## Metrics endpoints

Each TypeScript service exposes a `/metrics` endpoint that returns
Prometheus-formatted counters and gauges:

| Service   | Endpoint        | Examples                                          |
| --------- | --------------- | ------------------------------------------------- |
| `bridge`  | `:4100/metrics` | `bridge_mints_total`, `bridge_attest_errors`      |
| `relayer` | `:4200/metrics` | `relayer_submissions_total`, `relayer_gas_used`   |
| `indexer` | `:4300/metrics` | `indexer_events_ingested`, `indexer_lag_seconds`  |
| `api`     | `:4000/metrics` | `http_requests_total`, `http_request_duration_ms` |

## Key metrics to monitor

### Bridge

| Metric                     | Description                                 | Alert if                  |
| -------------------------- | ------------------------------------------- | ------------------------- |
| `bridge_mints_total`       | Total mints processed                       | Drops to zero for > 5 min |
| `bridge_attest_errors`     | Attestation failures                        | Any increase              |
| `bridge_event_lag_seconds` | Time since last observed source-chain event | > 120 s                   |

### Relayer

| Metric                       | Description                       | Alert if                  |
| ---------------------------- | --------------------------------- | ------------------------- |
| `relayer_submissions_total`  | Txs submitted to any chain        | Drops to zero for > 5 min |
| `relayer_failures_total`     | Failed submissions                | > 3 in 5 min              |
| `relayer_pending_queue_size` | Queued txs waiting for submission | > 100                     |

### Indexer

| Metric                    | Description                | Alert if      |
| ------------------------- | -------------------------- | ------------- |
| `indexer_events_ingested` | Events written to Postgres | Drops to zero |
| `indexer_lag_seconds`     | Time behind chain tip      | > 60 s        |

### API

| Metric                                      | Description             | Alert if |
| ------------------------------------------- | ----------------------- | -------- |
| `http_requests_total{status}`               | Requests by status code | 5xx > 0  |
| `http_request_duration_ms{quantile="0.95"}` | p95 latency             | > 500 ms |
| `http_ratelimit_hits_total`                 | Rate-limited requests   | Spike    |

## Alert severity levels

| Level             | Response                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| **P1 — Critical** | Bridge/relayer stopped; mints halted. Page on-call immediately.              |
| **P2 — Warning**  | Elevated error rate, high latency, growing queue. Investigate within 30 min. |
| **P3 — Info**     | Minor metrics anomaly, slow leak. Fix during business hours.                 |

## Logging

All services use **structured logging** via `pino` (JSON format). In production,
logs are shipped to Loki or Datadog.

- **Level**: `info` in production, `debug` for staging.
- **Context**: every log line includes `service`, `env`, and (where applicable)
  `txHash`, `chain`, `address`.
- **Redaction**: never log private keys, attester secrets, or user plaintext
  addresses (log the first 6 chars only for debugging).

## Health endpoints

Every service exposes a `/health` endpoint:

```bash
curl http://localhost:4000/health
# {"ok":true,"service":"openlend-api","uptime":3600}
```

Kubernetes liveness and readiness probes are configured in each pod's manifest.

## Dashboard

A public Grafana dashboard shows real-time protocol health:

- **TVL & volumes** (total supplied, total borrowed, utilization)
- **Bridge activity** (mints, burns, releases per chain, per day)
- **Liquidation events** (count, volume, health factor distribution)
- **Node health** (block height, peer count, sync status)
