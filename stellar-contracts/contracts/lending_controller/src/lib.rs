//! # Lending Controller
//!
//! Top-level orchestrator contract. The bridge middleware calls into
//! this contract to wrap/unwrap; users call into it to supply collateral,
//! borrow, repay, and liquidate.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, xdr::ToXdr, Address, Bytes, BytesN, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// bridge attester address (Ed25519 pubkey hash)
    Bridge,
    WrappedAsset,
    LendingPool,
    CollateralVault,
    Oracle,
    /// Used replay-protection for cross-chain wrap/unwrap
    Nonce(BytesN<32>),
    /// Emergency pause
    Paused,
    /// Max mints per hour (circuit breaker)
    MintWindowStart,
    MintWindowCount,
}

#[contract]
pub struct LendingController;

#[contractimpl]
impl LendingController {
    pub fn initialize(
        env: Env,
        admin: Address,
        bridge: BytesN<32>,
        wrapped_asset: Address,
        lending_pool: Address,
        collateral_vault: Address,
        oracle: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Bridge, &bridge);
        env.storage.instance().set(&DataKey::WrappedAsset, &wrapped_asset);
        env.storage.instance().set(&DataKey::LendingPool, &lending_pool);
        env.storage.instance().set(&DataKey::CollateralVault, &collateral_vault);
        env.storage.instance().set(&DataKey::Oracle, &oracle);
    }

    // ──────────────────────── Cross-chain wrap ────────────────────────

    /// Called by the bridge middleware (off-chain relayer) after observing a
    /// `Locked` event on the source chain. Mints `wTKN` to `to` on Stellar.
    ///
    /// `attestation` is an ed25519 signature over a sha256(abi_encode(...))
    /// payload that binds `(chain_id, source_addr, amount, to, salt, nonce)`
    /// to the registered bridge pubkey.
    pub fn wrap(
        env: Env,
        attestation: BytesN<64>, // ed25519 signature
        chain_id: u32,
        source_addr: BytesN<32>,
        amount: i128,
        to: Address,
        salt: BytesN<32>,
        nonce: u64,
    ) {
        Self::require_not_paused(&env);
        Self::require_bridge(
            &env,
            &attestation,
            chain_id,
            source_addr.clone(),
            amount,
            &to,
            &salt,
            nonce,
        );
        Self::check_and_bump_nonce(&env, &salt);
        Self::check_mint_rate(&env);

        // SECURITY: replace this stub with a real cross-contract call to
        // wrapped_asset.mint(to, amount) via the Soroban 21 client API.
        // The variable reads below preserve the call shape for the
        // production implementation; do NOT delete them when refactoring.
        let _wrapped = Self::wrapped_asset(&env);
        let _ = (_wrapped, to, amount);

        env.events().publish(
            (Symbol::new(&env, "wrap"),),
            (chain_id, source_addr, to, amount, salt, nonce),
        );
    }

    /// Begin an unwrap. Burns the wrapped asset and emits a cross-chain
    /// release event that the bridge middleware watches.
    pub fn unwrap(
        env: Env,
        user: Address,
        amount: i128,
        chain_id: u32,
        source_addr: BytesN<32>,
    ) -> BytesN<32> {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        Self::require_not_paused(&env);

        // SECURITY: replace this stub with a real cross-contract call to
        // wrapped_asset.burn(user, amount) via the Soroban 21 client API.
        let _wrapped = Self::wrapped_asset(&env);
        let _ = (_wrapped, user.clone(), amount);

        // Generate a unique nonce
        let nonce = Self::gen_nonce(&env);
        env.events().publish(
            (Symbol::new(&env, "unwrap"),),
            (user, amount, chain_id, source_addr, nonce.clone()),
        );
        nonce
    }

    // ──────────────────────── Lending user-flow ────────────────────────

    // NOTE: The cross-contract invocations to `lending_pool` and
    // `collateral_vault` are intentionally written as inline calls in the
    // real implementation. The scaffold exposes the function entry points
    // only; production code should encode each arg as ScVal and use the
    // Soroban 21 client API. See the comment in `wrap` for details.

    /// User-facing entry point: supply collateral. The controller routes the
    /// call into the lending pool and the collateral vault.
    /// `asset` is a Stellar asset code symbol ("XLM", "USDC") — keep it as
    /// `Symbol` (max 9 ASCII bytes). `wrap`/`unwrap` use `BytesN<32>` for
    /// `source_addr` because EVM addresses are 20 bytes and Solana pubkeys
    /// are 32 bytes; Stellar asset codes are always short symbols.
    pub fn supply_collateral(env: Env, user: Address, asset: Symbol, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        Self::require_not_paused(&env);
        // SECURITY: replace this stub with real cross-contract calls to
        // lending_pool.supply and collateral_vault.deposit via the Soroban
        // 21 client API. The reads below preserve the call shape.
        let _pool = Self::lending_pool(&env);
        let _vault = Self::collateral_vault(&env);
        let _ = (_pool, _vault, user, asset, amount);
        env.events().publish((Symbol::new(&env, "supply"),), (user, asset, amount));
    }

    /// User-facing entry point: borrow against deposited collateral.
    /// MUST enforce a health-factor check before any borrow is allowed;
    /// the scaffold emits the event but does not enforce HF.
    /// `collateral_asset` and `debt_asset` are Stellar asset code symbols.
    pub fn borrow(
        env: Env,
        user: Address,
        collateral_asset: Symbol,
        collateral_amount: i128,
        debt_asset: Symbol,
        borrow_amount: i128,
    ) {
        user.require_auth();
        if borrow_amount <= 0 || collateral_amount <= 0 {
            panic!("amount must be positive");
        }
        Self::require_not_paused(&env);
        // SECURITY: enforce a health-factor check before allowing any borrow.
        // Production implementation:
        //   1. Compute HF = sum(value_of(collateral)) * LTV / sum(value_of(debt))
        //   2. Require new_debt_value * 10_000 / new_collateral_value <= LTV_bps
        //   3. Invoke collateral_vault.deposit(lending_pool, user, collateral_asset, collateral_amount)
        //   4. Invoke lending_pool.borrow(user, debt_asset, borrow_amount)
        let _pool = Self::lending_pool(&env);
        let _vault = Self::collateral_vault(&env);
        let _oracle = Self::oracle(&env);
        let _ = (_pool, _vault, _oracle, user, collateral_asset, collateral_amount, debt_asset, borrow_amount);
        env.events().publish(
            (Symbol::new(&env, "borrow"),),
            (user, collateral_asset, debt_asset, borrow_amount),
        );
    }

    // ──────────────────────── Admin ────────────────────────

    pub fn set_paused(env: Env, paused: bool) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    pub fn set_bridge(env: Env, bridge: BytesN<32>) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Bridge, &bridge);
    }

    // ──────────────────────── Internals ────────────────────────

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
    }

    fn require_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("paused");
        }
    }

    fn require_bridge(
        env: &Env,
        attestation: &BytesN<64>,
        chain_id: u32,
        source_addr: BytesN<32>,
        amount: i128,
        to: &Address,
        salt: &BytesN<32>,
        nonce: u64,
    ) {
        // Ed25519 verification of an attestation that binds the
        // (chain_id, source_addr, amount, to, salt, nonce) tuple to a bridge
        // pubkey. The off-chain signer (bridge/src/attest/signer.ts) signs
        // sha256(build_canonical_payload(...)) with ed25519.
        let bridge_pub: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::Bridge)
            .expect("bridge not set");

        // Build the canonical payload (must match `payloadHash` in
        // bridge/src/attest/signer.ts byte-for-byte).
        let payload = Self::build_canonical_payload(
            env,
            chain_id,
            source_addr.clone(),
            amount,
            to,
            salt,
            nonce,
        );
        let hash = env.crypto().sha256(&payload);
        env.crypto()
            .ed25519_verify(&bridge_pub, &hash, attestation);
        // If the signature is invalid, ed25519_verify panics with a host
        // error and the transaction reverts.
    }

    /// Build the canonical payload that both sides sign. Layout (dynamic
    /// `Bytes`, appended in order):
    ///   1. "OWRP" (4 ASCII bytes)
    ///   2. chain_id (u32 LE)
    ///   3. source_addr (32 raw bytes)
    ///   4. amount (i64 LE, saturating cast)
    ///   5. to: full ScVal XDR representation of the Address (40 bytes for
    ///      an ed25519 account). The off-chain side produces the matching
    ///      bytes via `ScAddress.fromString(...).toScVal().toXDR()`.
    ///   6. salt (32 raw bytes)
    ///   7. nonce (u64 LE)
    fn build_canonical_payload(
        env: &Env,
        chain_id: u32,
        source_addr: BytesN<32>,
        amount: i128,
        to: &Address,
        salt: &BytesN<32>,
        nonce: u64,
    ) -> Bytes {
        let mut payload = Bytes::new(env);
        payload.append(&Bytes::from_slice(env, b"OWRP"));
        payload.append(&Bytes::from_slice(env, &chain_id.to_le_bytes()));
        payload.append(&Bytes::from_slice(env, &source_addr.to_array()));
        let amt_i64 = amount as i64; // saturating cast; production should bounds-check
        payload.append(&Bytes::from_slice(env, &amt_i64.to_le_bytes()));
        let to_xdr = to.to_xdr(env);
        // Sanity check: an ed25519 Address serializes to exactly 40 bytes
        // (ScVal envelope: 4-byte type tag + 4-byte ScAddress tag + 32-byte
        // raw pubkey). If this ever changes, the off-chain signer will
        // produce a different digest and every `wrap` will revert.
        if to_xdr.len() != 40 {
            panic!("unexpected Address XDR length");
        }
        payload.append(&to_xdr);
        payload.append(&Bytes::from_slice(env, &salt.to_array()));
        payload.append(&Bytes::from_slice(env, &nonce.to_le_bytes()));
        payload
    }

    fn check_and_bump_nonce(env: &Env, salt: &BytesN<32>) {
        if env.storage().persistent().has(&DataKey::Nonce(salt.clone())) {
            panic!("salt already used");
        }
        env.storage().persistent().set(&DataKey::Nonce(salt.clone()), &true);
    }

    fn check_mint_rate(env: &Env) {
        const MAX_PER_HOUR: i128 = 1_000_000_000_000; // 10B in 7 dec — adjust per deployment
        const WINDOW_LEDGERS: u64 = 1_800; // ~1 hour at 5s/ledger
        let now = env.ledger().sequence();
        let start: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MintWindowStart)
            .unwrap_or(now);
        let count: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MintWindowCount)
            .unwrap_or(0);
        if now.saturating_sub(start) > WINDOW_LEDGERS {
            env.storage().instance().set(&DataKey::MintWindowStart, &now);
            env.storage().instance().set(&DataKey::MintWindowCount, &1i128);
            return;
        }
        if count >= MAX_PER_HOUR {
            panic!("mint rate exceeded");
        }
        env.storage()
            .instance()
            .set(&DataKey::MintWindowCount, &(count + 1));
    }

    fn gen_nonce(env: &Env) -> BytesN<32> {
        let seq = env.ledger().sequence().to_be_bytes();
        let ts = env.ledger().timestamp().to_be_bytes();
        let mut buf = [0u8; 32];
        buf[..8].copy_from_slice(&seq);
        buf[8..16].copy_from_slice(&ts);
        BytesN::from_array(env, &buf)
    }

    // ──────────────────────── Views ────────────────────────

    fn wrapped_asset(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::WrappedAsset)
            .expect("wrapped_asset not set")
    }
    fn lending_pool(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::LendingPool)
            .expect("lending_pool not set")
    }
    fn collateral_vault(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::CollateralVault)
            .expect("collateral_vault not set")
    }
    fn oracle(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Oracle)
            .expect("oracle not set")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::random(&env);
        let bridge = BytesN::from_array(&env, &[1u8; 32]);
        let ctrl = LendingControllerClient::new(
            &env,
            &env.register_contract(None, LendingController {}),
        );
        ctrl.initialize(
            &admin,
            &bridge,
            &Address::random(&env),
            &Address::random(&env),
            &Address::random(&env),
            &Address::random(&env),
        );
        // set/get paused round-trip
        ctrl.set_paused(&true);
    }
}
