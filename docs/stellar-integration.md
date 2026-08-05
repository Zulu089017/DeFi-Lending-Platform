# StellarPay Stellar Integration Guide

> How StellarPay follows Stellar Ecosystem Proposals (SEPs) and integrates with
> the Stellar network.

## SEP Compliance

| SEP                                                                                       | Title                         | Status                            |
| ----------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------- |
| [SEP-0001](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md) | stellar.toml                  | ✅ Implemented                    |
| [SEP-0005](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md) | Key Derivation                | N/A                               |
| [SEP-0007](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md) | URI Scheme                    | ✅ Planned                        |
| [SEP-0010](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) | Stellar Authentication        | N/A                               |
| [SEP-0024](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md) | Hosted Deposit and Withdrawal | ⏳ Planned (for fiat on/off-ramp) |
| [SEP-0038](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md) | Anchor RFQ API                | N/A                               |
| [SEP-0040](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0040.md) | Oracle Consumer Interface     | ⏳ Planned                        |
| [SEP-0041](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) | Soroban Token Interface       | ✅ Uses Soroban Token SDK         |

## Stellar Network Configuration

### Testnet

| Parameter          | Value                                 |
| ------------------ | ------------------------------------- |
| Network Passphrase | `Test SDF Network ; September 2015`   |
| Horizon RPC        | `https://horizon-testnet.stellar.org` |
| Soroban RPC        | `https://soroban-testnet.stellar.org` |
| Friendbot          | `https://friendbot.stellar.org`       |

### Mainnet (Production)

| Parameter          | Value                                            |
| ------------------ | ------------------------------------------------ |
| Network Passphrase | `Public Global Stellar Network ; September 2015` |
| Horizon RPC        | `https://horizon.stellar.org`                    |
| Soroban RPC        | `https://soroban-mainnet.stellar.org`            |

## Wallet Integration

StellarPay supports the following Stellar wallets:

| Wallet                                  | Status       | Notes                      |
| --------------------------------------- | ------------ | -------------------------- |
| [Freighter](https://www.freighter.app/) | ✅ Supported | Browser extension          |
| [xBull](https://xbull.app/)             | ✅ Supported | Browser extension + mobile |
| [Lobstr](https://lobstr.co/)            | ⏳ Planned   | Mobile + web               |
| [Albedo](https://albedo.link/)          | ⏳ Planned   | Identity-based             |

## Soroban Contract Deployment

The StellarPay contracts are deployed as Soroban **WASM** contracts on the Stellar
network. Each contract is independently upgradeable by the `lending_controller`
admin (with timelock + multisig in production).

Deployment is fully scripted (no stellar CLI required):

1. Build the WASMs for `wasm32v1-none`
   (`cargo build --workspace --target wasm32v1-none --release`).
2. Run `bash contracts/scripts/deploy-testnet.sh` — the JS deployer
   (`deploy-testnet.mjs`, stellar-sdk v16) funds the admin via friendbot,
   uploads the six WASMs, creates the seven contracts, initializes them in
   dependency order, and verifies each contract's on-chain instance storage.
3. Contract IDs are deterministic
   (`sha256(HashIdPreimage::ContractId{ network_id, preimage})` with salt =
   `sha256(saltLabel)`), so re-runs are resumable and idempotent.
4. Secrets (admin + 3 attester keypairs) live in `contracts/.env`
   (gitignored) and are auto-generated on first run.

Contract addresses are published in `packages/packages/sdk/src/manifest.json`, the project's
`stellar.toml`, and the SEP-1 hosted copy at
`apps/web/public/.well-known/stellar.toml` (served by the frontend at
`/.well-known/stellar.toml` with `Access-Control-Allow-Origin: *` so wallets and
explorers can fetch it cross-origin). Validate with
`python3 contracts/scripts/validate-sep1.py stellar.toml`, which checks
TOML structure, StrKey checksums, and live on-chain existence of every listed
contract.

## Event Streaming

StellarPay uses Stellar Horizon's **transaction streaming** to observe contract
events in near-real-time:

1. The `indexer` service subscribes to Horizon's
   `/accounts/{CONTROLLER}/operations` SSE stream.
2. Each `invokeHostFunction` operation is parsed and persisted to Postgres.
3. The `api` WebSocket layer pushes filtered events to subscribed clients.

## Stellar Asset Information

Wrapped tokens (`wETH`, `wUSDC`, etc.) and deposit tokens (`lETH`, `lUSDC`,
etc.) are issued on Stellar and described in the project's
[`stellar.toml`](../stellar.toml) (SEP-0001). Each asset entry includes the
issuer, asset code, name, description, and display decimals.
