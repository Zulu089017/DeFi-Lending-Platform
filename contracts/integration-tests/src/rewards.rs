//! # Rewards (Yield Distribution) Integration Tests
//!
//! Tests staking, reward accrual, claiming, and multi-user reward
//! distribution fairness.

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Symbol,
};

#[cfg(test)]
mod tests {
    #![allow(non_snake_case)]
    use super::*;

    /// Deploy a fresh rewards contract.
    fn deploy_rewards(env: &Env) -> (rewards::RewardsClient<'_>, Address) {
        let admin = Address::generate(env);
        let r = rewards::RewardsClient::new(env, &env.register(rewards::Rewards {}, ()));
        r.initialize(&admin);
        (r, admin)
    }

    /// Set up a reward pool and advance some ledgers to accrue.
    fn setup_with_rewards(
        _env: &Env,
        r: &rewards::RewardsClient,
        admin: &Address,
        asset: &Symbol,
        amount: i128,
    ) {
        r.notify_reward(admin, asset, &amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FULL LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    /// Full lifecycle: notify → stake → accrue → claim → verify state.
    #[test]
    fn test_full_rewards_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let (r, admin) = deploy_rewards(&env);
        let user = Address::generate(&env);
        let asset = Symbol::new(&env, "XLM");

        // 1. Notify reward pool
        setup_with_rewards(&env, &r, &admin, &asset, 1_000_000i128);
        assert!(r.reward_rate(&asset) > 0, "reward rate should be set");

        // 2. Stake
        r.stake(&user, &asset, &500i128);
        assert_eq!(r.total_staked(&asset), 500i128);

        // 3. Advance ledgers to accrue
        env.ledger()
            .set_sequence_number(env.ledger().sequence() + 1_000);

        // 4. Check earned (should be > 0 after time passes)
        let earned = r.earned(&user, &asset);
        assert!(earned > 0, "should have earned rewards after staking");

        // 5. Claim
        let before_claim = r.total_staked(&asset);
        let claimed = r.claim(&user, &asset);
        assert!(claimed > 0, "claimed must be > 0");
        assert_eq!(
            r.total_staked(&asset),
            before_claim,
            "staking not affected by claim"
        );
        assert_eq!(r.earned(&user, &asset), 0, "earned resets to 0 after claim");

        // 6. Unstake
        r.unstake(&user, &asset, &500i128);
        assert_eq!(r.total_staked(&asset), 0i128);

        // 7. Claim after full unstake returns 0
        assert_eq!(r.earned(&user, &asset), 0);
    }

    /// Multi-user: proportional rewards for different stake amounts.
    #[test]
    fn test_multi_user_proportional_rewards() {
        let env = Env::default();
        env.mock_all_auths();
        let (r, admin) = deploy_rewards(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let asset = Symbol::new(&env, "XLM");

        setup_with_rewards(&env, &r, &admin, &asset, 1_000_000i128);

        // Alice stakes 300, Bob stakes 100
        r.stake(&alice, &asset, &300i128);
        r.stake(&bob, &asset, &100i128);
        assert_eq!(r.total_staked(&asset), 400i128);

        // Advance ledgers
        env.ledger()
            .set_sequence_number(env.ledger().sequence() + 2_000);

        let alice_earned = r.earned(&alice, &asset);
        let bob_earned = r.earned(&bob, &asset);

        // Alice has 3x Bob's stake → should earn ~3x as much.
        assert!(
            alice_earned > bob_earned,
            "Alice should earn more due to larger stake"
        );

        // Proportional check: ratio should be roughly 3:1 (± 5% rounding tolerance)
        let ratio = alice_earned.checked_mul(100).expect("overflow") / bob_earned.max(1);
        assert!(
            (285..=315).contains(&ratio),
            "Alice/Bob ratio ~3:1, got {ratio}%"
        );

        // Both claim
        let alice_claimed = r.claim(&alice, &asset);
        let bob_claimed = r.claim(&bob, &asset);
        assert_eq!(alice_claimed, alice_earned);
        assert_eq!(bob_claimed, bob_earned);
    }

    /// Unstake reduces rewards; claim after partial unstake works.
    #[test]
    fn test_unstake_reduces_accrual() {
        let env = Env::default();
        env.mock_all_auths();
        let (r, admin) = deploy_rewards(&env);
        let user = Address::generate(&env);
        let asset = Symbol::new(&env, "XLM");

        setup_with_rewards(&env, &r, &admin, &asset, 1_000_000i128);

        r.stake(&user, &asset, &1000i128);
        env.ledger()
            .set_sequence_number(env.ledger().sequence() + 500);
        let earned_full = r.earned(&user, &asset);

        // Unstake half
        r.unstake(&user, &asset, &500i128);
        assert_eq!(r.total_staked(&asset), 500i128);

        // Advance more
        env.ledger()
            .set_sequence_number(env.ledger().sequence() + 500);
        let earned_half = r.earned(&user, &asset);

        // earned_half should be > earned_full (accrued before unstake + lower rate after)
        assert!(
            earned_half > earned_full,
            "earned should accumulate: before={earned_full} after={earned_half}"
        );

        let claimed = r.claim(&user, &asset);
        assert_eq!(claimed, earned_half);
    }

    /// Claim with no stake should return 0.
    #[test]
    fn test_no_stake_no_rewards() {
        let env = Env::default();
        env.mock_all_auths();
        let (r, admin) = deploy_rewards(&env);
        let user = Address::generate(&env);
        let asset = Symbol::new(&env, "XLM");

        setup_with_rewards(&env, &r, &admin, &asset, 1_000_000i128);

        assert_eq!(r.earned(&user, &asset), 0, "no stake = no earned");
        assert_eq!(r.claim(&user, &asset), 0, "no stake = no claim");
    }

    /// Insufficient stake for unstake must revert.
    #[test]
    fn test_unstake_exceeding_balance_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (r, _admin) = deploy_rewards(&env);
        let user = Address::generate(&env);
        let asset = Symbol::new(&env, "XLM");

        r.stake(&user, &asset, &100i128);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            r.unstake(&user, &asset, &101i128);
        }));
        assert!(result.is_err(), "unstake > stake must revert");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FUZZ: RANDOM STAKE/UNSTAKE/CLAIM SEQUENCES
    // ═══════════════════════════════════════════════════════════════════════

    /// Fuzz test: random sequences of stake/unstake/claim with multiple users,
    /// verifying that total claimed ≤ reward pool.
    #[test]
    fn fuzz_rewards_multi_user_random_ops() {
        let env = Env::default();
        env.mock_all_auths();
        let (r, admin) = deploy_rewards(&env);
        let asset = Symbol::new(&env, "XLM");
        let reward_amount = 10_000_000i128;

        setup_with_rewards(&env, &r, &admin, &asset, reward_amount);

        let mut seed = env.ledger().sequence() as u64;
        let num_users: usize = 5;
        let users: Vec<Address> = (0..num_users).map(|_| Address::generate(&env)).collect();
        let mut stakes: Vec<i128> = vec![0; num_users];
        let mut total_claimed: i128 = 0;

        for step in 0..50 {
            seed = seed
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            let user_idx = (seed as usize) % num_users;
            let user = &users[user_idx];
            let action = seed % 3;

            match action {
                0 => {
                    // Stake
                    let amount = ((seed % 500) + 1) as i128;
                    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        r.stake(user, &asset, &amount);
                    }));
                    if result.is_ok() {
                        stakes[user_idx] += amount;
                    }
                }
                1 => {
                    // Unstake
                    if stakes[user_idx] > 0 {
                        let amount = ((seed % stakes[user_idx] as u64) + 1) as i128;
                        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                            r.unstake(user, &asset, &amount);
                        }));
                        if result.is_ok() {
                            stakes[user_idx] -= amount;
                        }
                    }
                }
                _ => {
                    // Claim
                    let claimed = r.claim(user, &asset);
                    total_claimed += claimed;
                    // Claimed must not exceed the total reward pool.
                    assert!(
                        total_claimed <= reward_amount,
                        "step {step}: total claimed ({total_claimed}) exceeds pool ({reward_amount})"
                    );
                }
            }

            // Advance a few ledgers each step
            env.ledger()
                .set_sequence_number(env.ledger().sequence() + 10);

            // Invariant: total_staked >= 0
            assert!(r.total_staked(&asset) >= 0);
        }

        // Final: total_staked should match sum of individual stakes.
        let total_staked = r.total_staked(&asset);
        let sum_stakes: i128 = stakes.iter().sum();
        assert_eq!(
            total_staked, sum_stakes,
            "total_staked must equal sum of stakes"
        );
    }
}
