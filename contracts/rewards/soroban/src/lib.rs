#![no_std]

//! # Rewards (Yield Distribution)
//!
//! Distributes protocol fees and governance-directed incentives to
//! liquidity providers and stakers. Rewards accrue per-block and can
//! be claimed at any time.
//!
//! ## Entry points
//! - `initialize(admin)` — one-time setup
//! - `notify_reward(asset, amount)` — admin deposits reward tokens
//! - `stake(user, asset, amount)` — stake LP tokens to earn rewards
//! - `unstake(user, asset, amount)` — withdraw staked LP tokens
//! - `claim(user, asset)` — claim accrued rewards
//! - `earned(user, asset)` — view accrued but unclaimed rewards
//! - `total_staked(asset)` — view total staked amount per asset
//! - `reward_rate(asset)` — current reward rate per second

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// asset => total staked
    TotalStaked(Symbol),
    /// asset => total reward deposited (remaining pool)
    RewardPool(Symbol),
    /// asset => reward rate per second (in 7-decimal units)
    RewardRate(Symbol),
    /// asset => last update ledger sequence
    LastUpdate(Symbol),
    /// asset => accumulated reward per staked unit (1e18 scale)
    RewardPerToken(Symbol),
    /// (user, asset) => staked amount
    Stake(Address, Symbol),
    /// (user, asset) => reward per token paid snapshot
    RewardPerTokenPaid(Address, Symbol),
    /// (user, asset) => accrued but unclaimed rewards
    Accrued(Address, Symbol),
}

const SCALE: i128 = 1_000_000_000_000_000_000; // 1e18

// ──────────────────────── Events ────────────────────────

