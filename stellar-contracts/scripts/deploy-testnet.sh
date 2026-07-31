#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Deploy all OpenLend Soroban contracts to Stellar testnet.
#
# Thin wrapper around deploy-testnet.mjs (stellar-sdk v16, no stellar CLI
# required). Builds the WASMs for wasm32v1-none first, then runs the JS
# deployer which handles friendbot funding, upload, create, initialize,
# on-chain verification and writes sdk/src/manifest.json + stellar.toml +
# frontend/public/.well-known/stellar.toml.
#
#   bash scripts/deploy-testnet.sh
#
# Requires:
#   • Rust toolchain with the wasm32v1-none target installed
#     (see BUILD_ENV_NOTES.md)
#   • `node` + `@stellar/stellar-sdk` v16 (resolved via the `sdk` package)
#   • Secrets in stellar-contracts/.env (gitignored; auto-generated if absent)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "▶ Building WASMs (wasm32v1-none, release)..."
cargo build --workspace --locked --target wasm32v1-none --release

echo "▶ Deploying to testnet via stellar-sdk v16..."
node "${ROOT}/stellar-contracts/scripts/deploy-testnet.mjs"

echo "✔ Done. Artifacts written:"
echo "  • ${ROOT}/sdk/src/manifest.json"
echo "  • ${ROOT}/stellar.toml"
echo "  • ${ROOT}/frontend/public/.well-known/stellar.toml (SEP-1 hosted copy)"
