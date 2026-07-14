//! # Price Oracle
//!
//! Reads price feeds for assets used in the lending protocol. Supports
//! a `Reflector`-style Stellar price feed adapter; the same interface
//! works with Chainlink reflect feeds or any other signed-price source.
//!
//! Prices are stored as `i128` with 14 decimals of precision (e.g. `1.23` => `12_300_000_000_000`).
//! Each feed is updated by a trusted publisher; staleness is checked on read.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

/// Time after which a price is considered stale (default: 5 minutes).
const DEFAULT_TTL: u64 = 300;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// `Symbol` of asset => `AssetConfig`
    AssetConfig(Symbol),
    /// `Symbol` of asset => last price
    Price(Symbol),
    /// `Symbol` of asset => last update timestamp (ledger seq)
    UpdatedAt(Symbol),
    /// Whitelisted publishers
    Publisher(Address),
}

#[contracttype]
#[derive(Clone)]
pub struct AssetConfig {
    pub asset: Symbol,
    pub heartbeat: u64,
}

#[contract]
pub struct Oracle;

#[contractimpl]
impl Oracle {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn add_publisher(env: Env, publisher: Address) {
        Self::require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Publisher(publisher.clone()), &true);
        env.events()
            .publish((Symbol::new(&env, "add_pub"),), (publisher,));
    }

    pub fn set_asset_config(env: Env, asset: Symbol, heartbeat: u64) {
        Self::require_admin(&env);
        env.storage().persistent().set(
            &DataKey::AssetConfig(asset.clone()),
            &AssetConfig {
                asset: asset.clone(),
                heartbeat,
            },
        );
    }

    /// Publish a new price. `publisher` must be whitelisted.
    pub fn set_price(env: Env, publisher: Address, asset: Symbol, price: i128) {
        publisher.require_auth();
        let ok: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Publisher(publisher.clone()))
            .unwrap_or(false);
        if !ok {
            panic!("not a publisher");
        }
        if price <= 0 {
            panic!("price must be positive");
        }

        env.storage()
            .persistent()
            .set(&DataKey::Price(asset.clone()), &price);
        env.storage()
            .persistent()
            .set(&DataKey::UpdatedAt(asset.clone()), &env.ledger().sequence());

        env.events()
            .publish((Symbol::new(&env, "price"),), (asset, price));
    }

    /// Return the latest price; panics if stale.
    pub fn get_price(env: Env, asset: Symbol) -> i128 {
        let cfg: AssetConfig = env
            .storage()
            .persistent()
            .get(&DataKey::AssetConfig(asset.clone()))
            .expect("asset not configured");

        let updated: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::UpdatedAt(asset.clone()))
            .unwrap_or(0);
        let now = env.ledger().sequence();
        if now.saturating_sub(updated) > cfg.heartbeat.max(DEFAULT_TTL) {
            panic!("price stale");
        }

        env.storage()
            .persistent()
            .get(&DataKey::Price(asset))
            .expect("no price")
    }

    /// Return the latest price with no staleness check (best-effort).
    pub fn try_get_price(env: Env, asset: Symbol) -> Option<i128> {
        env.storage()
            .persistent()
            .get(&DataKey::Price(asset))
    }

    /// Returns the USD value (with 14 decimals) of `amount` units of `asset`.
    pub fn value_of(env: Env, asset: Symbol, amount: i128) -> i128 {
        let price = Self::get_price(env.clone(), asset);
        // amount is in 7-decimal Stellar units; convert to 14-decimal usd
        // usd_value = amount * price / 10^7
        amount
            .checked_mul(price)
            .expect("overflow")
            .checked_div(10_000_000)
            .expect("div by zero")
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
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_publish_and_read() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let pub_ = Address::random(&env);
        let oracle = OracleClient::new(&env, &env.register_contract(None, Oracle {}));
        oracle.initialize(&admin);
        oracle.add_publisher(&pub_);

        let asset = Symbol::new(&env, "XLM");
        oracle.set_asset_config(&asset, &300u64);
        oracle.set_price(&pub_, &asset, &1_000_000_000_000i128); // $1.00 in 14 dec
        assert_eq!(oracle.get_price(&asset), 1_000_000_000_000i128);
    }

    #[test]
    fn test_value_of() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let pub_ = Address::random(&env);
        let oracle = OracleClient::new(&env, &env.register_contract(None, Oracle {}));
        oracle.initialize(&admin);
        oracle.add_publisher(&pub_);

        let asset = Symbol::new(&env, "XLM");
        oracle.set_asset_config(&asset, &300u64);
        oracle.set_price(&pub_, &asset, &2_500_000_000_000i128); // $2.50
        // 100 XLM (in 7 dec) = 10_000_000_000 units
        let v = oracle.value_of(&asset, &10_000_000_000i128);
        // value = 10_000_000_000 * 2.5 = 25_000_000_000 in 14 dec = $2,500.00
        assert_eq!(v, 25_000_000_000i128);
    }
}
