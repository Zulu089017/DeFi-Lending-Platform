//! # Governance Integration Tests
//!
//! Tests the full governance lifecycle: proposal creation, voting,
//! quorum enforcement, execution, and cancellation.

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Symbol, Vec,
};

#[cfg(test)]
mod tests {
    #![allow(non_snake_case)]
    use super::*;

    /// Deploy a fresh governance contract.
    fn deploy_gov(env: &Env) -> (governance::GovernanceClient, Address) {
        let admin = Address::generate(env);
        let token = Address::generate(env);
        let gov = governance::GovernanceClient::new(env, &env.register(governance::Governance {}, ()));
        gov.initialize(&admin, &token);
        (gov, admin)
    }

    /// Create a simple proposal.
    fn propose(
        env: &Env,
        gov: &governance::GovernanceClient,
        proposer: &Address,
        title: &str,
        desc: &str,
    ) -> u64 {
        let target = Address::generate(env);
        let calldata = Vec::new(env);
        gov.propose(
            proposer,
            &Symbol::new(env, title),
            &Symbol::new(env, desc),
            &target,
            &calldata,
        )
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FULL LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    /// Create proposal → vote for → time passes → execute → verify state.
    #[test]
    fn test_full_governance_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        // 1. Create proposal
        let id = propose(&env, &gov, &proposer, "Add XLM", "Proposal to list XLM");
        assert_eq!(id, 1);
        assert_eq!(gov.proposal_count(), 1);

        let p = gov.get_proposal(&id);
        assert!(!p.executed);
        assert!(!p.cancelled);
        assert_eq!(p.for_votes, 0);
        assert_eq!(p.against_votes, 0);

        // 2. Vote for
        gov.vote(&voter, &id, &true);
        let p = gov.get_proposal(&id);
        assert_eq!(p.for_votes, 1);

        // 3. Advance past voting period
        let end = p.end_ledger;
        env.ledger().set_sequence_number(end + 1);

        // 4. Execute
        gov.execute(&id);
        let p = gov.get_proposal(&id);
        assert!(p.executed, "proposal should be executed");

        // 5. Execute again must revert
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.execute(&id);
        }));
        assert!(result.is_err(), "double-execute must revert");
    }

    /// Proposal defeated when against votes exceed for votes.
    #[test]
    fn test_proposal_defeated() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);
        let for_voter = Address::generate(&env);
        let against_voter1 = Address::generate(&env);
        let against_voter2 = Address::generate(&env);

        let id = propose(&env, &gov, &proposer, "Test", "Test proposal");

        gov.vote(&for_voter, &id, &true);
        gov.vote(&against_voter1, &id, &false);
        gov.vote(&against_voter2, &id, &false);

        let p = gov.get_proposal(&id);
        assert_eq!(p.for_votes, 1);
        assert_eq!(p.against_votes, 2);

        // Advance past voting period
        env.ledger().set_sequence_number(p.end_ledger + 1);

        // Execute must revert because against > for
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.execute(&id);
        }));
        assert!(result.is_err(), "defeated proposal must not execute");
    }

    /// Double-vote by same voter must revert.
    #[test]
    fn test_double_vote_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let id = propose(&env, &gov, &proposer, "Test", "Test");
        gov.vote(&voter, &id, &true);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.vote(&voter, &id, &false);
        }));
        assert!(result.is_err(), "double vote must revert");
    }

    /// Vote after voting period ended must revert.
    #[test]
    fn test_vote_after_period_ended_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let id = propose(&env, &gov, &proposer, "Test", "Test");

        // Advance past voting end
        let p = gov.get_proposal(&id);
        env.ledger().set_sequence_number(p.end_ledger + 1);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.vote(&voter, &id, &true);
        }));
        assert!(result.is_err(), "vote after period must revert");
    }

    /// Execute before voting period ends must revert.
    #[test]
    fn test_execute_before_voting_ends_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let id = propose(&env, &gov, &proposer, "Test", "Test");
        gov.vote(&voter, &id, &true);

        // Voting still active — execute must revert
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.execute(&id);
        }));
        assert!(result.is_err(), "execute before end must revert");
    }

    /// Cancel proposal (proposer only).
    #[test]
    fn test_cancel_proposal() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);

        let id = propose(&env, &gov, &proposer, "Test", "Test");

        gov.cancel(&proposer, &id);
        let p = gov.get_proposal(&id);
        assert!(p.cancelled, "proposal should be cancelled");

        // Execute cancelled proposal must revert
        env.ledger().set_sequence_number(p.end_ledger + 1);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.execute(&id);
        }));
        assert!(result.is_err(), "execute cancelled proposal must revert");
    }

    /// Non-proposer cannot cancel.
    #[test]
    fn test_non_proposer_cannot_cancel() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);
        let stranger = Address::generate(&env);

        let id = propose(&env, &gov, &proposer, "Test", "Test");

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.cancel(&stranger, &id);
        }));
        assert!(result.is_err(), "stranger must not cancel");
    }

    /// Multiple proposals with independent voting states.
    #[test]
    fn test_multiple_proposals_independent_state() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);

        let id1 = propose(&env, &gov, &proposer, "Prop 1", "First");
        let id2 = propose(&env, &gov, &proposer, "Prop 2", "Second");
        assert_eq!(gov.proposal_count(), 2);

        // Vote for on prop1, against on prop2
        gov.vote(&voter1, &id1, &true);
        gov.vote(&voter2, &id1, &true);
        gov.vote(&voter1, &id2, &false);

        let p1 = gov.get_proposal(&id1);
        assert_eq!(p1.for_votes, 2);
        assert_eq!(p1.against_votes, 0);

        let p2 = gov.get_proposal(&id2);
        assert_eq!(p2.for_votes, 0);
        assert_eq!(p2.against_votes, 1);

        // Advance past both voting periods
        let end = p1.end_ledger.max(p2.end_ledger);
        env.ledger().set_sequence_number(end + 1);

        // Prop1 passes (2 for, 0 against, quorum = 5% of 2 = 0.1 => rounded down to 0 => 2 > 0)
        gov.execute(&id1);
        assert!(gov.get_proposal(&id1).executed);

        // Prop2 fails (0 for, 1 against)
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            gov.execute(&id2);
        }));
        assert!(result.is_err(), "defeated prop2 must not execute");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FUZZ: RANDOM VOTE SEQUENCES
    // ═══════════════════════════════════════════════════════════════════════

    /// Fuzz test: random vote patterns, verify execution only when for > against.
    #[test]
    fn fuzz_governance_vote_patterns() {
        let env = Env::default();
        env.mock_all_auths();
        let (gov, _admin) = deploy_gov(&env);
        let proposer = Address::generate(&env);

        // Use a simple deterministic seed based on ledger sequence.
        let seed = env.ledger().sequence() as u64;
        let mut state = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);

        for round in 0..20 {
            let title = format!("Prop_{round}");
            let id = propose(&env, &gov, &proposer, &title, "Fuzz proposal");

            let mut for_votes: i128 = 0;
            let mut against_votes: i128 = 0;

            // Random number of voters (1-10).
            let num_voters = ((state % 10) + 1) as usize;
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);

            for _ in 0..num_voters {
                let voter = Address::generate(&env);
                let support = (state & 1) == 1;
                state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);

                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    gov.vote(&voter, &id, &support);
                }));
                if result.is_ok() {
                    if support {
                        for_votes += 1;
                    } else {
                        against_votes += 1;
                    }
                }
            }

            // Advance past voting period
            let p = gov.get_proposal(&id);
            env.ledger().set_sequence_number(p.end_ledger + 1);

            // Try to execute
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                gov.execute(&id);
            }));

            if for_votes > against_votes && for_votes > 0 {
                assert!(
                    result.is_ok(),
                    "round {round}: should execute (for={for_votes} > against={against_votes})"
                );
                assert!(gov.get_proposal(&id).executed);
            } else {
                assert!(
                    result.is_err(),
                    "round {round}: must not execute (for={for_votes} <= against={against_votes})"
                );
                // cancel to clean up
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    gov.cancel(&proposer, &id);
                }));
            }
        }
    }
}
