//! # Collateral Vault
//!
//! Tracks collateral deposits per (user, asset) pair. Authorized callers
//! (the `lending_pool`) deposit and withdraw; the `liquidation` contract
//! may seize collateral under preset conditions.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// address authorized to move funds
    Operator(Address),
    /// (user, asset) => amount
    Position(Address, Symbol),
    /// asset => total
    TotalByAsset(Symbol),
    /// asset => liquidation threshold in bps (e.g. 8500 = 85%)
    LiqThreshold(Symbol),
}

#[contract]
pub struct CollateralVault;

#[contractimpl]
impl CollateralVault {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn add_operator(env: Env, op: Address) {
        Self::require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Operator(op), &true);
    }

    pub fn set_liq_threshold(env: Env, asset: Symbol, bps: u32) {
        Self::require_admin(&env);
        if bps > 10_000 {
            panic!("bps > 100%");
        }
        env.storage()
            .persistent()
            .set(&DataKey::LiqThreshold(asset), &bps);
    }

    /// Operator deposits `amount` of `asset` on behalf of `user` as collateral.
    pub fn deposit(env: Env, op: Address, user: Address, asset: Symbol, amount: i128) {
        Self::require_operator(&env, &op);
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let pos_key = DataKey::Position(user.clone(), asset.clone());
        let pos: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&pos_key, &pos.checked_add(amount).expect("overflow"));

        let total_key = DataKey::TotalByAsset(asset.clone());
        let total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&total_key, &total.checked_add(amount).expect("overflow"));
    }

    /// Withdraw collateral. `op` must be the lending pool or a liquidation contract.
    pub fn withdraw(env: Env, op: Address, user: Address, asset: Symbol, amount: i128) {
        Self::require_operator(&env, &op);
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let pos_key = DataKey::Position(user.clone(), asset.clone());
        let pos: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);
        if pos < amount {
            panic!("insufficient collateral");
        }
        env.storage().persistent().set(&pos_key, &(pos - amount));

        let total_key = DataKey::TotalByAsset(asset.clone());
        let total: i128 = env.storage().persistent().get(&total_key).unwrap_or(0);
        env.storage().persistent().set(&total_key, &(total - amount));
    }

    /// Seize collateral from an underwater borrower to a liquidator.
    pub fn seize(
        env: Env,
        op: Address,
        from: Address,
        to: Address,
        asset: Symbol,
        amount: i128,
    ) {
        Self::require_operator(&env, &op);
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let pos_key = DataKey::Position(from.clone(), asset.clone());
        let pos: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);
        if pos < amount {
            panic!("insufficient collateral to seize");
        }
        env.storage().persistent().set(&pos_key, &(pos - amount));

        let recv_key = DataKey::Position(to.clone(), asset.clone());
        let recv: i128 = env.storage().persistent().get(&recv_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&recv_key, &recv.checked_add(amount).expect("overflow"));
    }

    // ──────────────────────────── Views ────────────────────────────

    pub fn position(env: Env, user: Address, asset: Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Position(user, asset))
            .unwrap_or(0)
    }

    pub fn total_by_asset(env: Env, asset: Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalByAsset(asset))
            .unwrap_or(0)
    }

    pub fn liq_threshold_bps(env: Env, asset: Symbol) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::LiqThreshold(asset))
            .unwrap_or(8_500) // default 85%
    }

    // ──────────────────────────── Internals ────────────────────────────

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
    }

    fn require_operator(env: &Env, op: &Address) {
        op.require_auth();
        let ok: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Operator(op.clone()))
            .unwrap_or(false);
        if !ok {
            panic!("not an operator");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_deposit_and_withdraw() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let op = Address::random(&env);
        let user = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");

        let vault = CollateralVaultClient::new(&env, &env.register_contract(None, CollateralVault {}));
        vault.initialize(&admin);
        vault.add_operator(&op);
        vault.deposit(&op, &user, &asset, &1_000);
        assert_eq!(vault.position(&user, &asset), 1_000);
        vault.withdraw(&op, &user, &asset, &400);
        assert_eq!(vault.position(&user, &asset), 600);
        assert_eq!(vault.total_by_asset(&asset), 600);
    }

    #[test]
    fn test_seize_transfers() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let op = Address::random(&env);
        let a = Address::random(&env);
        let b = Address::random(&env);
        let asset = Symbol::new(&env, "XLM");
        let vault = CollateralVaultClient::new(&env, &env.register_contract(None, CollateralVault {}));
        vault.initialize(&admin);
        vault.add_operator(&op);
        vault.deposit(&op, &a, &asset, &1_000);
        vault.seize(&op, &a, &b, &asset, &300);
        assert_eq!(vault.position(&a, &asset), 700);
        assert_eq!(vault.position(&b, &asset), 300);
    }
}
