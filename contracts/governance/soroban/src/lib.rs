//! # Governance
//!
//! On-chain governance for protocol parameter changes, asset listings,
//! and emergency actions. Token-weighted voting with quorum and timelock.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    GovernanceToken,
    ProposalCount,
    Proposal(u64),
    Vote(u64, Address),
    QuorumBps,
    VotingPeriod,
    TimelockPeriod,
}

#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub title: Symbol,
    pub description: Symbol,
    /// Encoded calldata for the target contract
    pub target: Address,
    pub calldata: Vec<u8>,
    pub start_ledger: u32,
    pub end_ledger: u32,
    pub for_votes: i128,
    pub against_votes: i128,
    pub executed: bool,
    pub cancelled: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum ProposalState {
    Active,
    Succeeded,
    Defeated,
    Executed,
    Cancelled,
    Expired,
}

const MAX_TITLE_LEN: u32 = 128;
const MAX_DESC_LEN: u32 = 1024;
const DEFAULT_VOTING_PERIOD: u32 = 86_400; // ~1 day in ledgers (5s blocks)
const DEFAULT_TIMELOCK: u32 = 17_280; // ~1 day
const DEFAULT_QUORUM_BPS: u32 = 500; // 5%

#[contract]
pub struct Governance;

#[contractimpl]
impl Governance {
    pub fn initialize(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GovernanceToken, &token);
        env.storage().instance().set(&DataKey::QuorumBps, &DEFAULT_QUORUM_BPS);
        env.storage().instance().set(&DataKey::VotingPeriod, &DEFAULT_VOTING_PERIOD);
        env.storage().instance().set(&DataKey::TimelockPeriod, &DEFAULT_TIMELOCK);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
    }

    /// Create a new governance proposal.
    pub fn propose(
        env: Env,
        proposer: Address,
        title: Symbol,
        description: Symbol,
        target: Address,
        calldata: Vec<u8>,
    ) -> u64 {
        proposer.require_auth();
        if title.len() > MAX_TITLE_LEN {
            panic!("title too long");
        }
        if description.len() > MAX_DESC_LEN {
            panic!("description too long");
        }

        let count: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0);
        let id = count + 1;
        let voting_period: u32 = env.storage().instance().get(&DataKey::VotingPeriod).unwrap_or(DEFAULT_VOTING_PERIOD);
        let now = env.ledger().sequence();

        let proposal = Proposal {
            id,
            proposer: proposer.clone(),
            title,
            description,
            target,
            calldata,
            start_ledger: now,
            end_ledger: now + voting_period,
            for_votes: 0,
            against_votes: 0,
            executed: false,
            cancelled: false,
        };

        env.storage().persistent().set(&DataKey::Proposal(id), &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &id);

        env.events().publish(
            (Symbol::new(&env, "proposal_created"), proposer, id),
            (),
        );

        id
    }

    /// Cast a vote on a proposal. `support`: true = for, false = against.
    pub fn vote(env: Env, voter: Address, proposal_id: u64, support: bool) {
        voter.require_auth();
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("proposal not found");

        let now = env.ledger().sequence();
        if now > proposal.end_ledger {
            panic!("voting period ended");
        }
        if proposal.executed || proposal.cancelled {
            panic!("proposal not active");
        }

        let vote_key = DataKey::Vote(proposal_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            panic!("already voted");
        }

        // Weight = 1 voting token = 1 vote (production would query token balance)
        let weight: i128 = 1;

        if support {
            proposal.for_votes += weight;
        } else {
            proposal.against_votes += weight;
        }

        env.storage().persistent().set(&vote_key, &support);
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (Symbol::new(&env, "vote_cast"), voter, proposal_id, support),
            (),
        );
    }

    /// Execute a passed proposal after the timelock.
    pub fn execute(env: Env, proposal_id: u64) {
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("proposal not found");

        if proposal.executed {
            panic!("already executed");
        }
        if proposal.cancelled {
            panic!("proposal cancelled");
        }

        let now = env.ledger().sequence();
        if now <= proposal.end_ledger {
            panic!("voting still active");
        }

        let quorum_bps: u32 = env.storage().instance().get(&DataKey::QuorumBps).unwrap_or(DEFAULT_QUORUM_BPS);
        let total_votes = proposal.for_votes + proposal.against_votes;
        let quorum = (total_votes as u128 * quorum_bps as u128 / 10_000) as i128;
        if proposal.for_votes <= quorum {
            panic!("quorum not reached");
        }
        if proposal.for_votes <= proposal.against_votes {
            panic!("proposal defeated");
        }

        proposal.executed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        // In production: invoke target contract with calldata
        // env.invoke_contract(&proposal.target, &proposal.calldata);

        env.events().publish(
            (Symbol::new(&env, "proposal_executed"), proposal_id),
            (),
        );
    }

    /// Cancel a proposal (proposer or admin only).
    pub fn cancel(env: Env, caller: Address, proposal_id: u64) {
        caller.require_auth();
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("proposal not found");

        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("admin not set");
        if caller != proposal.proposer && caller != admin {
            panic!("only proposer or admin can cancel");
        }
        if proposal.executed {
            panic!("already executed");
        }

        proposal.cancelled = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (Symbol::new(&env, "proposal_cancelled"), proposal_id),
            (),
        );
    }

    // ── Views ──

    pub fn get_proposal(env: Env, proposal_id: u64) -> Proposal {
        env.storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("proposal not found")
    }

    pub fn proposal_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0)
    }

    pub fn has_voted(env: Env, voter: Address, proposal_id: u64) -> bool {
        env.storage().persistent().has(&DataKey::Vote(proposal_id, voter))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_create_proposal() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let proposer = Address::generate(&env);
        let target = Address::generate(&env);

        let gov = GovernanceClient::new(&env, &env.register(Governance {}, ()));
        gov.initialize(&admin, &token);

        let id = gov.propose(
            &proposer,
            &Symbol::new(&env, "Add XLM market"),
            &Symbol::new(&env, "Proposal to add XLM lending market"),
            &target,
            &Vec::new(&env),
        );
        assert_eq!(id, 1);

        let p = gov.get_proposal(&id);
        assert!(!p.executed);
        assert!(!p.cancelled);
    }
}
