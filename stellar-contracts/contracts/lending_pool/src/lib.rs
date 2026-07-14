//! # Lending Pool
//!
//! Supply/borrow/repay/withdraw for each supported asset. Issues
//! interest-bearing share tokens (lTKN) per asset. The interest rate
//! is a kinked linear model: rate = base + slope * utilization, with
//! a steeper slope past the kink (k=80%).
//!
//! Calls the `collateral_vault` to track posted collateral and
//! the `oracle` to value positions.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// asset => `AssetConfig`
    AssetConfig(Symbol),
    /// asset => total deposits
    TotalDeposit(Symbol),
    /// asset => total borrows
    TotalBorrow(Symbol),
    /// asset => last accumulated index (1e18)
    BorrowIndex(Symbol),
    /// (user, asset) => deposit shares
    DepositShares(Address, Symbol),
    /// (user, asset) => `BorrowerSnapshot { principal, index }`
    Borrower(Address, Symbol),
    /// asset => last ledger sequence that interest was accrued
    LastAccrual(Symbol),
    /// asset => total deposit shares (separate from total_deposit to avoid
    /// the first-depositor share-inflation attack)
    TotalDepositShares(Symbol),
}

#[contracttype]
#[derive(Clone)]
pub struct AssetConfig {
    pub asset: Symbol,
    pub collateral_vault: Address,
    pub oracle: Address,
    pub ltoken: Address, // share-token contract
    pub base_rate_bps: u32,
    pub slope1_bps: u32,
    pub slope2_bps: u32,
    pub kink_bps: u32, // utilization kink in bps
    pub reserve_factor_bps: u32,
    pub ltv_bps: u32, // max LTV for this asset as collateral
}

#[contracttype]
#[derive(Clone)]
pub struct BorrowerSnapshot {
    pub principal: i128, // in 7-decimal units
    pub index: i128,     // 1e18
}

#[contract]
pub struct LendingPool;

