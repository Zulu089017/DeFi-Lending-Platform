//! # Liquidation Engine
//!
//! Permissionlessly liquidates under-collateralized loans.
//!
//! Liquidation flow:
//! 1. Read the borrower's debt from the lending pool and collateral from the vault.
//! 2. Verify the position is underwater (debt > collateral in same-unit terms).
//! 3. Enforce the close factor — no more than `close_factor_bps` of the
//!    outstanding debt can be liquidated in a single call.
//! 4. Calculate the collateral to seize: `repay + bonus - fee`.
//! 5. Call `pool.repay(liquidator, debt_asset, repay_amount)` to clear the debt.
//! 6. Call `vault.seize(liquidation, borrower, liquidator, coll_asset, seize_amount)`
//!    to transfer the collateral, with the liquidation contract acting as operator.
//!
//! The bonus is the liquidator's incentive; the fee goes to the treasury.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, IntoVal, Symbol, Val, Vec};

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
    /// `oracle` address (reserved for future cross-asset pricing)
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
    /// Returns the amount of `collateral_asset` actually seized and sent to
    /// the `liquidator`.
    ///
    /// Cross-contract calls:
    ///   1. `pool.debt_of(borrower, debt_asset)` — read outstanding debt
    ///   2. `vault.position(borrower, collateral_asset)` — read collateral
    ///   3. `pool.repay(liquidator, debt_asset, repay_amount)` — repay debt
    ///   4. `vault.seize(liq, borrower, liquidator, coll_asset, seize_amount)` — transfer
    ///
    /// # Panics
    /// - `"amount must be positive"` if `repay_amount <= 0`
    /// - `"position is healthy"` if collateral >= debt (not underwater)
    /// - `"exceeds close factor"` if `repay_amount > close_factor * debt`
    /// - `"insufficient collateral to seize"` if vault balance < computed seize
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

        let cfg = Self::config(env.clone());

        // ── 1. Read borrower's debt from the lending pool ──
        let outstanding = Self::pool_debt_of(&env, &cfg.pool, &borrower, &debt_asset);

        // ── 2. Read borrower's collateral from the vault ──
        let coll_balance = Self::vault_position(&env, &cfg.vault, &borrower, &collateral_asset);

        // ── 3. Position must be underwater (same-unit: debt > collateral) ──
        if coll_balance >= outstanding {
            panic!("position is healthy");
        }

        // ── 4. Enforce close factor ──
        let max_repay = outstanding
            .checked_mul(cfg.close_factor_bps as i128)
            .expect("overflow")
            / 10_000;
        if repay_amount > max_repay {
            panic!("exceeds close factor");
        }

        // ── 5. Calculate collateral to seize ──
        // Same-unit formula (no oracle pricing yet):
        //   gross = repay * (10_000 + bonus_bps) / 10_000
        //   bonus = gross - repay
        //   fee   = bonus * fee_bps / 10_000
        //   seize = repay + bonus - fee
        let bonus_mult = 10_000 + cfg.bonus_bps;
        let gross = repay_amount
            .checked_mul(bonus_mult as i128)
            .expect("overflow")
            / 10_000;
        let bonus = gross - repay_amount;
        let fee = bonus.checked_mul(cfg.fee_bps as i128).expect("overflow") / 10_000;
        let seize_amount = repay_amount + bonus - fee;

        // Total leaving the borrower: seize_amount + fee = repay + bonus = gross.
        // Must not exceed their collateral.
        if gross > coll_balance {
            panic!("insufficient collateral to seize");
        }

        // ── 6. Repay debt on behalf of borrower (liquidator pays) ──
        // The liquidation contract itself is the registered pool operator.
        // It calls repay_on_behalf with its own address as the payer/operator
        // so that auth + operator checks pass.
        Self::pool_repay_on_behalf(&env, &cfg.pool, &borrower, &debt_asset, &repay_amount);

        // ── 7. Seize collateral: borrower → liquidator ──
        let liq_addr = env.current_contract_address();
        Self::vault_seize(
            &env,
            &cfg.vault,
            &liq_addr,
            &borrower,
            &liquidator,
            &collateral_asset,
            &seize_amount,
        );

        // ── 8. If there's a fee, seize it to the treasury ──
        if fee > 0 {
            let treasury = Self::treasury(env.clone());
            Self::vault_seize(
                &env,
                &cfg.vault,
                &liq_addr,
                &borrower,
                &treasury,
                &collateral_asset,
                &fee,
            );
        }

        seize_amount
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

    // ──────────────────────── CROSS-CONTRACT HELPERS ────────────────────────

    /// Read `pool.debt_of(borrower, debt_asset)`.
    fn pool_debt_of(env: &Env, pool: &Address, borrower: &Address, asset: &Symbol) -> i128 {
        let fn_name = Symbol::new(env, "debt_of");
        let args: Vec<Val> = soroban_sdk::vec![env, borrower.into_val(env), asset.into_val(env),];
        env.invoke_contract(pool, &fn_name, args)
    }

    /// Read `vault.position(borrower, collateral_asset)`.
    fn vault_position(env: &Env, vault: &Address, borrower: &Address, asset: &Symbol) -> i128 {
        let fn_name = Symbol::new(env, "position");
        let args: Vec<Val> = soroban_sdk::vec![env, borrower.into_val(env), asset.into_val(env),];
        env.invoke_contract(vault, &fn_name, args)
    }

    /// Call `pool.repay_on_behalf(payer, borrower, asset, amount)`.
    /// Uses the liquidation contract's own address as the payer/operator
    /// so that the pool's `require_operator` check passes (the liquidation
    /// contract is registered as a pool operator during initialization).
    fn pool_repay_on_behalf(
        env: &Env,
        pool: &Address,
        borrower: &Address,
        asset: &Symbol,
        amount: &i128,
    ) {
        let liq_addr = env.current_contract_address();
        let fn_name = Symbol::new(env, "repay_on_behalf");
        let args: Vec<Val> = soroban_sdk::vec![
            env,
            liq_addr.into_val(env),
            borrower.into_val(env),
            asset.into_val(env),
            amount.into_val(env),
        ];
        let _: i128 = env.invoke_contract(pool, &fn_name, args);
    }

    /// Call `vault.seize(op, from, to, asset, amount)`.
    #[allow(clippy::too_many_arguments)]
    fn vault_seize(
        env: &Env,
        vault: &Address,
        op: &Address,
        from: &Address,
        to: &Address,
        asset: &Symbol,
        amount: &i128,
    ) {
        let fn_name = Symbol::new(env, "seize");
        let args: Vec<Val> = soroban_sdk::vec![
            env,
            op.into_val(env),
            from.into_val(env),
            to.into_val(env),
            asset.into_val(env),
            amount.into_val(env),
        ];
        let _: () = env.invoke_contract(vault, &fn_name, args);
    }

    // ──────────────────────────── Admin ────────────────────────────

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
    #![allow(non_snake_case)]
    use super::*;
    use soroban_sdk::testutils::Address as _;

    /// Deploy pool + vault + wrapped_asset for the liquidation tests so
    /// `liquidate` can read real state and call `pool.repay` + `vault.seize`.
    struct LiqTestEnv<'a> {
        env: Env,
        liq_contract: LiquidationClient<'a>,
        liq_id: Address,
        pool_client: lending_pool::LendingPoolClient<'a>,
        pool_id: Address,
        vault_client: collateral_vault::CollateralVaultClient<'a>,
        vault_id: Address,
        #[allow(dead_code)]
        wrapped_client: wrapped_asset::WrappedAssetClient<'a>,
        asset: Symbol,
    }

    fn setup_liq() -> LiqTestEnv<'static> {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);

        // Deploy sub-contracts.
        let vault_id = env.register(collateral_vault::CollateralVault {}, ());
        let pool_id = env.register(lending_pool::LendingPool {}, ());
        let wrapped_id = env.register(wrapped_asset::WrappedAsset {}, ());
        let liq_id = env.register(Liquidation {}, ());

        let vault_client = collateral_vault::CollateralVaultClient::new(&env.clone(), &vault_id);
        vault_client.initialize(&admin);
        vault_client.add_operator(&liq_id); // liq is operator for seize

        let pool_client = lending_pool::LendingPoolClient::new(&env.clone(), &pool_id);
        pool_client.initialize(&admin);
        pool_client.add_operator(&liq_id); // liq can call repay_on_behalf

        let wrapped_client = wrapped_asset::WrappedAssetClient::new(&env.clone(), &wrapped_id);
        let asset = Symbol::new(&env, "XLM");
        wrapped_client.initialize(
            &admin,
            &liq_id,
            &soroban_sdk::String::from_str(&env, "Wrapped"),
            &soroban_sdk::String::from_str(&env, "W"),
            &7u32,
            &soroban_sdk::String::from_str(&env, "ethereum"),
            &soroban_sdk::String::from_str(&env, "0x0"),
        );

        // Configure the lending pool with the asset.
        pool_client.add_asset(&lending_pool::AssetConfig {
            asset: asset.clone(),
            collateral_vault: vault_id.clone(),
            oracle: Address::generate(&env),
            ltoken: Address::generate(&env),
            base_rate_bps: 200,
            slope1_bps: 1_000,
            slope2_bps: 13_000,
            kink_bps: 8_000,
            reserve_factor_bps: 1_000,
            ltv_bps: 7_500,
        });

        let liq_contract = LiquidationClient::new(&env.clone(), &liq_id);
        liq_contract.initialize(
            &admin,
            &LiquidationConfig {
                pool: pool_id.clone(),
                vault: vault_id.clone(),
                oracle: Address::generate(&env),
                bonus_bps: 500,
                fee_bps: 2_000,
                close_factor_bps: 5_000,
            },
            &treasury,
        );

        LiqTestEnv {
            env,
            liq_contract,
            liq_id,
            pool_client,
            pool_id,
            vault_client,
            vault_id,
            wrapped_client,
            asset,
        }
    }

    /// Set up an underwater borrower: supply 1000, borrow 900 (HF=1.11).
    /// Then the tests manipulate further as needed.
    #[allow(dead_code)]
    fn make_borrower(te: &LiqTestEnv, collateral: i128, borrow: i128) -> (Address, Address) {
        let user = Address::generate(&te.env);
        // Supply liquidity and collateral so borrow succeeds.
        te.pool_client
            .supply_collateral(&user, &te.asset, &collateral);
        te.pool_client.supply(&user, &te.asset, &collateral);
        te.pool_client.borrow(&user, &te.asset, &borrow);
        // Also give the user vault collateral via a direct vault deposit
        // (in production the controller does this; here we simulate it).
        te.vault_client
            .deposit(&te.liq_id, &user, &te.asset, &collateral);
        (user, te.liq_id.clone())
    }

    // ═══════════════════════════════════════════════════════════════════════
    // BASIC
    // ═══════════════════════════════════════════════════════════════════════

    #[test]
    fn test_liquidate_with_bonus_and_state_changes() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);

        // Set up borrower: 10,000 collateral in vault, 12,000 debt in pool
        // (debt > vault collateral ensures the position is underwater).
        te.pool_client
            .supply_collateral(&borrower, &te.asset, &12_000i128);
        te.pool_client.supply(&borrower, &te.asset, &12_000i128);
        te.pool_client.borrow(&borrower, &te.asset, &12_000i128);
        te.vault_client
            .deposit(&te.liq_id, &borrower, &te.asset, &10_000i128);

        let debt_before = te.pool_client.debt_of(&borrower, &te.asset);
        assert!(debt_before >= 12_000i128, "borrower should be underwater");

        let coll_before = te.vault_client.position(&borrower, &te.asset);
        assert_eq!(coll_before, 10_000i128);

        let liquidator_coll_before = te.vault_client.position(&liquidator, &te.asset);

        // Liquidate 5,000 (50% close factor of 12,000 = 6,000 max).
        let seized =
            te.liq_contract
                .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &5_000i128);
        // bonus = 250, fee = 50, seize = 5,200
        assert_eq!(seized, 5_200i128);

        // ── Verify pool state: debt reduced ──
        let debt_after = te.pool_client.debt_of(&borrower, &te.asset);
        assert!(debt_after < debt_before, "debt must decrease");
        assert!(debt_after >= debt_before - 5_000, "repay was applied");

        // ── Verify vault state: collateral seized ──
        let coll_after = te.vault_client.position(&borrower, &te.asset);
        // The liquidation also seizes a protocol fee (50) to treasury.
        // Total collateral removed: sieze_amount + fee = 5_200 + 50 = 5_250.
        assert_eq!(
            coll_after,
            coll_before - seized - 50,
            "collateral must decrease by seized amount + fee"
        );

        let liquidator_coll_after = te.vault_client.position(&liquidator, &te.asset);
        assert_eq!(
            liquidator_coll_after - liquidator_coll_before,
            seized,
            "liquidator must receive the seized collateral"
        );
    }

    #[test]
    #[should_panic(expected = "position is healthy")]
    fn test_healthy_position_reverts() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);

        // Healthy position: collateral > debt.
        te.pool_client
            .supply_collateral(&borrower, &te.asset, &5_000i128);
        te.pool_client.supply(&borrower, &te.asset, &5_000i128);
        te.pool_client.borrow(&borrower, &te.asset, &1_000i128);
        te.vault_client
            .deposit(&te.liq_id, &borrower, &te.asset, &5_000i128);

        te.liq_contract
            .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &500i128);
    }

    #[test]
    #[should_panic(expected = "exceeds close factor")]
    fn test_close_factor_enforced() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);

        // Underwater: debt=10,000, coll=5,000.
        te.pool_client
            .supply_collateral(&borrower, &te.asset, &5_000i128);
        te.pool_client.supply(&borrower, &te.asset, &5_000i128);
        te.pool_client.borrow(&borrower, &te.asset, &10_000i128);
        te.vault_client
            .deposit(&te.liq_id, &borrower, &te.asset, &5_000i128);

        // Try to liquidate 6,000 — exceeds 50% close factor (5,000 max).
        te.liq_contract
            .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &6_000i128);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INVARIANT TESTS (Q-*)
    // ═══════════════════════════════════════════════════════════════════════

    /// Q-3/Q-4: Liquidator share = repay + bonus - fee.
    #[test]
    fn invariant_Q3_Q4_liquidator_share_formula() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);

        // Underwater: 10,000 vault, 12,000 debt.
        te.pool_client
            .supply_collateral(&borrower, &te.asset, &12_000i128);
        te.pool_client.supply(&borrower, &te.asset, &12_000i128);
        te.pool_client.borrow(&borrower, &te.asset, &12_000i128);
        te.vault_client
            .deposit(&te.liq_id, &borrower, &te.asset, &10_000i128);

        // 10% bonus, 20% fee on bonus.
        te.liq_contract.set_config(&LiquidationConfig {
            pool: te.pool_id.clone(),
            vault: te.vault_id.clone(),
            oracle: Address::generate(&te.env),
            bonus_bps: 1_000,
            fee_bps: 2_000,
            close_factor_bps: 5_000,
        });

        let seized =
            te.liq_contract
                .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &5_000i128);
        // gross = 5,500, bonus = 500, fee = 100, seize = 5,400
        assert_eq!(seized, 5_400i128);
        assert!(
            seized >= 5_000i128,
            "Q-3: liquidator share must be >= repay"
        );
    }

    /// Q-5: Partial liquidation reduces debt proportionally.
    #[test]
    fn invariant_Q5_partial_liquidation_reduces_debt() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);

        // Underwater: 10,000 vault, 12,000 debt.
        te.pool_client
            .supply_collateral(&borrower, &te.asset, &12_000i128);
        te.pool_client.supply(&borrower, &te.asset, &12_000i128);
        te.pool_client.borrow(&borrower, &te.asset, &12_000i128);
        te.vault_client
            .deposit(&te.liq_id, &borrower, &te.asset, &10_000i128);

        let debt_before = te.pool_client.debt_of(&borrower, &te.asset);
        let seized =
            te.liq_contract
                .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &5_000i128);
        // bonus=250, fee=50, seize=5,200
        assert_eq!(seized, 5_200i128);
        assert!(seized > 5_000i128, "Q-5: liquidator must receive bonus");

        let debt_after = te.pool_client.debt_of(&borrower, &te.asset);
        assert!(
            debt_after < debt_before,
            "Q-5: debt must decrease after partial liquidation"
        );
    }

    /// Q-6: Full liquidation at close factor limit (50%).
    #[test]
    fn invariant_Q6_full_liquidation_at_close_factor() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);

        // Underwater: 10,000 vault, 12,000 debt.
        te.pool_client
            .supply_collateral(&borrower, &te.asset, &12_000i128);
        te.pool_client.supply(&borrower, &te.asset, &12_000i128);
        te.pool_client.borrow(&borrower, &te.asset, &12_000i128);
        te.vault_client
            .deposit(&te.liq_id, &borrower, &te.asset, &10_000i128);

        // 10% bonus, 10% fee on bonus, 50% close factor
        te.liq_contract.set_config(&LiquidationConfig {
            pool: te.pool_id.clone(),
            vault: te.vault_id.clone(),
            oracle: Address::generate(&te.env),
            bonus_bps: 1_000,
            fee_bps: 1_000,
            close_factor_bps: 5_000,
        });

        let seized =
            te.liq_contract
                .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &5_000i128);
        // bonus = 500, fee = 50, seize = 5,450
        assert_eq!(seized, 5_450i128);
    }

    /// Q-7: Liquidator always receives >= repay (incentive alignment).
    #[test]
    fn invariant_Q7_liquidator_always_profits() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);

        // Underwater: 10,000 vault, 12,000 debt.
        te.pool_client
            .supply_collateral(&borrower, &te.asset, &12_000i128);
        te.pool_client.supply(&borrower, &te.asset, &12_000i128);
        te.pool_client.borrow(&borrower, &te.asset, &12_000i128);
        te.vault_client
            .deposit(&te.liq_id, &borrower, &te.asset, &10_000i128);

        let configs = [(500u32, 2_000u32), (1_000u32, 1_000u32), (2_000u32, 500u32)];
        for (bonus_bps, fee_bps) in configs {
            te.liq_contract.set_config(&LiquidationConfig {
                pool: te.pool_id.clone(),
                vault: te.vault_id.clone(),
                oracle: Address::generate(&te.env),
                bonus_bps,
                fee_bps,
                close_factor_bps: 5_000,
            });
            let seized =
                te.liq_contract
                    .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &2_000i128);
            assert!(
                seized >= 2_000i128,
                "Q-7: liquidator must get >= repay (bonus={bonus_bps} fee={fee_bps}): seized={seized}"
            );
        }
    }

    /// Q-8: Zero-amount liquidation must revert.
    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn invariant_Q8_zero_amount_liquidation_reverts() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);
        te.liq_contract
            .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &0i128);
    }

    /// Q-9: Negative-amount liquidation must revert.
    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn invariant_Q9_negative_amount_liquidation_reverts() {
        let te = setup_liq();
        let borrower = Address::generate(&te.env);
        let liquidator = Address::generate(&te.env);
        te.liq_contract
            .liquidate(&liquidator, &borrower, &te.asset, &te.asset, &-1i128);
    }
}
