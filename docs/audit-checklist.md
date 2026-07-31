# Audit Readiness Checklist

> This checklist must be completed before the first formal audit.
> Status: 🚧 In Progress

## Pre-audit requirements

### Code freeze

- [ ] All planned features implemented and merged to `main`.
- [ ] No open feature PRs.
- [ ] Tagged release candidate (e.g., `v0.2.0-rc1`).

### Documentation

- [x] Architecture overview (`docs/architecture.md`)
- [x] Protocol invariants (`docs/invariants.md`)
- [x] Security model & threat model (`docs/security.md`)
- [x] Deployment guide (`docs/deployment.md`)
- [ ] Formal specification of the rate model (linear/kinked)
- [ ] Formal specification of the liquidation bonus calculation
- [ ] Formal specification of the oracle aggregation (median of N)
- [ ] Cross-chain state machine diagram for wrap/unwrap lifecycle

### Testing

- [x] Unit tests for each Soroban contract function
- [x] Invariant tests (18 tests documented, build blocked — see
  `stellar-contracts/BUILD_ENV_NOTES.md`)
- [x] Bridge unit tests (Solidity, attest signing)
- [ ] Fuzz tests for Soroban financial math
- [ ] Property-based tests (e.g., `proptest` for Rust)
- [ ] Integration tests for full wrap → lend → borrow → liquidate flow
- [ ] E2E tests across testnet (Ethereum Sepolia → Stellar Testnet)
- [ ] Load test: 1000 concurrent users
- [x] API integration tests (vitest + testcontainers, 23 tests)
- [ ] Chaos tests: kill bridge mid-flight, verify recovery

### Static analysis

- [x] `cargo clippy` with deny lints
- [x] Slither on EVM contracts
- [ ] `cargo audit` for known Rust vulnerabilities
- [ ] `npm audit` for known TS vulnerabilities
- [ ] Formal verification (Certora / Move Prover style)

### Key management

- [ ] Attester keys stored in HSM or KMS (not plaintext env vars)
- [ ] Admin multisig keys documented and access-controlled
- [ ] Key rotation procedure tested
- [ ] Disaster recovery runbook published and tested

### Deployment configuration

- [ ] All contract addresses pinned in `sdk/src/manifest.json`
- [ ] `stellar.toml` published and verified
- [ ] DNS + TLS for `openlend.xyz` and `api.openlend.xyz`
- [ ] CORS origins restricted (not `*`)
- [ ] Rate limiting enabled on API
- [ ] Monitoring dashboards deployed (Prometheus + Grafana)

## Audit scope

| Component | Lines of code | Language | Auditor |
|---|---|---|---|
| `stellar-contracts/` | ~2,500 | Rust (Soroban) | TBD |
| `evm-contracts/` | ~400 | Solidity | TBD |
| `bridge/` | ~800 | TypeScript | TBD |
| `relayer/` | ~200 | TypeScript | TBD |

## Post-audit

- [ ] All findings triaged (critical/high fixed; medium/low
  acknowledged)
- [ ] Retest regression suite against fixes
- [ ] Publish audit report
- [ ] Launch bug bounty program
