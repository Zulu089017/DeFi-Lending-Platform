# Changelog

All notable changes to OpenLend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- **Closed invariant B-7** (EIP-712 for `Bridge.release`): the on-chain
  digest is now a proper EIP-712 typed-data hash
  (`keccak256("\x19\x01" || domainSeparator || structHash)`) using
  `OpenZeppelin`'s `EIP712Upgradeable` and a pinned
  `RELEASE_TYPEHASH = keccak256("Release(address token,address recipient,uint256 amount,bytes32 stellarTxHash,uint256 nonce)")`.
  This prevents cross-chain and cross-contract replay attacks. Off-chain
  counterpart: `bridge/src/attest/signer.ts` → `signEvmRelease()`. A
  regression test (`release rejects signatures signed for a different
  domain (B-7)`) in `evm-contracts/test/Bridge.test.ts` proves the
  domain binding works.

### Added
- `SECURITY.md` and `CHANGELOG.md` at the repository root.
- `.github/CODEOWNERS` for default reviewers.
- `.github/dependabot.yml` for npm, cargo, and GitHub Actions ecosystems.
- `stellar-contracts/rustfmt.toml` and `clippy.toml` for consistent Rust style.
- `stellar-contracts/rust-toolchain.toml` pinning the Soroban workspace
  to Rust 1.81.0 (avoids the `zeroize 1.9.0` `edition2024` requirement
  that forces Rust >= 1.85). Does **not** fix the deeper
  `rand_core`/`ed25519-dalek` split — see `stellar-contracts/BUILD_ENV_NOTES.md`.
- `docs/invariants.md` documenting protocol invariants for auditors.
- `stellar-contracts/BUILD_ENV_NOTES.md` documenting the known
  `cargo test --workspace` dep-resolution blocker and the two real
  paths forward (bump `soroban-sdk` to 22+, or use Docker with a
  pre-baked `Cargo.lock`).
- 18 new `invariant_*` tests in `stellar-contracts/contracts/*/src/lib.rs`
  (W-1, L-1..L-9, C-2/C-4, O-1/O-2/O-3, V-1..V-5, Q-3/Q-4) and
  `test_TODO_*` stubs for the documented security gaps. The tests are
  well-formed but cannot be executed in this environment until the
  dep-tree issue is resolved; see `BUILD_ENV_NOTES.md`.
- Expanded EVM `Bridge.test.ts` with release, threshold, and pause tests.
- Expanded `sdk` tests with config, supply, and chain-id coverage.

### Changed
- `.github/workflows/ci.yml` pins `dtolnay/rust-toolchain@1.81.0` in
  the `stellar-contracts` job (was `@stable`, which would also fail
  on 1.97+).
- `evm-contracts/contracts/Bridge.sol` now uses `OpenZeppelin`'s `ECDSA` and
  `MessageHashUtils` libraries instead of a custom signature-recovery
  implementation.
- `sdk/src/client.ts` adds the missing `supplyCollateral` method so it
  matches the documented API and `sdk/README.md`.
- `bridge/src/attest/signer.ts` adds `OPENLEND_EIP712_DOMAIN`,
  `RELEASE_EIP712_TYPES`, and `signEvmRelease()` (uses
  `ethers.Wallet.signTypedData`) to produce the matching secp256k1
  signatures consumed by `Bridge.release`.
- `@openzeppelin/hardhat-upgrades@^3.9.0` dev dep + `evmVersion: "cancun"`
  in `hardhat.config.ts` (OZ 5.x's `Bytes.sol` uses the `mcopy` opcode,
  EIP-5656 in the Cancun upgrade).

### Changed
- `evm-contracts/contracts/Bridge.sol` now inherits OZ 5.x's
  `ReentrancyGuard` (ERC-7201 namespaced storage) in place of the
  removed `ReentrancyGuardUpgradeable`. The new guard is
  `@custom:stateless` and does not shift the contract's linear storage
  layout, so this change is storage-layout-safe for new deployments.
- `evm-contracts/scripts/deploy.ts` now uses `upgrades.deployProxy`
  (previously called `initialize()` directly on the implementation,
  which fails with `InvalidInitialization()` in OZ 5.x). New env vars
  `PROXY_ADMIN_ADDRESS` and `OWNER_ADDRESS` let production deploys
  point the ERC-1967 admin and the `Ownable` owner at a multisig; the
  script transfers both ownerships post-deploy and prints a warning if
  either is left as the deployer EOA on a non-hardhat network.
- `evm-contracts/test/Bridge.test.ts` `deploy()` helper now uses
  `upgrades.deployProxy` for the same reason; added a B-7 cross-domain
  replay test that forges sigs against a fake bridge address and
  confirms the on-chain EIP-712 wrapping reverts with
  `Bridge__NotAttester`.

## [0.1.0] — 2026-01-15

### Added
- Initial scaffold of OpenLend.
- Soroban contracts: `wrapped_asset`, `oracle`, `collateral_vault`,
  `lending_pool`, `liquidation`, `lending_controller`.
- EVM contracts: `Bridge.sol` (upgradeable, 2-of-N attester multisig),
  `WrappedToken.sol`, `MockERC20.sol`.
- Off-chain services: `bridge`, `relayer`, `indexer`, `api`.
- TypeScript SDK: `sdk` (`@openlend/sdk`).
- Next.js 14 dashboard: landing, dashboard, bridge, lend, liquidations.
- K8s manifests and Docker Compose for local development.
- Documentation: architecture, security, deployment, polyrepo, API, SDK.
