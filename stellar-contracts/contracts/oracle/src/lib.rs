//! # Price Oracle
//!
//! Reads price feeds for assets used in the lending protocol. Supports
//! a `Reflector`-style Stellar price feed adapter; the same interface
//! works with Chainlink reflect feeds or any other signed-price source.
//!
//! Prices are stored as `i128` with 14 decimals of precision (e.g. `1.23` => `12_300_000_000_000`).
//! Each feed is updated by a trusted publisher; staleness is checked on read.

#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, Symbol};

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

// ──────────────────────── Events ────────────────────────
//
// `#[contractevent]` replaces the deprecated `env.events().publish(...)`
// API (soroban-sdk >= 22). The topic symbol is the snake_case struct
// name; `data_format = "vec"` keeps the previous Vec-shaped event data.

#[contractevent(data_format = "vec")]
pub struct AddPub {
    publisher: Address,
}

#[contractevent(data_format = "vec")]
pub struct Price {
    asset: Symbol,
    price: i128,
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
        AddPub { publisher }.publish(&env);
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
        let now: u64 = env.ledger().sequence().into();
        env.storage()
            .persistent()
            .set(&DataKey::UpdatedAt(asset.clone()), &now);

        Price { asset, price }.publish(&env);
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
        let now: u64 = env.ledger().sequence().into();
        if now.saturating_sub(updated) > cfg.heartbeat.max(DEFAULT_TTL) {
            panic!("price stale");
        }

        env.storage()
            .persistent()
            .get(&DataKey::Price(asset))
            .expect("no price")
    }

    /// Return the latest price with no staleness check (best-effort).
    ///
    /// NOTE: named `peek_price` rather than `try_get_price` because the
    /// `#[contractimpl]` macro generates a `try_<fn>` client companion for
    /// every public function, so a literal `try_get_price` collides with
    /// the generated `try_get_price` method (E0592).
    pub fn peek_price(env: Env, asset: Symbol) -> Option<i128> {
        env.storage().persistent().get(&DataKey::Price(asset))
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
    #![allow(non_snake_case)] // invariant tests are named after doc IDs (O-*)
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::testutils::Ledger;

    #[test]
    fn test_publish_and_read() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let pub_ = Address::generate(&env);
        let oracle = OracleClient::new(&env, &env.register(Oracle {}, ()));
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
        let admin = Address::generate(&env);
        let pub_ = Address::generate(&env);
        let oracle = OracleClient::new(&env, &env.register(Oracle {}, ()));
        oracle.initialize(&admin);
        oracle.add_publisher(&pub_);
        let asset = Symbol::new(&env, "XLM");
        oracle.set_asset_config(&asset, &300u64);
        oracle.set_price(&pub_, &asset, &2_500_000_000_000i128); // $0.025 (14 dec)
                                                                 // 1_000 XLM (in 7 dec) = 10_000_000_000 units
        let v = oracle.value_of(&asset, &10_000_000_000i128);
        // value = 10^10 * 2.5e12 / 10^7 = 2.5e15 in 14 dec = $25.00
        assert_eq!(v, 2_500_000_000_000_000i128);
    }

    // ──────────────────────── INVARIANT TESTS (O-*) ────────────────────────
    //
    // UNVERIFIED: `cargo test` is blocked by a `soroban-sdk 21.x` dep-tree
    // split. See `../../BUILD_ENV_NOTES.md`. Tests are static-reviewed as
    // well-formed against the existing test patterns in this module.

    /// **O-1:** `set_price` from a non-publisher reverts.
    #[test]
    #[should_panic]
    fn invariant_O1_only_publishers_set_price() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let stranger = Address::generate(&env);
        let oracle = OracleClient::new(&env, &env.register(Oracle {}, ()));
        oracle.initialize(&admin);
        // Note: do NOT call add_publisher for `stranger`.
        let asset = Symbol::new(&env, "XLM");
        oracle.set_asset_config(&asset, &300u64);
        oracle.set_price(&stranger, &asset, &1_000_000_000_000i128);
    }

    /// **O-3:** `set_price` with a non-positive price reverts.
    #[test]
    #[should_panic]
    fn invariant_O3_price_must_be_positive() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let pub_ = Address::generate(&env);
        let oracle = OracleClient::new(&env, &env.register(Oracle {}, ()));
        oracle.initialize(&admin);
        oracle.add_publisher(&pub_);
        let asset = Symbol::new(&env, "XLM");
        oracle.set_asset_config(&asset, &300u64);
        oracle.set_price(&pub_, &asset, &0i128);
    }

    /// **O-2:** Stale price reverts. We jump the ledger sequence past the
    /// heartbeat to simulate the passage of time.
    #[test]
    #[should_panic]
    fn invariant_O2_stale_price_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let pub_ = Address::generate(&env);
        let oracle = OracleClient::new(&env, &env.register(Oracle {}, ()));
        oracle.initialize(&admin);
        oracle.add_publisher(&pub_);
        let asset = Symbol::new(&env, "XLM");
        oracle.set_asset_config(&asset, &10u64);
        oracle.set_price(&pub_, &asset, &1_000_000_000_000i128);
        // Advance the ledger past max(heartbeat, DEFAULT_TTL). With
        // heartbeat=10 and DEFAULT_TTL=300 the effective staleness bound is
        // 300 ledgers, so jump 301.
        env.ledger()
            .set_sequence_number(env.ledger().sequence() + 301);
        oracle.get_price(&asset);
    }
}