#[contractevent(data_format = "vec")]
pub struct RewardNotified {
    asset: Symbol,
    amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct Staked {
    user: Address,
    asset: Symbol,
    amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct Unstaked {
    user: Address,
    asset: Symbol,
    amount: i128,
}

#[contractevent(data_format = "vec")]
pub struct Claimed {
    user: Address,
    asset: Symbol,
    amount: i128,
}

#[contract]
pub struct Rewards;

#[contractimpl]
impl Rewards {
    /// One-time initialisation. Only callable once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Admin deposits reward tokens for an asset. Updates the reward rate.
    pub fn notify_reward(env: Env, admin: Address, asset: Symbol, amount: i128) {
        Self::require_admin(&env);
        admin.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        Self::update_reward(&env, &asset);

        let pool = env
            .storage()
            .persistent()
            .get(&DataKey::RewardPool(asset.clone()))
            .unwrap_or(0i128);
        let new_pool = pool.checked_add(amount).expect("overflow");
        env.storage()
            .persistent()
            .set(&DataKey::RewardPool(asset.clone()), &new_pool);

        // Reward rate per 5-second ledger: amount / (7 days / 5s) ≈ amount / 120960
        let duration_ledgers: i128 = 7 * 24 * 60 * 60 / 5; // ~120960 ledgers per week
        let rate = amount
            .checked_mul(SCALE)
            .expect("overflow")
            .checked_div(duration_ledgers)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::RewardRate(asset.clone()), &rate);
        env.storage().persistent().set(
            &DataKey::LastUpdate(asset.clone()),
            &env.ledger().sequence(),
        );

        RewardNotified { asset, amount }.publish(&env);
    }

    /// Stake LP tokens to earn rewards.
    pub fn stake(env: Env, user: Address, asset: Symbol, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        Self::update_reward(&env, &asset);

        let stake_key = DataKey::Stake(user.clone(), asset.clone());
        let cur_stake = env.storage().persistent().get(&stake_key).unwrap_or(0i128);

        // Credit accrued rewards before updating stake
        let rpt_key = DataKey::RewardPerTokenPaid(user.clone(), asset.clone());
        let rpt = Self::reward_per_token(&env, &asset);
        let accrued = if cur_stake > 0 {
            cur_stake
                .checked_mul(
                    rpt.checked_sub(env.storage().persistent().get(&rpt_key).unwrap_or(0i128))
                        .expect("underflow"),
                )
                .expect("overflow")
                .checked_div(SCALE)
                .expect("overflow")
        } else {
            0i128
        };
        let acc_key = DataKey::Accrued(user.clone(), asset.clone());
        let existing_accrued = env.storage().persistent().get(&acc_key).unwrap_or(0i128);
        env.storage().persistent().set(
            &acc_key,
            &existing_accrued.checked_add(accrued).expect("overflow"),
        );

        // Update stake
        let new_stake = cur_stake.checked_add(amount).expect("overflow");
        env.storage().persistent().set(&stake_key, &new_stake);
        env.storage().persistent().set(&rpt_key, &rpt);

        // Update total staked
        let total = env
            .storage()
            .persistent()
            .get(&DataKey::TotalStaked(asset.clone()))
            .unwrap_or(0i128);
        env.storage().persistent().set(
            &DataKey::TotalStaked(asset.clone()),
            &total.checked_add(amount).expect("overflow"),
        );

        Staked {
            user,
            asset,
            amount,
        }
        .publish(&env);
    }

    /// Unstake LP tokens. Accrued rewards are credited before unstaking.
    pub fn unstake(env: Env, user: Address, asset: Symbol, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        Self::update_reward(&env, &asset);

        let stake_key = DataKey::Stake(user.clone(), asset.clone());
        let cur_stake = env.storage().persistent().get(&stake_key).unwrap_or(0i128);
        if cur_stake < amount {
            panic!("insufficient stake");
        }

        // Credit accrued rewards
        let rpt_key = DataKey::RewardPerTokenPaid(user.clone(), asset.clone());
        let rpt = Self::reward_per_token(&env, &asset);
        let accrued = cur_stake
            .checked_mul(
                rpt.checked_sub(env.storage().persistent().get(&rpt_key).unwrap_or(0i128))
                    .expect("underflow"),
            )
            .expect("overflow")
            .checked_div(SCALE)
            .expect("overflow");
        let acc_key = DataKey::Accrued(user.clone(), asset.clone());
        let existing_accrued = env.storage().persistent().get(&acc_key).unwrap_or(0i128);
        env.storage().persistent().set(
            &acc_key,
            &existing_accrued.checked_add(accrued).expect("overflow"),
        );

        // Update stake
        let new_stake = cur_stake.checked_sub(amount).expect("underflow");
        env.storage().persistent().set(&stake_key, &new_stake);
        env.storage().persistent().set(&rpt_key, &rpt);

        // Update total staked
        let total = env
            .storage()
            .persistent()
            .get(&DataKey::TotalStaked(asset.clone()))
            .unwrap_or(0i128);
        env.storage().persistent().set(
            &DataKey::TotalStaked(asset.clone()),
            &total.checked_sub(amount).expect("underflow"),
        );

        Unstaked {
            user,
            asset,
            amount,
        }
        .publish(&env);
    }

    /// Claim all accrued rewards for a given asset.
    pub fn claim(env: Env, user: Address, asset: Symbol) -> i128 {
        user.require_auth();
        Self::update_reward(&env, &asset);

        let stake_key = DataKey::Stake(user.clone(), asset.clone());
        let cur_stake = env.storage().persistent().get(&stake_key).unwrap_or(0i128);
        let rpt_key = DataKey::RewardPerTokenPaid(user.clone(), asset.clone());
        let rpt = Self::reward_per_token(&env, &asset);

        // Accrue any new rewards since last checkpoint
        let new_accrued = if cur_stake > 0 {
            cur_stake
                .checked_mul(
                    rpt.checked_sub(env.storage().persistent().get(&rpt_key).unwrap_or(0i128))
                        .expect("underflow"),
                )
                .expect("overflow")
                .checked_div(SCALE)
                .expect("overflow")
        } else {
            0i128
        };
        let acc_key = DataKey::Accrued(user.clone(), asset.clone());
        let total_accrued = env
            .storage()
            .persistent()
            .get(&acc_key)
            .unwrap_or(0i128)
            .checked_add(new_accrued)
            .expect("overflow");

        if total_accrued == 0 {
            return 0;
        }

        // Deduct from reward pool
        let pool = env
            .storage()
            .persistent()
            .get(&DataKey::RewardPool(asset.clone()))
            .unwrap_or(0i128);
        if pool < total_accrued {
            panic!("insufficient reward pool");
        }
        env.storage()
            .persistent()
            .set(&DataKey::RewardPool(asset.clone()), &(pool - total_accrued));

        // Reset accrued and checkpoint
        env.storage().persistent().set(&acc_key, &0i128);
        env.storage().persistent().set(&rpt_key, &rpt);

        Claimed {
            user,
            asset,
            amount: total_accrued,
        }
        .publish(&env);

        total_accrued
    }

    /// View accrued (but unclaimed) rewards for a user/asset.
    pub fn earned(env: Env, user: Address, asset: Symbol) -> i128 {
        let stake = env
            .storage()
            .persistent()
            .get(&DataKey::Stake(user.clone(), asset.clone()))
            .unwrap_or(0i128);
        if stake == 0 {
            return env
                .storage()
                .persistent()
                .get(&DataKey::Accrued(user.clone(), asset.clone()))
                .unwrap_or(0);
        }
        let rpt = Self::reward_per_token(&env, &asset);
        let paid = env
            .storage()
            .persistent()
            .get(&DataKey::RewardPerTokenPaid(user.clone(), asset.clone()))
            .unwrap_or(0i128);
        let delta = rpt.checked_sub(paid).unwrap_or(0);
        let pending = stake
            .checked_mul(delta)
            .expect("overflow")
            .checked_div(SCALE)
            .expect("overflow");
        let existing = env
            .storage()
            .persistent()
            .get(&DataKey::Accrued(user, asset))
            .unwrap_or(0i128);
        existing.checked_add(pending).expect("overflow")
    }

    /// Total staked amount for an asset.
    pub fn total_staked(env: Env, asset: Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalStaked(asset))
            .unwrap_or(0)
    }

