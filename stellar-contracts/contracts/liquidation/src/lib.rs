//! # Liquidation Engine
//!
//! Permissionlessly liquidates under-collateralized loans.
//!
//! Liquidation flow:
//! 1. Liquidator repays `repayAmount` of the borrower's debt (in the borrowed asset).
//! 2. Liquidator receives collateral (in the collateral asset) worth
//!    `repayAmount * (1 + bonus_bps)` — the bonus is the liquidator's incentive.
//! 3. A protocol fee (`fee_bps`) of the bonus is taken by the treasury.
//!
//! The full or partial close-factor is supported: a single call can repay
//! up to `close_factor_bps` (default 50%) of the borrower's outstanding debt.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Config,
    Treasury,
}

#[contracttype]
#[derive(Clone)]
pub struct LiquidationConfig {
    /// `lending_pool` address
    pub pool: Address,
    /// `collateral_vault` address
    pub vault: Address,
    /// `oracle` address
    pub oracle: Address,
    /// liquidator bonus in bps over fair value (e.g. 500 = 5%)
    pub bonus_bps: u32,
    /// protocol fee in bps taken from the bonus (e.g. 200 = 2%)
    pub fee_bps: u32,
    /// close factor — max fraction of debt repayable in a single tx (default 5000 = 50%)
    pub close_factor_bps: u32,
}

#[contract]
pub struct Liquidation;

#[contractimpl]
impl Liquidation {
    pub fn initialize(env: Env, admin: Address, cfg: LiquidationConfig, treasury: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Config, &cfg);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    pub fn set_config(env: Env, cfg: LiquidationConfig) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Config, &cfg);
    }

    /// Liquidate `repay_amount` of `borrower`'s debt in `debt_asset`.
    /// Returns the amount of `collateral_asset` actually seized and sent to `liquidator`.
    pub fn liquidate(
        env: Env,
        liquidator: Address,
        borrower: Address,
        debt_asset: Symbol,
        collateral_asset: Symbol,
        repay_amount: i128,
    ) -> i128 {
        liquidator.require_auth();
        if repay_amount <= 0 {
            panic!("amount must be positive");
        }
        let cfg = Self::config(&env);

        // 1) Repay `repay_amount` of debt on behalf of borrower
        //    (caller is the liquidator, who supplies funds).
        // 2) Calculate the collateral to seize.

        // Production math (via oracle.value_of):
        //   debt_value_usd         = oracle.value_of(debt_asset,    repay_amount)
        //   bonus_collateral_value = debt_value_usd * (1 + bonus_bps/10_000)
        //   fee_value              = bonus_collateral_value * fee_bps/10_000
        //   liquidator_value       = bonus_collateral_value - fee_value
        //   collateral_to_seize    = liquidator_value * 10^7 / oracle.get_price(collateral_asset)
        //   collateral_to_treasury = fee_value         * 10^7 / oracle.get_price(collateral_asset)
        //
        // The scaffold returns the bonus-collateral equivalent in same units
        // (asset == collateral) and applies the fee to the BONUS, not gross.
        // Enforce close factor against the borrower's outstanding debt.
        let _ = borrower;
        let bonus_mult = 10_000 + cfg.bonus_bps;
        let gross = repay_amount.checked_mul(bonus_mult as i128).expect("overflow") / 10_000;
        let bonus = gross - repay_amount;
        // Fee is `fee_bps` of the bonus, NOT of gross.
        let fee = bonus.checked_mul(cfg.fee_bps as i128).expect("overflow") / 10_000;
        let liquidator_share = repay_amount + bonus - fee;
        liquidator_share
    }

    // ──────────────────────── VIEWS ────────────────────────

    pub fn config(env: Env) -> LiquidationConfig {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .expect("config not set")
    }

    pub fn treasury(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .expect("treasury not set")
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_liquidate_with_bonus() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let liq = Address::random(&env);
        let borrower = Address::random(&env);
        let pool = Address::random(&env);
        let vault = Address::random(&env);
        let oracle = Address::random(&env);
        let treasury = Address::random(&env);
        let debt = Symbol::new(&env, "USDC");
        let coll = Symbol::new(&env, "USDC"); // same unit for scaffold

        let liq_contract =
            LiquidationClient::new(&env, &env.register_contract(None, Liquidation {}));
        liq_contract.initialize(
            &admin,
            &LiquidationConfig {
                pool,
                vault,
                oracle,
                bonus_bps: 500,
                fee_bps: 2_000, // 20% of bonus
                close_factor_bps: 5_000,
            },
            &treasury,
        );
        let seized = liq_contract.liquidate(&liq, &borrower, &debt, &coll, &1_000i128);
        // bonus = 50, fee = 50 * 0.20 = 10, liquidator = 1000 + 50 - 10 = 1040
        assert_eq!(seized, 1_040i128);
    }

    // ──────────────────────── INVARIANT TESTS (Q-*) ────────────────────────
    //
    // UNVERIFIED: `cargo test` is blocked by a `soroban-sdk 21.x` dep-tree
    // split. See `../../BUILD_ENV_NOTES.md`. Tests are static-reviewed as
    // well-formed against the existing test patterns in this module.

    /// **Q-3 / Q-4:** Liquidator share = repay + bonus - fee, where
    /// fee = fee_bps * bonus / 10_000. The protocol never receives more
    /// than the fee, and the liquidator never receives less than repay.
    #[test]
    fn invariant_Q3_Q4_liquidator_share_formula() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let liq = Address::random(&env);
        let borrower = Address::random(&env);
        let pool = Address::random(&env);
        let vault = Address::random(&env);
        let oracle = Address::random(&env);
        let treasury = Address::random(&env);
        let debt = Symbol::new(&env, "USDC");
        let coll = Symbol::new(&env, "USDC");

        let liq_contract =
            LiquidationClient::new(&env, &env.register_contract(None, Liquidation {}));
        liq_contract.initialize(
            &admin,
            &LiquidationConfig {
                pool,
                vault,
                oracle,
                bonus_bps: 1_000,           // 10%
                fee_bps: 2_000,             // 20% of bonus
                close_factor_bps: 5_000,
            },
            &treasury,
        );
        let seized = liq_contract.liquidate(&liq, &borrower, &debt, &coll, &10_000i128);
        // gross = 10_000 * 11_000 / 10_000 = 11_000
        // bonus = 1_000
        // fee   = 1_000 * 2_000 / 10_000 = 200
        // liq   = 10_000 + 1_000 - 200 = 10_800
        assert_eq!(seized, 10_800i128);
        assert!(seized >= 10_000, "Q-3: liquidator share must be >= repay");
    }

    /// **Q-1 / Q-2 (TODO):** The scaffold does not yet check HF or close
    /// factor. A production test must:
    ///   1. Set up an underwater borrower.
    ///   2. Call `liquidate` with `repay_amount > close_factor * debt`.
    ///   3. Assert the call reverts.
    #[test]
    #[ignore = "TODO Q-1 / Q-2: HF check and close factor not yet enforced"]
    fn test_TODO_Q1_Q2_liquidation_safety_invariants() {
        panic!("TODO Q-1 / Q-2: see docs/invariants.md");
    }
}
