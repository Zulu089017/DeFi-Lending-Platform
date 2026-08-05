# Audit Readiness Checklist

> This checklist must be completed before the first formal audit. Status: 🚧 In
> Progress

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
- [x] Invariant tests (17 tests execute and pass on Rust 1.91.0 + soroban-sdk
      27.0.4 — see `stellar-contracts/BUILD_ENV_NOTES.md`; `docs/invariants.md`
      § 9)
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
- [ ] DNS + TLS for `spg.xyz` and `api.spg.xyz`
- [ ] CORS origins restricted (not `*`)
- [ ] Rate limiting enabled on API
- [ ] Monitoring dashboards deployed (Prometheus + Grafana)

## CI toolchain pins

### Slither (`crytic/slither-action@v0.4.0`)

- `slither-version` is pinned to **0.11.4** in `.github/workflows/ci.yml`.
- **Do not raise the pin above 0.11.4** without first updating the CI image: the
  action is built on `python:3.9`, and `slither-analyzer` 0.11.5+ requires
  Python >= 3.10. A newer pin fails the EVM job with
  `No matching distribution found for slither-analyzer==0.11.x`.
- To upgrade Slither: bump the pin, verify the findings locally with
  `slither . --filter-paths "node_modules|openzeppelin" --fail-low`, and (if
  needed) switch to a slither-action build based on Python >= 3.10 before
  raising the pin past 0.11.4.
- Keep `fail-on: low` (it emits `--fail-low`); never pass `--fail-*` flags via
  `slither-args` — the action appends its own `--fail-*` flag and the two
  conflict.

### Rust / Soroban (`stellar-contracts/`)

- The Soroban job pins `dtolnay/rust-toolchain@1.91.0` (the soroban-sdk 27 MSRV)
  with `targets: wasm32v1-none, components: rustfmt, clippy`. Keep the
  `components` input as a single scalar (block style): the earlier flow-style
  `with: { ..., components: rustfmt, clippy }` made GitHub parse `clippy` as a
  separate input key and the Lint step failed with
  `'cargo-clippy' is not installed`.
- **Use the `wasm32v1-none` target for wasm builds.** On Rust 1.82+,
  `wasm32-unknown-unknown` enables `reference-types`/`multi-value` features that
  soroban-sdk 27's `build.rs` rejects; `wasm32v1-none` (Rust 1.84+) is the
  Soroban-native target.
- All cargo commands run with `--locked` against the committed `Cargo.lock`, so
  a crates.io drift cannot silently change the resolved dependency graph.
- `clippy.toml` contains only valid settings (`msrv`, thresholds); lint levels
  are enforced with `-D warnings`, not `clippy.toml` keys.
- Full history and migration notes: `stellar-contracts/BUILD_ENV_NOTES.md`.

### GitHub Actions (`actions/*`, `pnpm/action-setup`)

- `actions/checkout@v5` and `actions/setup-node@v5` are pinned in
  `.github/workflows/ci.yml` and `.github/workflows/release.yml`.
- **Why v5:** the v4 releases target Node.js 20, which GitHub now runs on
  Node.js 24 with a deprecation warning on every job; v5 targets Node.js 24
  natively and has identical inputs (`node-version`, `cache: pnpm|npm`,
  `cache-dependency-path`), so the upgrade was behavior-neutral.
- `pnpm/action-setup@v4` stays on v4 — it is the latest major for that action.
- Policy: keep these actions at their current majors. When a new major ships,
  upgrade deliberately and verify input parity (especially `setup-node`'s
  `cache`/`cache-dependency-path`); upgrading promptly avoids accumulating
  runner deprecation warnings.

## Audit scope

| Component            | Lines of code | Language       | Auditor |
| -------------------- | ------------- | -------------- | ------- |
| `stellar-contracts/` | ~2,500        | Rust (Soroban) | TBD     |
| `evm-contracts/`     | ~400          | Solidity       | TBD     |
| `bridge/`            | ~800          | TypeScript     | TBD     |
| `relayer/`           | ~200          | TypeScript     | TBD     |

## Post-audit

- [ ] All findings triaged (critical/high fixed; medium/low acknowledged)
- [ ] Retest regression suite against fixes
- [ ] Publish audit report
- [ ] Launch bug bounty program
