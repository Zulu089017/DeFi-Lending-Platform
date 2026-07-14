# Security Policy

> **OpenLend is currently in a scaffold stage and has not been audited.** The contracts and off-chain services in this monorepo are reference implementations intended for testnet usage. Do not deposit real assets.

## Reporting a vulnerability

Please **do not** file public issues for security bugs.

Email **security@openlend.xyz** with:

- A clear description of the issue and impact (e.g. loss of funds, DoS, key compromise).
- A reproducible proof-of-concept, test case, or set of steps.
- The affected subproject and version (`stellar-contracts`, `evm-contracts`, `bridge`, `relayer`, `indexer`, `api`, `sdk`, `frontend`).
- Your name / handle if you'd like to be credited in the disclosure timeline.

We aim to acknowledge within **3 business days** and to issue a fix or mitigation within **30 days** for critical-severity issues.

## Supported versions

| Subproject | Audited | Maintained |
|---|---|---|
| `stellar-contracts` | ❌ (planned) | ✅ latest tag |
| `evm-contracts`     | ❌ (planned) | ✅ latest tag |
| `bridge`, `relayer`, `indexer`, `api`, `sdk`, `frontend` | ❌ (planned) | ✅ latest tag |

Only the latest tagged release of each subproject receives security fixes.

## Threat model, mitigations, and known TODOs

See [`docs/security.md`](docs/security.md) for the full threat model and the
list of known placeholders that must be closed before any non-trivial TVL is
deployed. See [`docs/invariants.md`](docs/invariants.md) for the protocol
invariants an audit will check.

## Bug bounty

A bug bounty program is planned for after the first independent audit. Scope,
rules, and reward tiers will be published at `openlend.xyz/security`.

## Disclosure timeline

We follow a **coordinated disclosure** model: a 90-day window from report to
public disclosure, with extensions only by mutual agreement.