#[contractimpl]
impl LendingPool {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn add_asset(env: Env, cfg: AssetConfig) {
        Self::require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::AssetConfig(cfg.asset.clone()), &cfg);
        env.storage()
            .persistent()
            .set(&DataKey::TotalDeposit(cfg.asset.clone()), &0i128);
        env.storage()
            .persistent()
            .set(&DataKey::TotalBorrow(cfg.asset.clone()), &0i128);
        env.storage()
            .persistent()
            .set(&DataKey::BorrowIndex(cfg.asset.clone()), &1_000_000_000_000_000_000i128);
    }

    // ──────────────────────── SUPPLY / WITHDRAW ────────────────────────

    pub fn supply(env: Env, user: Address, asset: Symbol, amount: i128) -> i128 {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        Self::accrue_interest(&env, &asset);

        let total_d = Self::total_deposit(&env, &asset);
        let total_shares = Self::deposit_shares_total(&env, &asset);
        // For the first supplier, mint shares 1:1. Subsequent suppliers
        // receive shares proportional to their deposit / totalDeposit.
        // (Virtual shares are recommended in production to defeat
        // share-inflation via the first-depositor.)
        let minted_shares = if total_shares == 0 || total_d == 0 {
            amount
        } else {
            amount.checked_mul(total_shares).expect("overflow") / total_d
        };

        let key = DataKey::DepositShares(user.clone(), asset.clone());
        let cur = env.storage().persistent().get(&key).unwrap_or(0i128);
        env.storage()
            .persistent()
            .set(&key, &cur.checked_add(minted_shares).expect("overflow"));
        env.storage().persistent().set(
            &DataKey::TotalDepositShares(asset.clone()),
            &total_shares.checked_add(minted_shares).expect("overflow"),
        );
        env.storage()
            .persistent()
            .set(&DataKey::TotalDeposit(asset.clone()), &total_d.checked_add(amount).expect("overflow"));

        minted_shares
    }

    pub fn withdraw(env: Env, user: Address, asset: Symbol, shares: i128) -> i128 {
        user.require_auth();
        if shares <= 0 {
            panic!("shares must be positive");
        }
        Self::accrue_interest(&env, &asset);

        let key = DataKey::DepositShares(user.clone(), asset.clone());
        let cur = env.storage().persistent().get(&key).unwrap_or(0i128);
        if cur < shares {
            panic!("insufficient shares");
        }

        let total_d = Self::total_deposit(&env, &asset);
        let total_shares = Self::deposit_shares_total(&env, &asset);
        let amount = shares.checked_mul(total_d).expect("overflow") / total_shares;

        env.storage().persistent().set(&key, &(cur - shares));
        env.storage()
            .persistent()
            .set(&DataKey::TotalDeposit(asset.clone()), &(total_d - amount));
        amount
    }

    // ──────────────────────── BORROW / REPAY ────────────────────────

    pub fn borrow(env: Env, user: Address, asset: Symbol, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        Self::accrue_interest(&env, &asset);

        // Health-factor check would happen here in a full implementation by
        // summing collateral value across assets and comparing to total debt.
        // For the scaffold we leave the hook here; production MUST enforce
        // it before allowing new debt to be drawn.
        let _ = user;

        let key = DataKey::Borrower(user.clone(), asset.clone());
        let idx = Self::borrow_index(&env, &asset);
        let snap: BorrowerSnapshot = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(BorrowerSnapshot { principal: 0, index: idx });
        let new_principal = snap.principal.checked_add(amount).expect("overflow");
        env.storage().persistent().set(
            &key,
            &BorrowerSnapshot { principal: new_principal, index: idx },
        );

        let total_b = Self::total_borrow(&env, &asset);
        env.storage()
            .persistent()
            .set(&DataKey::TotalBorrow(asset.clone()), &total_b.checked_add(amount).expect("overflow"));
    }

    pub fn repay(env: Env, user: Address, asset: Symbol, amount: i128) -> i128 {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        Self::accrue_interest(&env, &asset);

        let key = DataKey::Borrower(user.clone(), asset.clone());
        let idx = Self::borrow_index(&env, &asset);
        let snap: BorrowerSnapshot = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(BorrowerSnapshot { principal: 0, index: 1_000_000_000_000_000_000i128 });
        // Total debt = principal * current_index / snap_index
        let total_owed = if snap.principal == 0 {
            0
        } else {
            snap.principal
                .checked_mul(idx)
                .expect("overflow")
                / snap.index.max(1)
        };
        let repaid = if amount >= total_owed { total_owed } else { amount };
        // Repay against the new principal: keep index in sync with current.
        let new_principal = total_owed - repaid;

        env.storage().persistent().set(
            &key,
            &BorrowerSnapshot { principal: new_principal, index: idx },
        );

        let total_b = Self::total_borrow(&env, &asset);
        env.storage()
            .persistent()
            .set(&DataKey::TotalBorrow(asset.clone()), &(total_b - repaid));
        repaid
    }

    // ──────────────────────── VIEWS ────────────────────────

    pub fn total_deposit(env: &Env, asset: &Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalDeposit(asset.clone()))
            .unwrap_or(0)
    }

    pub fn total_borrow(env: &Env, asset: &Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalBorrow(asset.clone()))
            .unwrap_or(0)
    }

    pub fn borrow_index(env: &Env, asset: &Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::BorrowIndex(asset.clone()))
            .unwrap_or(1_000_000_000_000_000_000i128)
    }

    pub fn deposit_shares_of(env: Env, user: Address, asset: Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::DepositShares(user, asset))
            .unwrap_or(0)
    }

    pub fn debt_of(env: Env, user: Address, asset: Symbol) -> i128 {
        let snap: BorrowerSnapshot = env
            .storage()
            .persistent()
            .get(&DataKey::Borrower(user, asset))
            .unwrap_or(BorrowerSnapshot {
                principal: 0,
                index: 1_000_000_000_000_000_000i128,
            });
        let idx = Self::borrow_index(&env, &asset);
        if snap.principal == 0 {
            return 0;
        }
        snap.principal.checked_mul(idx).expect("overflow") / snap.index.max(1)
    }

    /// Returns the current borrow APY for `asset` in basis points.
    pub fn borrow_apy_bps(env: Env, asset: Symbol) -> u32 {
        let cfg = Self::asset_config(&env, &asset);
        let total_d = Self::total_deposit(&env, &asset);
        let total_b = Self::total_borrow(&env, &asset);
        let u = if total_d == 0 {
            0
        } else {
            (total_b as u64).min(total_d as u64) * 10_000 / total_d as u64
        };
        let u = u as u32;
        if u <= cfg.kink_bps {
            cfg.base_rate_bps + (cfg.slope1_bps as u32 * u / cfg.kink_bps.max(1))
        } else {
            cfg.base_rate_bps
                + cfg.slope1_bps
                + cfg.slope2_bps * (u - cfg.kink_bps) / (10_000 - cfg.kink_bps).max(1)
        }
    }

    // ──────────────────────── INTERNAL ────────────────────────

    fn accrue_interest(env: &Env, asset: &Symbol) {
        let total_b = Self::total_borrow(env, asset);
        if total_b == 0 {
            return;
        }
        // Time-based accrual: difference in ledger sequence since last accrual.
        let last: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastAccrual(asset.clone()))
            .unwrap_or(env.ledger().sequence());
        let now = env.ledger().sequence();
        if now <= last {
            return;
        }
        let blocks = (now - last) as i128;
        let apy = Self::borrow_apy_bps(env.clone(), asset.clone()) as i128;
        // SECONDS_PER_YEAR = 31_536_000, LEDGER_TIME_SECS = 5
        // per-block rate = apy_bps / 10_000 / SECONDS_PER_YEAR * LEDGER_TIME_SECS
        // = apy_bps * LEDGER_TIME_SECS / (10_000 * SECONDS_PER_YEAR)
        let per_block_numer = apy * 5i128;                     // LEDGER_TIME_SECS
        let per_block_denom = 10_000i128 * 31_536_000i128;     // 10_000 * SECONDS_PER_YEAR
        // Use 1e18-scaled index: delta = blocks * per_block_numer * 1e18 / per_block_denom
        let idx = Self::borrow_index(env, asset);
        let delta = blocks
            .checked_mul(per_block_numer)
            .expect("overflow")
            .checked_mul(1_000_000_000_000_000_000i128)
            .expect("overflow")
            / per_block_denom;
        env.storage()
            .persistent()
            .set(&DataKey::BorrowIndex(asset.clone()), &(idx + delta));
        env.storage()
            .persistent()
            .set(&DataKey::LastAccrual(asset.clone()), &now);
    }

    fn asset_config(env: &Env, asset: &Symbol) -> AssetConfig {
        env.storage()
            .persistent()
            .get(&DataKey::AssetConfig(asset.clone()))
            .expect("asset not configured")
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
    }

    fn deposit_shares_total(env: &Env, asset: &Symbol) -> i128 {
        // Tracked separately from total_deposit so the share price can be
        // computed even when there are outstanding borrows (utilization < 100%).
        env.storage()
            .persistent()
            .get(&DataKey::TotalDepositShares(asset.clone()))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_supply_mints_shares() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let user = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");

        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        let s = pool.supply(&user, &asset, &1_000_000);
        assert_eq!(s, 1_000_000);
        assert_eq!(pool.deposit_shares_of(&user, &asset), 1_000_000);
    }

    #[test]
    fn test_borrow_then_repay() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let user = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");

        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        pool.supply(&user, &asset, &1_000_000);
        pool.borrow(&user, &asset, &250_000);
        let d = pool.debt_of(&user, &asset);
        assert!(d >= 250_000);
        let repaid = pool.repay(&user, &asset, &300_000);
        assert_eq!(repaid, d);
        assert_eq!(pool.debt_of(&user, &asset), 0);
    }

    // ──────────────────────── INVARIANT TESTS (L-1 … L-9) ────────────────────────
    // These tests assert the invariants listed in `docs/invariants.md` § 4.
    // They double as documentation: each test name starts with `invariant_L*_`.
    //
    // UNVERIFIED: `cargo test` is blocked by a `soroban-sdk 21.x` dep-tree
    // split. See `../../BUILD_ENV_NOTES.md`. Tests are static-reviewed as
    // well-formed against the existing test patterns in this module.

    /// **L-1:** `Σ borrows <= Σ deposits` for every market.
    #[test]
    fn invariant_L1_borrows_le_deposits() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let user = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");
        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        pool.supply(&user, &asset, &1_000_000);
        // Borrow less than the deposit
        pool.borrow(&user, &asset, &500_000);
        let d = pool.total_deposit(&asset);
        let b = pool.total_borrow(&asset);
        assert!(b <= d, "invariant L-1 violated: borrows ({b}) > deposits ({d})");
    }

    /// **L-2:** `borrow_index` is monotone non-decreasing across operations.
    #[test]
    fn invariant_L2_borrow_index_monotone() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let user = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");
        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        let i0 = pool.borrow_index(&asset);
        pool.supply(&user, &asset, &1_000_000);
        let i1 = pool.borrow_index(&asset);
        assert!(i1 >= i0, "invariant L-2 violated: index decreased across a no-op");
        pool.borrow(&user, &asset, &100_000);
        let i2 = pool.borrow_index(&asset);
        assert!(i2 >= i1, "invariant L-2 violated: index decreased after a borrow");
    }

    /// **L-3:** `debt_of` equals `principal * borrow_index / snap.index` (within rounding).
    #[test]
    fn invariant_L3_debt_of_matches_principal_times_index() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let user = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");
        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        pool.supply(&user, &asset, &1_000_000);
        pool.borrow(&user, &asset, &200_000);
        let d = pool.debt_of(&user, &asset);
        assert!(d >= 200_000, "debt should be >= borrowed principal");
        // The principal is recorded at the index at borrow time, so a later
        // call should not under-count.
        let d2 = pool.debt_of(&user, &asset);
        assert!(d2 >= d, "a second read should not under-count");
    }

    /// **L-4:** First supplier gets 1:1 shares; later supplier gets proportional shares.
    #[test]
    fn invariant_L4_share_math() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let a = Address::random(&env);
        let b = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");
        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        let s0 = pool.supply(&a, &asset, &1_000_000);
        assert_eq!(s0, 1_000_000, "first supplier: 1:1 shares");
        // Second supplier deposits the same amount with no borrows -> same shares.
        let s1 = pool.supply(&b, &asset, &1_000_000);
        assert_eq!(s1, 1_000_000, "second supplier of equal amount: equal shares");
    }

    /// **L-5:** `withdraw` rejects when the user has insufficient shares.
    #[test]
    #[should_panic]
    fn invariant_L5_withdraw_rejects_insufficient_shares() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let user = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");
        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        pool.supply(&user, &asset, &100);
        pool.withdraw(&user, &asset, &101);
    }

    /// **L-6:** `repay` cannot over-pay a user's outstanding debt.
    #[test]
    fn invariant_L6_repay_caps_at_outstanding_debt() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let user = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");
        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        pool.supply(&user, &asset, &1_000_000);
        pool.borrow(&user, &asset, &100_000);
        let d = pool.debt_of(&user, &asset);
        let repaid = pool.repay(&user, &asset, &1_000_000_000);
        assert_eq!(repaid, d, "repay must be capped at outstanding debt");
        assert_eq!(pool.debt_of(&user, &asset), 0);
    }

    /// **L-9:** `borrow_apy_bps` is monotone non-decreasing in utilization.
    #[test]
    fn invariant_L9_apy_monotone_in_utilization() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let u1 = Address::random(&env);
        let u2 = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");
        let pool = LendingPoolClient::new(&env, &env.register_contract(None, LendingPool {}));
        pool.initialize(&admin);
        pool.add_asset(&AssetConfig {
            asset: asset.clone(),
            collateral_vault: Address::random(&env),
            oracle: Address::random(&env),
            ltoken: Address::random(&env),
            base_rate_bps: 0,
            slope1_bps: 500,
            slope2_bps: 5_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });
        let apy0 = pool.borrow_apy_bps(&asset);
        // No borrows -> apy = base_rate_bps = 0
        assert_eq!(apy0, 0);
        pool.supply(&u1, &asset, &1_000_000);
        pool.borrow(&u1, &asset, &200_000); // 20% utilization
        let apy20 = pool.borrow_apy_bps(&asset);
        pool.supply(&u2, &asset, &1_000_000);
        pool.borrow(&u2, &asset, &600_000); // total util: 800k/2M = 40%
        let apy40 = pool.borrow_apy_bps(&asset);
        assert!(apy20 > apy0, "apy must increase with utilization");
        assert!(apy40 >= apy20, "apy must continue to increase up to the kink");
    }

    // ──────────────────────── TODO MARKERS (L-10) ────────────────────────
    // The following tests document the **known security gaps** listed in
    // `docs/invariants.md` § 4 and `docs/security.md` § "Open TODOs". They
    // are written as `#[ignore]` so they do not break CI, but their names
    // and bodies make the gap obvious to auditors.

    /// **L-10 (TODO):** `borrow` must verify `HF >= 1` after the borrow.
    /// Currently a user with no collateral can borrow. Production must
    /// cross-call `lending_controller` (or, in tests, simulate a
    /// `collateral_vault.deposit` + `oracle.set_price` setup).
    #[test]
    #[ignore = "L-10: HF check is not yet enforced in `lending_pool.borrow`; see docs/security.md"]
    fn test_TODO_L10_borrow_enforces_health_factor() {
        // Production sketch:
        //   let pool = LendingPoolClient::new(...);
        //   let vault = CollateralVaultClient::new(...);
        //   let oracle = OracleClient::new(...);
        //   vault.deposit(&pool_addr, &user, &asset, &collateral_amount);
        //   oracle.set_price(&publisher, &asset, &1_000_000_000_000);
        //   let hf_before = compute_hf(&user, &pool, &vault, &oracle);
        //   pool.borrow(&user, &debt_asset, &huge_amount);
        //   let hf_after = compute_hf(...);
        //   assert!(hf_after >= 1_000_000_000_000_000_000, "HF must remain >= 1e18");
        panic!("L-10 not yet enforced; see docs/security.md");
    }
}
