# OpenLend — Dashboard

A Next.js 14 dashboard for the OpenLend protocol. Real-time cross-chain bridge activity, lending markets, positions, and liquidation monitor.

## Features

- 📊 Live cross-chain event feed (wraps, unwraps, liquidations) via WebSocket
- 🌉 One-click wrap from any supported source chain
- 🏦 Supply / borrow / withdraw / repay
- 💥 Liquidation monitor with health-factor visualization
- 📈 Per-market APY and utilization charts
- 🔌 Wallet connect (Freighter for Stellar; WalletConnect for EVM)

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Then open http://localhost:3000.

## Stack

- **Next.js 14** (App Router, RSC, Server Actions)
- **TypeScript**
- **TailwindCSS** + **shadcn/ui**
- **Zustand** for client state
- **TanStack Query** for server state
- **@stellar/stellar-sdk** + **@openlend/sdk** + **ethers**
- **Recharts** for charts
- **Framer Motion** for animations

## Layout

```
frontend/
├── app/
│   ├── (marketing)/
│   │   └── page.tsx                # landing
│   ├── (app)/
│   │   ├── dashboard/page.tsx
│   │   ├── bridge/page.tsx
│   │   ├── lend/page.tsx
│   │   └── liquidations/page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   └── api/                        # route handlers (proxies to /api)
├── components/
│   ├── ui/                         # shadcn primitives
│   ├── bridge/                     # BridgeWidget, ChainPicker
│   ├── lending/                    # SupplyCard, BorrowCard, MarketTable
│   ├── events/                     # EventFeed
│   └── layout/                     # Header, Footer, Sidebar
├── lib/
│   ├── stellar/
│   ├── hooks/
│   ├── stores/
│   └── utils/
├── public/
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```
