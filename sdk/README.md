# @stellar-payment-gateway/sdk

A TypeScript SDK for the StellarPay protocol. Wrap tokens from any supported
source chain, supply/borrow/liquidate on Stellar, and stream real-time events
from the StellarPay API.

## Install

```bash
pnpm add @stellar-payment-gateway/sdk @stellar/stellar-sdk ethers
```

## Quick start

```ts
import { StellarPay } from "@stellar-payment-gateway/sdk";

const spg = new StellarPay({
  stellar: {
    rpc: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    controllerContract:
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGK3YNS",
    secretKey: process.env.STELLAR_SECRET!,
  },
  evm: {
    ethereum: {
      rpc: process.env.ETH_RPC!,
      bridgeAddress: process.env.ETH_BRIDGE!,
    },
    polygon: {
      rpc: process.env.POLY_RPC!,
      bridgeAddress: process.env.POLY_BRIDGE!,
    },
  },
  api: "https://api.spg.xyz",
});

// Wrap: lock 100 USDC on Ethereum, receive 100 wUSDC on Stellar
const wrap = await spg.wrap({
  sourceChain: "ethereum",
  token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  amount: "100000000", // 6 decimals
  stellarDest: spg.stellar.publicKey,
});
console.log(wrap.sourceTx, "→", await wrap.stellarTx);

// Lend: supply collateral, borrow
await spg.supplyCollateral("XLM", "1000000000"); // 100 XLM
await spg.borrow({
  collateralAsset: "XLM",
  collateralAmount: "1000000000",
  debtAsset: "USDC",
  borrowAmount: "50000000",
});

// Stream live events
const unsub = spg.stream((evt) => {
  if (evt.type === "wrap") console.log("🌉 new wrap", evt.data);
  if (evt.type === "unwrap") console.log("🌉 new unwrap", evt.data);
  if (evt.type === "lending" && evt.data.type === "liquidate")
    console.log("💥 liquidation!", evt.data);
});
```

## API

- `spg.wrap(...)`
- `spg.unwrap(...)`
- `spg.supply(...)`
- `spg.withdraw(...)`
- `spg.borrow(...)`
- `spg.repay(...)`
- `spg.liquidate(borrower, debtAsset, collateralAsset, repayAmount)`
- `spg.markets()` → market list
- `spg.positions(user)` → positions
- `spg.healthFactor(user)` → number
- `spg.stream(handler)` → unsubscribe function

## Manifest

Contract addresses are read from `src/manifest.json` (or the network-specific
`src/manifests/{network}.json`). Update via the deploy scripts in
`stellar-contracts/scripts` and `evm-contracts/scripts`.
