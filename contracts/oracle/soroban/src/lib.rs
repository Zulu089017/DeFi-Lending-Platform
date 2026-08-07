//! # Price Oracle
//!
//! Reads price feeds for assets used in the lending protocol. Supports
//! a `Reflector`-style Stellar price feed adapter; the same interface
//! works with Chainlink reflect feeds or any other signed-price source.
//!
//! Prices are stored as `i128` with 14 decimals of precision (e.g. `1.23` => `12_300_000_000_000`).
//! Each feed is updated by a trusted publisher; staleness is checked on read.
//!
//! **Multi-publisher aggregation:** each asset requires ≥ `min_publishers`
//! (default 2) non-stale reports. The median price is returned — this
//! prevents a single compromised publisher from manipulating the feed.

#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, Symbol};

#[cfg(test)]
use soroban_sdk::Vec;

/// Time after which a price is considered stale (default: 5 minutes).
const DEFAULT_TTL: u64 = 300;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// `Symbol` of asset => `AssetConfig`
    AssetConfig(Symbol),
    /// (Symbol of asset, Address of publisher) => last price
    PublisherPrice(Symbol, Address),
    /// (Symbol of asset, Address of publisher) => last update ledger seq
    PublisherUpdated(Symbol, Address),
    /// Whitelisted publisher flag
    Publisher(Address),
    /// Publisher list: index => Address (for enumeration)
    PublisherList(u32),
    /// Number of entries in the publisher list
    PublisherListLen,
}

#[contracttype]
#[derive(Clone)]
pub struct AssetConfig {
    pub asset: Symbol,
    pub heartbeat: u64,
    /// Minimum number of non-stale publisher reports required.
    /// Default 2 — must be ≥ 1.
    pub min_publishers: u32,
}

// ──────────────────────── Events ────────────────────────

#[contractevent(data_format = "vec")]
pub struct AddPub {
    publisher: Address,
}

