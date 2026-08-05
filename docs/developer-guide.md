# Developer Guide

## Prerequisites

- Node.js ≥ 22.5
- pnpm ≥ 10
- Rust ≥ 1.91 with `wasm32v1-none` target
- Docker ≥ 24
- Hardhat (for EVM contracts)

## Repository Structure

```
apps/           # User-facing applications
  web/          # Next.js dashboard
  api/          # Fastify REST + WebSocket API
  dashboard/    # Standalone analytics dashboard
contracts/      # Smart contracts
  lending/      # Lending pool + controller
  collateral/   # Collateral vault
  oracle/       # Price oracle
  liquidation/  # Liquidation engine
  treasury/     # Wrapped assets
  governance/   # Governance
  rewards/      # Rewards distribution
packages/       # Shared libraries
  sdk/          # TypeScript SDK
  utils/        # Shared utilities
services/       # Backend services
  payment/      # Bridge middleware
  cron/         # Transaction relayer
  indexer/      # Event indexer
  notification/ # WebSocket notifications
  analytics/    # TVL analytics
infra/          # Infrastructure
  docker/       # Docker Compose
  kubernetes/   # K8s manifests
  terraform/    # IaC
scripts/        # Build/deploy scripts
docs/           # Documentation
```

## Local Development

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

### 3. Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
cp services/payment/.env.example services/payment/.env
# Edit .env files with your RPC URLs
```

### 4. Build Contracts

```bash
cd contracts
cargo test --workspace
npx hardhat compile
```

### 5. Run Services

```bash
# All services in dev mode
pnpm dev

# Or individually
cd services/payment && pnpm dev
cd apps/api && pnpm dev
cd apps/web && pnpm dev
```

## Testing

```bash
# Run all tests
pnpm test

# Contract tests
cd contracts && cargo test --workspace

# EVM tests
cd contracts && npx hardhat test

# Specific package
pnpm --filter @stellar-payment-gateway/sdk test
```

## Type Checking

```bash
pnpm typecheck
```

## Linting

```bash
pnpm lint
pnpm format:check
```

## Building for Production

```bash
pnpm build
```

## Git Workflow

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): description
fix(scope): description
refactor(scope): description
test(scope): description
docs: description
security: description
perf(scope): description
```

### Pre-commit Hooks

- Husky runs lint-staged on staged files
- Prettier formats code automatically
- Commitlint validates commit messages

### Pre-push Hooks

- TypeScript type checking per service
- Test suites per service

## Adding a New Package

1. Create directory: `packages/my-package/`
2. Add `package.json` with `"name": "@stellar-payment-gateway/my-package"`
3. Add `tsconfig.json` extending `@stellar-payment-gateway/tsconfig`
4. Add to `pnpm-workspace.yaml`
5. Run `pnpm install`

## Adding a New Contract

1. Create directory: `contracts/my-contract/soroban/`
2. Add `Cargo.toml` with workspace deps
3. Add to workspace members in `contracts/Cargo.toml`
4. Run `cargo test` to verify

## API Development

The API uses Fastify with the following conventions:

- Routes in `apps/api/src/routes/`
- Middleware in `apps/api/src/middleware/`
- Tests in `apps/api/src/tests/`
- Prisma schema in `apps/api/prisma/schema.prisma`

## Deployment

See [Deployment Guide](deployment.md) for production deployment instructions.
