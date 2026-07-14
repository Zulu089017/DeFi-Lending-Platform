# @openlend/sdk

A TypeScript SDK for the OpenLend protocol. Wrap tokens from any supported source chain, supply/borrow/liquidate on Stellar, and stream real-time events from the OpenLend API.

## Install

```bash
pnpm add @openlend/sdk @stellar/stellar-sdk ethers
```

## Quick start

```ts
import { OpenLend } from "@openlend/sdk";

const openlend = new OpenLend({
  stellar: {
    rpc: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    controllerContract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGK3YNS",
    secretKey: process.env.STELLAR_SECRET!,
  },
  evm: {
    ethereum: { rpc: process.env.ETH_RPC!, bridgeAddress: process.env.ETH_BRIDGE! },
    polygon:  { rpc: process.env.POLY_RPC!, bridgeAddress: process.env.POLY_BRIDGE! },
  },
  api: "https://api.openlend.xyz",
});

// Wrap: lock 100 USDC on Ethereum, receive 100 wUSDC on Stellar
const wrap = await openlend.wrap({
  sourceChain: "ethereum",
  token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  amount: "100000000", // 6 decimals
  stellarDest: openlend.stellar.publicKey,
});
console.log(wrap.sourceTx, "→", await wrap.stellarTx);

// Lend: supply collateral, borrow
await openlend.supplyCollateral("XLM", "1000000000"); // 100 XLM
await openlend.borrow({ collateralAsset: "XLM", collateralAmount: "1000000000", debtAsset: "USDC", borrowAmount: "50000000" });

// Stream live events
const unsub = openlend.stream((evt) => {
  if (evt.type === "wrap") console.log("🌉 new wrap", evt.data);
  if (evt.type === "unwrap") console.log("🌉 new unwrap", evt.data);
  if (evt.type === "lending" && evt.data.type === "liquidate") console.log("💥 liquidation!", evt.data);
});
```

## API

- `openlend.wrap(...)`
- `openlend.unwrap(...)`
- `openlend.supply(...)`
- `openlend.withdraw(...)`
- `openlend.borrow(...)`
- `openlend.repay(...)`
- `openlend.liquidate(borrower, debtAsset, collateralAsset, repayAmount)`
- `openlend.markets()` → market list
- `openlend.positions(user)` → positions
- `openlend.healthFactor(user)` → number
- `openlend.stream(handler)` → unsubscribe function

## Manifest

Contract addresses are read from `src/manifest.json` (or the network-specific
`src/manifests/{network}.json`). Update via the deploy scripts in
`stellar-contracts/scripts` and `evm-contracts/scripts`.