    /// Current reward rate per ledger for an asset (scaled 1e18).
    pub fn reward_rate(env: Env, asset: Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::RewardRate(asset))
            .unwrap_or(0)
    }

    // ──────────────────────── INTERNAL ────────────────────────

    fn reward_per_token(env: &Env, asset: &Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::RewardPerToken(asset.clone()))
            .unwrap_or(0)
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not set");
        admin.require_auth();
    }

    /// Accrue rewards since the last update (per-ledger pacing).
    fn update_reward(env: &Env, asset: &Symbol) {
        let total = env
            .storage()
            .persistent()
            .get(&DataKey::TotalStaked(asset.clone()))
            .unwrap_or(0i128);
        let rpt = Self::reward_per_token(env, asset);
        let last: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::LastUpdate(asset.clone()))
            .unwrap_or(env.ledger().sequence());
        let now = env.ledger().sequence();
        if now <= last || total == 0 {
            env.storage()
                .persistent()
                .set(&DataKey::LastUpdate(asset.clone()), &now);
            return;
        }
        let rate = env
            .storage()
            .persistent()
            .get(&DataKey::RewardRate(asset.clone()))
            .unwrap_or(0i128);
        if rate == 0 {
            env.storage()
                .persistent()
                .set(&DataKey::LastUpdate(asset.clone()), &now);
            return;
        }
        let ledgers = (now - last) as i128;
        let delta = ledgers
            .checked_mul(rate)
            .expect("overflow")
            .checked_mul(SCALE)
            .expect("overflow");
        let new_rpt = rpt.checked_add(delta).expect("overflow");
        env.storage()
            .persistent()
            .set(&DataKey::RewardPerToken(asset.clone()), &new_rpt);
        env.storage()
            .persistent()
            .set(&DataKey::LastUpdate(asset.clone()), &now);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_stake_and_claim() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let asset = Symbol::new(&env, "XLM");

        let rewards = RewardsClient::new(&env, &env.register(Rewards {}, ()));
        rewards.initialize(&admin);
        rewards.notify_reward(&admin, &asset, &1_000_000);

        rewards.stake(&user, &asset, &100);
        assert_eq!(rewards.total_staked(&asset), 100);
        assert!(rewards.reward_rate(&asset) > 0);

        // Advance ledgers to accrue
        let earned = rewards.earned(&user, &asset);
        assert!(earned >= 0, "earned must be non-negative");

        rewards.unstake(&user, &asset, &50);
        assert_eq!(rewards.total_staked(&asset), 50);

        let claimed = rewards.claim(&user, &asset);
        assert!(claimed > 0, "must claim > 0 after staking with rewards");
    }

    #[test]
    #[should_panic(expected = "insufficient stake")]
    fn test_unstake_exceeding_stake_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let asset = Symbol::new(&env, "XLM");

        let rewards = RewardsClient::new(&env, &env.register(Rewards {}, ()));
        rewards.initialize(&admin);
        rewards.stake(&user, &asset, &100);
        rewards.unstake(&user, &asset, &101);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let rewards = RewardsClient::new(&env, &env.register(Rewards {}, ()));
        rewards.initialize(&admin);
        rewards.initialize(&admin);
    }
}
