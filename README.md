# OpenLend

> A decentralized cross-chain lending protocol with automated liquidation, built on Stellar's ultra-fast, low-fee network.

**OpenLend** is a middleware that allows developers on other chains (Ethereum, Solana, Polygon) to instantly spin up wrapped versions of their tokens on Stellar. These wrapped assets can then be used in a fully on-chain lending protocol featuring automated liquidation, powered by Stellar's near-instant settlement.

---

## 🌍 Why OpenLend?

| Pain Point | OpenLend Solution |
|---|---|
| High gas fees on Ethereum/Solana | Mint wrapped assets on Stellar for ~$0.000005 / tx |
| Slow cross-chain bridging | Near-instant settlement via Stellar's consensus |
| Liquidity fragmentation | Single canonical wrapped-asset hub on Stellar |
| Manual liquidations | Fully automated liquidation engine on Soroban |
| Opaque bridge state | Real-time Horizon stream → live dashboard |

---

## 🏗️ Polyrepo Layout

OpenLend is composed of **independent, loosely-coupled subprojects**. Each one is a self-contained unit with its own build, test, and deploy pipeline. Together they form the protocol.

```
OpenLend/
│
├── stellar-contracts/   # Soroban smart contracts (Rust) — the heart of the protocol
├── evm-contracts/       # Solidity contracts — source-chain lock/burn entry points
├── bridge/              # Cross-chain bridge middleware (TS) — event watcher + mint/burn signer
├── relayer/             # Transaction relayer service (TS) — submits signed ops to all chains
├── indexer/             # Off-chain indexer (TS) — streams Horizon + EVM logs into Postgres
├── api/                 # Public REST + WebSocket API (TS) — serves the dashboard & SDK
├── sdk/                 # TypeScript SDK — wrap, lend, borrow, liquidate, stream events
├── frontend/            # Next.js dashboard — real-time cross-chain & lending UI
├── infra/               # Docker Compose, K8s manifests, Terraform
├── docs/                # Protocol documentation
└── .github/             # CI workflows, issue & PR templates
```

> **Note**: Each top-level directory is designed to live in its own git repository. The monorepo layout here is for local development and orchestration. See `docs/polyrepo.md` for the recommended split.

---

## 🚀 Quick Start (local dev)

```bash
# 1. Spin up infra (Postgres, Redis, Horizon testnet stub)
cd infra && docker compose up -d

# 2. Build & deploy Soroban contracts
cd stellar-contracts && cargo test && bash scripts/deploy-testnet.sh

# 3. Deploy EVM contracts (Sepolia)
cd ../evm-contracts && npm install && npx hardhat deploy --network sepolia

# 4. Start the bridge
cd ../bridge && pnpm install && pnpm dev

# 5. Start the indexer
cd ../indexer && pnpm install && pnpm dev

# 6. Start the API
cd ../api && pnpm install && pnpm dev

# 7. Start the dashboard
cd ../frontend && pnpm install && pnpm dev
```

Visit:
- Dashboard → http://localhost:3000
- API → http://localhost:4000
- Horizon testnet → https://horizon-testnet.stellar.org

---

## 🧱 Architecture at a Glance

```
┌──────────────┐    lock/burn     ┌────────────────┐
│   Ethereum   │ ───────────────▶ │                │
│   Polygon    │                  │  Bridge        │   attest
│   Solana     │                  │  Middleware    │ ───────▶ ┌────────────┐
└──────────────┘                  │  (off-chain)   │           │  Stellar   │
                                  └────────────────┘           │  (Soroban) │
                                          │                    │  Mint wTKN │
                                          │ events             └────────────┘
                                          ▼                          │
                                  ┌────────────────┐                 │ events
                                  │   Indexer      │ ◀───────────────┘ (Horizon)
                                  │   (Postgres)   │
                                  └────────────────┘
                                          │
                                          ▼
                                  ┌────────────────┐    WS    ┌────────────┐
                                  │   API          │ ───────▶ │ Frontend   │
                                  │   (REST+WS)    │          │ (Next.js)  │
                                  └────────────────┘          └────────────┘
```

**On Stellar (Soroban):**
- `wrapped_asset` — canonical wrapped token contract
- `lending_pool` — supply/borrow/withdraw/repay
- `collateral_vault` — locked collateral accounting
- `oracle` — price feeds (Chainlink/Stellar reflect oracle)
- `liquidation` — automated liquidation engine
- `lending_controller` — orchestrates the above

**On source chains (EVM/Solana):**
- `Bridge.sol` / `bridge.ts` — locks or burns the canonical token
- Emits `Locked` / `Burned` events that the off-chain bridge watches

---

## 📚 Documentation

- [Architecture Deep Dive](docs/architecture.md)
- [Polyrepo Guide](docs/polyrepo.md)
- [API Reference](docs/api.md)
- [SDK Reference](docs/sdk.md)
- [Deployment Guide](docs/deployment.md)
- [Security Model](docs/security.md)

---

## 🤝 Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md). PRs welcome.

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE).
