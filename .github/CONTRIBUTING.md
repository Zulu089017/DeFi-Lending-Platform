# Contributing to OpenLend

Thanks for your interest in contributing! 🎉

## How to start

1. Fork & clone the repo (or the relevant sub-repo if you've split per `docs/polyrepo.md`).
2. Pick an issue or open one to discuss the change you want to make.
3. Branch from `main`: `git checkout -b feat/my-feature`.
4. Make your change. Add tests. Run lints.
5. Open a PR.

## Subproject conventions

Each subproject is its own package with its own `package.json` / `Cargo.toml`. Please follow the conventions within whichever subproject you're contributing to.

### Soroban contracts (Rust)

- Run `cargo fmt && cargo clippy --all-targets --all-features -- -D warnings`
- Add unit tests inside the contract module
- Add integration tests under `tests/`

### EVM contracts (Solidity)

- Run `npx hardhat test`
- Add coverage for new branches
- Update the deploy script

### TypeScript services

- Use TypeScript strict mode (it's already enabled)
- Run `npx tsc --noEmit`
- Run `npm test`

### Frontend

- Use the existing UI primitives under `components/ui/`
- No new dependencies without discussion
- All interactive elements must be keyboard-accessible

## Security

If you discover a security vulnerability, please **do not** open a public issue. Email `security@openlend.xyz` with details. See [`docs/security.md`](../docs/security.md) for the threat model.

## Code of conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/).
