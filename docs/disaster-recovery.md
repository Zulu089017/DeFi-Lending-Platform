# Disaster Recovery Runbook

> How to recover StellarPay services from common failure scenarios.

## Severity classification

| Level             | Definition                                   | Example                         |
| ----------------- | -------------------------------------------- | ------------------------------- |
| **P1 — Critical** | Bridge halted; no mints/withdrawals possible | Mainnet bridge pod crash-looped |
| **P2 — Major**    | One chain affected; relay lagging > 10 min   | Polygon watcher stuck on reorg  |
| **P3 — Minor**    | Non-critical service degraded; API slow      | Indexer lag, stale dashboard    |

## Scenario 1: Bridge pod crashloop

**Symptoms**: `kubectl get pods -n spg` shows bridge pod restarting.

**Recovery**:

1. Check logs: `kubectl logs -n spg deploy/bridge --tail=100`
2. Common causes: RPC endpoint unreachable, invalid env var, DB connection
   refused.
3. If RPC is down: switch to backup RPC by updating the ConfigMap and rolling
   the deployment.
4. If DB is down: follow Postgres recovery (Scenario 4).
5. If the pod still won't start after fixing the root cause, scale down and back
   up: \
   `kubectl scale deploy/bridge -n spg --replicas=0 && sleep 5 && kubectl scale deploy/bridge -n spg --replicas=1`

## Scenario 2: Source-chain reorg

**Symptoms**: indexer shows gaps; API returns inconsistent data.

**Recovery**:

1. Pause the bridge: `bridge.setPaused(true)` via admin tx.
2. Identify the reorg depth from the RPC node: \
   `cast block <number> --rpc-url <RPC>`
3. Roll back the indexer cursor by N blocks: \
   `UPDATE cursors SET block = block - N WHERE chain = '<chain>';`
4. Restart the indexer pod. It replays the corrected blocks.
5. Unpause the bridge once the indexer has caught up.

## Scenario 3: Attester key compromise

**Symptoms**: unexpected mints, alerts from the rate-limit circuit breaker.

**Recovery** (within 15 min):

1. Immediately pause the bridge controller on Stellar: \
   `lending_controller.set_paused(true)` (requires admin multisig).
2. Rotate the compromised key: update the attester set on the EVM `Bridge`
   contract.
3. Update attester config in the bridge deployment (ConfigMap).
4. Audit all mints in the window between compromise and pause.
5. Unpause only after confirming no malicious mints occurred.

## Scenario 4: Postgres failure

**Symptoms**: all services return DB errors.

**Recovery**:

1. Verify DB is reachable: `psql $DATABASE_URL -c "SELECT 1"`
2. If the primary is down, promote the replica: \
   `patronictl switchover <cluster>` (if using Patroni).
3. If using managed Postgres (RDS, Cloud SQL), failover is automatic.
4. After recovery, restart all dependent pods: \
   `kubectl rollout restart deploy -n spg`

## Scenario 5: Oracle stale

**Symptoms**: `lending_pool` reverts with "price stale"; liquidations frozen.

**Recovery**:

1. Check oracle publishers are running: `kubectl logs deploy/oracle-publisher`
2. Manually push a price update via the admin key if the publisher is down:
   `oracle.set_price(asset, price)`.
3. Restart the oracle publisher pod.

## Scenario 6: Full protocol pause

Use when: security vulnerability, unprecedented market event, or coordinated
upgrade.

1. **Pause EVM bridges**: call `Bridge.setPaused(true)` on each chain
   (multisig).
2. **Pause Stellar controller**: call `lending_controller.set_paused(true)`
   (multisig).
3. **Pause API writes**: toggle the `API_READ_ONLY=true` env var.
4. Communicate via Twitter/Discord/status page.

## Emergency contacts

| Role                       | Name | Contact                    |
| -------------------------- | ---- | -------------------------- |
| On-call engineer (primary) | —    | @spg-oncall on Signal |
| Protocol lead              | —    | —                          |
| Security lead              | —    | —                          |

> This runbook should be printed and accessible even if GitHub is unreachable.
