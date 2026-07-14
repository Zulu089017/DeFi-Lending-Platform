# OpenLend — EVM Contracts

Solidity contracts deployed on source chains (Ethereum, Polygon, BSC, etc.) that lock/burn canonical tokens and emit events the off-chain bridge watches.

## Contracts

| Contract | Purpose |
|---|---|
| `Bridge.sol` | Lock/burn entry point, event emission, attester quorum |
| `WrappedToken.sol` | Optional canonical ERC-20 (when source has no native token) |
| `MockERC20.sol` | Test helper |

## Setup

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Deploy (Sepolia)

```bash
cp .env.example .env   # fill in keys
npx hardhat run scripts/deploy.ts --network sepolia
```

## Layout

```
evm-contracts/
├── contracts/
│   ├── Bridge.sol
│   ├── WrappedToken.sol
│   └── mocks/MockERC20.sol
├── scripts/deploy.ts
├── test/
├── hardhat.config.ts
└── package.json
```
