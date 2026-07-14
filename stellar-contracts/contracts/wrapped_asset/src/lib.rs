//! # Wrapped Asset (wTKN)
//!
//! The canonical wrapped token on Stellar. Mints and burns are gated by the
//! `lending_controller`, which in turn is fed by the off-chain bridge middleware
//! that watches `Locked` / `Burned` events on source chains (Ethereum, Solana, Polygon).

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

// ────────────────────────────── Storage Types ──────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin (upgradeable, multisig in production)
    Admin,
    /// Address authorized to mint/burn — i.e. the lending_controller
    Minter,
    /// Token metadata
    Metadata,
    /// Per-account balance
    Balance(Address),
    /// Total supply
    TotalSupply,
}

#[contracttype]
#[derive(Clone)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    /// Source chain identifier (e.g. "ethereum", "solana", "polygon")
    pub origin_chain: String,
    /// Canonical source-chain contract address
    pub origin_address: String,
}

// ──────────────────────────────── Contract ────────────────────────────────

#[contract]
pub struct WrappedAsset;

#[contractimpl]
impl WrappedAsset {
    /// One-time initialization. Called exactly once by the deployer.
    pub fn initialize(
        env: Env,
        admin: Address,
        minter: Address,
        name: String,
        symbol: String,
        decimals: u32,
        origin_chain: String,
        origin_address: String,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Minter, &minter);
        env.storage().instance().set(
            &DataKey::Metadata,
            &TokenMetadata {
                name,
                symbol,
                decimals,
                origin_chain,
                origin_address,
            },
        );
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);

        env.events()
            .publish((symbol_short!("init"),), (admin.clone(), minter));
    }

    // ──────────────────────────── Mint / Burn ────────────────────────────

    /// Mint new wrapped tokens. Restricted to the registered minter (controller).
    pub fn mint(env: Env, to: Address, amount: i128) {
        let minter: Address = env
            .storage()
            .instance()
            .get(&DataKey::Minter)
            .expect("minter not set");
        minter.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let key = DataKey::Balance(to.clone());
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&key, &(bal.checked_add(amount).expect("overflow")));

        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &supply.checked_add(amount).expect("overflow"));

        env.events()
            .publish((Symbol::new(&env, "mint"),), (to, amount));
    }

    /// Burn wrapped tokens. Anyone holding tokens may burn their own; the
    /// controller calls this for unwrap flows.
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let key = DataKey::Balance(from.clone());
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if bal < amount {
            panic!("insufficient balance");
        }
        env.storage()
            .persistent()
            .set(&key, &(bal - amount));

        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));

        env.events()
            .publish((Symbol::new(&env, "burn"),), (from, amount));
    }

    // ──────────────────────────── Views ────────────────────────────

    pub fn balance(env: Env, owner: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn metadata(env: Env) -> TokenMetadata {
        env.storage()
            .instance()
            .get(&DataKey::Metadata)
            .expect("not initialized")
    }

    pub fn minter(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Minter)
            .expect("not initialized")
    }

    // ──────────────────────────── Admin ────────────────────────────

    /// Rotate the minter (controller). 24h timelock recommended in production.
    pub fn set_minter(env: Env, new_minter: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::Minter, &new_minter);
        env.events()
            .publish((symbol_short!("set_minter"),), (new_minter,));
    }
}

// ──────────────────────────── Tests ────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_initialize_and_mint() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let minter = Address::random(&env);
        let user = Address::random(&env);

        let contract = WrappedAssetClient::new(&env, &env.register_contract(None, WrappedAsset {}));

        contract.initialize(
            &admin,
            &minter,
            &String::from_str(&env, "Wrapped Ether"),
            &String::from_str(&env, "wETH"),
            &7u32,
            &String::from_str(&env, "ethereum"),
            &String::from_str(&env, "0x0000000000000000000000000000000000000000"),
        );

        contract.mint(&user, &1_000_000);
        assert_eq!(contract.balance(&user), 1_000_000);
        assert_eq!(contract.total_supply(), 1_000_000);
    }

    #[test]
    fn test_burn_reduces_supply() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let minter = Address::random(&env);
        let user = Address::random(&env);

        let contract = WrappedAssetClient::new(&env, &env.register_contract(None, WrappedAsset {}));

        contract.initialize(
            &admin,
            &minter,
            &String::from_str(&env, "Wrapped Ether"),
            &String::from_str(&env, "wETH"),
            &7u32,
            &String::from_str(&env, "ethereum"),
            &String::from_str(&env, "0x0"),
        );
        contract.mint(&user, &500);
        contract.burn(&user, &200);
        assert_eq!(contract.balance(&user), 300);
        assert_eq!(contract.total_supply(), 300);
    }

    #[test]
    #[should_panic]
    fn test_burn_overbalance() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let minter = Address::random(&env);
        let user = Address::random(&env);
        let contract = WrappedAssetClient::new(&env, &env.register_contract(None, WrappedAsset {}));
        contract.initialize(
            &admin,
            &minter,
            &String::from_str(&env, "X"),
            &String::from_str(&env, "x"),
            &7u32,
            &String::from_str(&env, "ethereum"),
            &String::from_str(&env, "0x0"),
        );
        contract.mint(&user, &10);
        contract.burn(&user, &11);
    }
}
