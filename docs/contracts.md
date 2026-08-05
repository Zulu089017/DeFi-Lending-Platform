# Contract Documentation

## Soroban Contracts (Rust)

### Lending Pool (`contracts/lending/soroban`)

The core lending protocol contract.

**Entry Points:**

| Function | Args | Returns | Auth |
|----------|------|---------|------|
| `initialize` | `admin: Address` | — | `admin` |
| `add_asset` | `cfg: AssetConfig` | — | `admin` |
| `supply` | `user, asset, amount` | `shares: i128` | `user` |
| `withdraw` | `user, asset, shares` | `amount: i128` | `user` |
| `supply_collateral` | `user, asset, amount` | — | `user` |
| `withdraw_collateral` | `user, asset, amount` | `amount: i128` | `user` |
| `borrow` | `user, asset, amount` | — | `user` |
| `repay` | `user, asset, amount` | `repaid: i128` | `user` |
| `health_factor` | `user, asset` | `hf: i128` | — |
| `debt_of` | `user, asset` | `debt: i128` | — |
| `collateral_of` | `user, asset` | `amount: i128` | — |
| `borrow_apy_bps` | `asset` | `apy: u32` | — |

**AssetConfig:**

```rust
struct AssetConfig {
    asset: Symbol,         // Asset identifier
    collateral_vault: Address,
    oracle: Address,
    ltoken: Address,       // Share token contract
    base_rate_bps: u32,    // 0%
    slope1_bps: u32,       // Below kink slope
    slope2_bps: u32,       // Above kink slope
    kink_bps: u32,         // 80% = 8000
    reserve_factor_bps: u32,
    ltv_bps: u32,          // Max LTV (75% = 7500)
}
```

### Lending Controller (`contracts/lending/controller`)

Orchestrates cross-contract calls for wrap/unwrap operations.

### Collateral Vault (`contracts/collateral/soroban`)

Tracks locked collateral per user per asset.

### Oracle (`contracts/oracle/soroban`)

Price feed contract. Intended to integrate with Chainlink or a Stellar reflect oracle.

### Liquidation Engine (`contracts/liquidation/soroban`)

Permissionless liquidation contract.

**Config:**

```rust
struct LiquidationConfig {
    pool: Address,
    vault: Address,
    oracle: Address,
    bonus_bps: u32,        // 500 = 5%
    fee_bps: u32,          // 2000 = 20% of bonus
    close_factor_bps: u32, // 5000 = 50% max per tx
}
```

### Governance (`contracts/governance/soroban`)

On-chain governance for protocol parameters.

### Rewards (`contracts/rewards/soroban`)

Rewards distribution contract (stub — to be implemented).

---

## EVM Contracts (Solidity)

### Bridge.sol (`contracts/lending/evm/Bridge.sol`)

Upgradeable bridge contract for EVM chains.

**Key Functions:**

- `lock(token, amount, stellarDest, salt)` — Locks tokens, emits `Locked`
- `burn(token, amount, stellarDest, salt)` — Burns wrapped tokens
- `release(token, recipient, amount, stellarTxHash, nonce, signatures)` — Releases tokens on EVM side
- `pause()` / `unpause()` — Emergency controls

**Security:**

- EIP-712 typed data for release signatures
- 2-of-N attester multisig
- ReentrancyGuard (OpenZeppelin 5.x)
- Ownable with two-step transfer

### WrappedToken.sol (`contracts/treasury/evm/WrappedToken.sol`)

ERC-20 token contract representing wrapped assets on EVM chains.

---

## Testing

All contracts have comprehensive test suites:

- **Lending pool**: 18 tests covering supply, borrow, repay, withdraw, health factor invariants
- **Liquidation**: 9 tests covering bonus calculation, close factor, edge cases
- **Governance**: propose/vote/execute flow
- **EVM Bridge**: lock, release, threshold, pause, EIP-712 domain separation

Run tests:

```bash
# Soroban contracts
cd contracts && cargo test --workspace

# EVM contracts
cd contracts && npx hardhat test
```
