#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Deploy all OpenLend Soroban contracts to Stellar testnet, in the right order.
#
# Prereqs:
#   • stellar-cli (soroban-cli) installed and on PATH
#   • A funded testnet identity: `stellar keys generate deployer --network testnet`
#   • `cargo build --target wasm32-unknown-unknown --release` already run
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
ADMIN="${ADMIN:-$(stellar keys address deployer)}"
SOURCE="${SOURCE:-deployer}"
RPC="https://soroban-testnet.stellar.org"

# Build
echo "▶ Building WASMs..."
cargo build --target wasm32-unknown-unknown --release

# Deploy (in order)
deploy() {
  local name="$1"
  local wasm="$2"
  echo "▶ Deploying $name..."
  stellar contract deploy \
    --wasm "$wasm" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    --rpc-url "$RPC"
}

WA=$(deploy wrapped_asset    "target/wasm32-unknown-unknown/release/wrapped_asset.wasm")
OR=$(deploy oracle           "target/wasm32-unknown-unknown/release/oracle.wasm")
CV=$(deploy collateral_vault "target/wasm32-unknown-unknown/release/collateral_vault.wasm")
LP=$(deploy lending_pool     "target/wasm32-unknown-unknown/release/lending_pool.wasm")
LQ=$(deploy liquidation      "target/wasm32-unknown-unknown/release/liquidation.wasm")
CT=$(deploy lending_controller "target/wasm32-unknown-unknown/release/lending_controller.wasm")

echo ""
echo "✔ Deployments complete:"
echo "  WRAPPED_ASSET=$WA"
echo "  ORACLE=$OR"
echo "  COLLATERAL_VAULT=$CV"
echo "  LENDING_POOL=$LP"
echo "  LIQUIDATION=$LQ"
echo "  LENDING_CONTROLLER=$CT"

# Write addresses to a manifest the SDK and frontend can consume
cat > ../sdk/src/manifest.json <<JSON
{
  "network": "$NETWORK",
  "contracts": {
    "wrapped_asset":    "$WA",
    "oracle":           "$OR",
    "collateral_vault": "$CV",
    "lending_pool":     "$LP",
    "liquidation":      "$LQ",
    "lending_controller": "$CT"
  }
}
JSON

echo "✔ Wrote manifest to ../sdk/src/manifest.json"
