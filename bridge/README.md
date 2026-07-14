# OpenLend — Bridge Middleware

Off-chain TypeScript service that watches `Locked` / `Burned` events on source chains (Ethereum, Polygon, Solana) and submits mint transactions to the Soroban `lending_controller` to mint wrapped tokens.

## How it works

```
┌──────────────────┐  Locked  ┌──────────────────┐  wrap()  ┌──────────────┐
│  EVM chain       │ ───────▶ │  Bridge          │ ───────▶ │  Soroban     │
│  Bridge.sol      │          │  middleware      │          │  Controller  │
└──────────────────┘          │  (this service)  │          └──────────────┘
                              └──────────────────┘                 │
                                     ▲                              │ Unwrap
                                     │                              ▼
                              ┌──────────────────┐           ┌──────────────┐
                              │  Indexer/DB      │ ◀──────── │  Horizon     │
                              │  (event store)   │           │  (Stellar)   │
                              └──────────────────┘           └──────────────┘
```

## Key features

- Pluggable chain handlers (`src/chains/`)
- Idempotent — replays of the same Stellar tx are safe
- Multi-attester quorum signing (2-of-3 default)
- Backed by Postgres for replay-protection and state
- Graceful shutdown & reorg handling

## Run

```bash
pnpm install
cp .env.example .env   # fill in
pnpm dev
```

## Layout

```
bridge/
├── src/
│   ├── index.ts                 # entrypoint
│   ├── config.ts
│   ├── chains/
│   │   ├── ethereum.ts
│   │   ├── polygon.ts
│   │   ├── solana.ts
│   │   └── stellar.ts
│   ├── attest/
│   │   ├── signer.ts
│   │   └── quorum.ts
│   ├── mint/
│   │   └── stellarMinter.ts
│   ├── store/
│   │   └── db.ts                # Prisma
│   ├── utils/
│   └── types.ts
├── prisma/schema.prisma
├── tests/
├── package.json
├── tsconfig.json
└── Dockerfile
```
