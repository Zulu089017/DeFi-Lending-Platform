# SDK Reference

`@openlend/sdk` is the official TypeScript client.

## Install

```bash
pnpm add @openlend/sdk @stellar/stellar-sdk ethers
```

## Initialize

```ts
import { OpenLend } from "@openlend/sdk";

const openlend = new OpenLend({
  stellar: {
    rpc: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    controllerContract: "C...",
    secretKey: process.env.STELLAR_SECRET!,
  },
  evm: {
    ethereum: { rpc: process.env.ETH_RPC!, bridgeAddress: process.env.ETH_BRIDGE! },
    polygon:  { rpc: process.env.POLY_RPC!, bridgeAddress: process.env.POLY_BRIDGE! },
  },
  api: "https://api.openlend.xyz",
});
```

## Wrap

```ts
const { sourceTx, stellarTx } = await openlend.wrap({
  sourceChain: "ethereum",
  token: "0xA0b8...", // USDC
  amount: "100000000", // 100 USDC (6 decimals)
  stellarDest: openlend.stellar.publicKey,
});
const stellarHash = await stellarTx; // resolves when the wrap is observed
```

## Unwrap

```ts
const { stellarTx } = await openlend.unwrap({
  amount: "100000000",
  sourceChain: "ethereum",
  sourceAddr: "0xA0b8...",
});
```

## Lend / Borrow

```ts
await openlend.supply("XLM", "1000000000");
await openlend.borrow({
  collateralAsset: "XLM",
  collateralAmount: "1000000000",
  debtAsset: "USDC",
  borrowAmount: "50000000",
});
await openlend.repay("USDC", "50000000");
```

## Liquidate

```ts
await openlend.liquidate({
  borrower: "G...",
  debtAsset: "USDC",
  collateralAsset: "XLM",
  repayAmount: "12500000",
});
```

## Read API

```ts
const markets = await openlend.markets();
const positions = await openlend.positions("G...");
const hf = await openlend.healthFactor("G...");
```

## Live stream

```ts
const unsub = openlend.stream((evt) => {
  if (evt.type === "lending" && evt.data.type === "liquidate") {
    console.log("💥 liquidation!", evt.data);
  }
});

// Later
unsub();
```

## Manifest

Contract addresses are read from `src/manifest.json`. The deploy scripts in `stellar-contracts/scripts/deploy-testnet.sh` and `evm-contracts/scripts/deploy.ts` update this file automatically.