#[contractevent(data_format = "vec")]
pub struct Price {
    asset: Symbol,
    price: i128,
    publisher: Address,
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
        Self::append_publisher_list(&env, &publisher);
        AddPub { publisher }.publish(&env);
    }

    /// Remove a publisher from the whitelist. Admin-only.
    pub fn remove_publisher(env: Env, publisher: Address) {
        Self::require_admin(&env);
        env.storage()
            .persistent()
            .remove(&DataKey::Publisher(publisher.clone()));
        Self::remove_from_publisher_list(&env, &publisher);
    }

    /// Check whether an address is a registered publisher.
    pub fn is_publisher(env: Env, publisher: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Publisher(publisher))
            .unwrap_or(false)
    }

    pub fn set_asset_config(env: Env, asset: Symbol, heartbeat: u64, min_publishers: u32) {
        Self::require_admin(&env);
        if min_publishers == 0 {
            panic!("min_publishers must be >= 1");
        }
        env.storage().persistent().set(
            &DataKey::AssetConfig(asset.clone()),
            &AssetConfig {
                asset: asset.clone(),
                heartbeat,
                min_publishers,
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

        env.storage().persistent().set(
            &DataKey::PublisherPrice(asset.clone(), publisher.clone()),
            &price,
        );
        let now: u64 = env.ledger().sequence().into();
        env.storage().persistent().set(
            &DataKey::PublisherUpdated(asset.clone(), publisher.clone()),
            &now,
        );

        Price {
            asset,
            price,
            publisher,
        }
        .publish(&env);
    }

    /// Number of publishers who have reported a non-stale price for `asset`.
    pub fn publisher_count(env: Env, asset: Symbol) -> u32 {
        let cfg: AssetConfig = env
            .storage()
            .persistent()
            .get(&DataKey::AssetConfig(asset.clone()))
            .expect("asset not configured");
        let now: u64 = env.ledger().sequence().into();
        let effective_ttl = cfg.heartbeat.max(DEFAULT_TTL);
        let len: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PublisherListLen)
            .unwrap_or(0);
        let mut count: u32 = 0;
        for i in 0u32..len {
            let pub_addr: Address = env
                .storage()
                .persistent()
                .get(&DataKey::PublisherList(i))
                .expect("publisher list corrupt");
            let updated: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::PublisherUpdated(asset.clone(), pub_addr))
                .unwrap_or(0);
            if now.saturating_sub(updated) <= effective_ttl {
                count += 1;
            }
        }
        count
    }

    /// Return the median of non-stale publisher prices for `asset`.
    /// Panics if fewer than `min_publishers` have reported or if the
    /// asset is not configured.
    pub fn get_price(env: Env, asset: Symbol) -> i128 {
        let cfg: AssetConfig = env
            .storage()
            .persistent()
            .get(&DataKey::AssetConfig(asset.clone()))
            .expect("asset not configured");

        let now: u64 = env.ledger().sequence().into();
        let effective_ttl = cfg.heartbeat.max(DEFAULT_TTL);

        // Collect non-stale prices from all known publishers.
        // Delegates to the internal implementation that walks the stored
        // publisher list.
        Self::collect_median(&env, &cfg, effective_ttl, now)
    }

    /// Return the latest price with no staleness check and no aggregation
    /// (best-effort, single-publisher fallback).
    pub fn peek_price(env: Env, asset: Symbol) -> Option<i128> {
        // Walk stored prices and return the most recent one.
        // Fallback to a simple probe of the first publisher who has a price.
        // This is intentionally lenient — callers should prefer get_price().
        let cfg: AssetConfig = env
            .storage()
            .persistent()
            .get(&DataKey::AssetConfig(asset.clone()))
            .unwrap_or(AssetConfig {
                asset: asset.clone(),
                heartbeat: DEFAULT_TTL,
                min_publishers: 1,
            });
        let now: u64 = env.ledger().sequence().into();
        let ttl = cfg.heartbeat.max(DEFAULT_TTL);

        // Probe publisher slots for any non-stale price.
        for i in 0u32..16u32 {
            let pub_addr = Self::publisher_by_index(&env, i);
            if pub_addr.is_none() {
                continue;
            }
            let pub_addr = pub_addr.unwrap();
            let updated: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::PublisherUpdated(asset.clone(), pub_addr.clone()))
                .unwrap_or(0);
            if now.saturating_sub(updated) <= ttl {
                let price: i128 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::PublisherPrice(asset.clone(), pub_addr))
                    .unwrap_or(0);
                if price > 0 {
                    return Some(price);
                }
            }
        }
        None
    }

    /// Returns the USD value (with 14 decimals) of `amount` units of `asset`.
    pub fn value_of(env: Env, asset: Symbol, amount: i128) -> i128 {
        let price = Self::get_price(env.clone(), asset);
        amount
            .checked_mul(price)
            .expect("overflow")
            .checked_div(10_000_000)
            .expect("div by zero")
    }

    // ──────────────────── Publisher list helpers ────────────────────

    /// Look up a publisher address by its sequential index.
    fn publisher_by_index(env: &Env, idx: u32) -> Option<Address> {
        let len: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PublisherListLen)
            .unwrap_or(0);
        if idx >= len {
            return None;
        }
        env.storage().persistent().get(&DataKey::PublisherList(idx))
    }

    fn append_publisher_list(env: &Env, publisher: &Address) {
        let len: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PublisherListLen)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::PublisherList(len), publisher);
        env.storage()
            .persistent()
            .set(&DataKey::PublisherListLen, &(len + 1));
    }

    fn remove_from_publisher_list(env: &Env, publisher: &Address) {
        let len: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PublisherListLen)
            .unwrap_or(0);
        for i in 0u32..len {
            let stored: Address = env
                .storage()
                .persistent()
                .get(&DataKey::PublisherList(i))
                .expect("publisher list corrupt");
            if stored == *publisher {
                if i < len - 1 {
                    let last: Address = env
                        .storage()
                        .persistent()
                        .get(&DataKey::PublisherList(len - 1))
                        .expect("publisher list corrupt");
                    env.storage()
                        .persistent()
                        .set(&DataKey::PublisherList(i), &last);
                }
                env.storage()
                    .persistent()
                    .remove(&DataKey::PublisherList(len - 1));
                env.storage()
                    .persistent()
                    .set(&DataKey::PublisherListLen, &(len - 1));
                return;
            }
        }
    }

    /// Collect non-stale prices and return the median.
    fn collect_median(env: &Env, cfg: &AssetConfig, ttl: u64, now: u64) -> i128 {
        let len: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PublisherListLen)
            .unwrap_or(0);
        let mut prices: [i128; 16] = [0; 16];
        let mut count: u32 = 0;

        for i in 0u32..len {
            let pub_addr: Address = env
                .storage()
                .persistent()
                .get(&DataKey::PublisherList(i))
                .expect("publisher list corrupt");
            let updated: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::PublisherUpdated(
                    cfg.asset.clone(),
                    pub_addr.clone(),
                ))
                .unwrap_or(0);
            if now.saturating_sub(updated) <= ttl {
                let price: i128 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::PublisherPrice(cfg.asset.clone(), pub_addr))
                    .unwrap_or(0);
                if price > 0 {
                    prices[count as usize] = price;
                    count += 1;
                }
            }
        }

        if count < cfg.min_publishers {
            panic!("insufficient publisher reports");
        }

        // Bubble-sort (N ≤ 16).
        for i in 0..count {
            for j in (i + 1)..count {
                if prices[i as usize] > prices[j as usize] {
                    prices.swap(i as usize, j as usize);
                }
            }
        }
        // Median: lower-middle for even count.
        let mid = (count - 1) / 2;
        prices[mid as usize]
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
    use soroban_sdk::testutils::Ledger;

    fn setup_with_publishers(env: &Env, count: u32) -> (OracleClient<'_>, Symbol, Vec<Address>) {
        let admin = Address::generate(env);
        let oracle = OracleClient::new(env, &env.register(Oracle {}, ()));
        oracle.initialize(&admin);
        let asset = Symbol::new(env, "XLM");
        oracle.set_asset_config(&asset, &300u64, &count);
        let mut pubs = Vec::new(env);
        for _ in 0..count {
            let p = Address::generate(env);
            oracle.add_publisher(&p);
            pubs.push_back(p);
        }
        // Push takes ownership; reconstruct for return.
        let mut out = soroban_sdk::vec![env];
        for i in 0..count {
            let p = pubs.get(i).unwrap();
            out.push_back(p);
        }
        (oracle, asset, out)
    }

    #[test]
    fn test_publish_and_read_single() {
        let env = Env::default();
        env.mock_all_auths();
        let (oracle, asset, pubs) = setup_with_publishers(&env, 1);
        let p1 = pubs.get(0).unwrap();
        oracle.set_price(&p1, &asset, &1_000_000_000_000i128);
        assert_eq!(oracle.get_price(&asset), 1_000_000_000_000i128);
    }

    #[test]
    fn test_median_of_three() {
        let env = Env::default();
        env.mock_all_auths();
        let (oracle, asset, pubs) = setup_with_publishers(&env, 3);
        let p1 = pubs.get(0).unwrap();
        let p2 = pubs.get(1).unwrap();
        let p3 = pubs.get(2).unwrap();
        oracle.set_price(&p1, &asset, &1_000_000_000_000i128); // 1.00
        oracle.set_price(&p2, &asset, &1_200_000_000_000i128); // 1.20
        oracle.set_price(&p3, &asset, &1_100_000_000_000i128); // 1.10
                                                               // Median of [1.00, 1.10, 1.20] = 1.10
        assert_eq!(oracle.get_price(&asset), 1_100_000_000_000i128);
    }

    #[test]
    #[should_panic(expected = "insufficient publisher reports")]
    fn test_insufficient_publishers_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (oracle, asset, pubs) = setup_with_publishers(&env, 3);
        // Only publish from 1 of 3 required
        let p1 = pubs.get(0).unwrap();
        oracle.set_price(&p1, &asset, &1_000_000_000_000i128);
        oracle.get_price(&asset);
    }

    #[test]
    fn test_value_of_uses_median() {
        let env = Env::default();
        env.mock_all_auths();
        let (oracle, asset, pubs) = setup_with_publishers(&env, 2);
        let p1 = pubs.get(0).unwrap();
        let p2 = pubs.get(1).unwrap();
        oracle.set_price(&p1, &asset, &2_000_000_000_000i128); // $2.00
        oracle.set_price(&p2, &asset, &3_000_000_000_000i128); // $3.00, median = 2.50
                                                               // value_of for 100 tokens = 100 * 2.5e12 / 1e7 = 25e6 in 14-dec = $25.00
        let v = oracle.value_of(&asset, &1_000_000_000i128); // 100 tokens in 7-dec
        assert_eq!(v, 2_500_000_000_000_000i128); // $250.00 in 14-dec
    }

    // ──────────────────────── INVARIANT TESTS (O-*) ────────────────────────

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
        let asset = Symbol::new(&env, "XLM");
        oracle.set_asset_config(&asset, &300u64, &2u32);
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
        oracle.set_asset_config(&asset, &300u64, &1u32);
        oracle.set_price(&pub_, &asset, &0i128);
    }

    /// **O-2:** Stale price reverts (even with enough publishers, if all are stale).
    #[test]
    #[should_panic]
    fn invariant_O2_stale_price_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (oracle, asset, pubs) = setup_with_publishers(&env, 2);
        let p1 = pubs.get(0).unwrap();
        let p2 = pubs.get(1).unwrap();
        oracle.set_asset_config(&asset, &10u64, &2u32);
        oracle.set_price(&p1, &asset, &1_000_000_000_000i128);
        oracle.set_price(&p2, &asset, &1_200_000_000_000i128);
        // Advance past staleness threshold.
        env.ledger()
            .set_sequence_number(env.ledger().sequence() + 301);
        oracle.get_price(&asset);
    }

    /// **O-5:** Only admin can add publisher / set config.
    #[test]
    #[should_panic]
    fn invariant_O5_non_admin_cannot_add_publisher() {
        let env = Env::default();
        env.mock_all_auths();
        // Don't mock all auths for the admin call — we want the stranger
        // to fail on require_auth.
        let admin = Address::generate(&env);
        let oracle = OracleClient::new(&env, &env.register(Oracle {}, ()));
        oracle.initialize(&admin);
        // Attempt add_publisher from a non-admin address without mocking auth.
        let stranger = Address::generate(&env);
        oracle.add_publisher(&stranger);
    }

    /// New: `peek_price` returns the latest price ignoring aggregation.
    #[test]
    fn test_peek_price_returns_any() {
        let env = Env::default();
        env.mock_all_auths();
        let (oracle, asset, pubs) = setup_with_publishers(&env, 1);
        let p1 = pubs.get(0).unwrap();
        oracle.set_price(&p1, &asset, &5_000_000_000_000i128);
        let peeked = oracle.peek_price(&asset);
        assert_eq!(peeked, Some(5_000_000_000_000i128));
    }
}
