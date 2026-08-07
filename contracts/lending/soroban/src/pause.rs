// Emergency Pause Mechanism
// Allows the admin to pause and unpause the lending pool in case of emergency.
// When paused, all state-changing operations (supply, borrow, withdraw, repay) are blocked.
// View functions remain accessible.

use crate::PauseToggled;
use soroban_sdk::{contracttype, Env};

#[contracttype]
#[derive(Clone)]
pub enum PauseKey {
    Paused,
}

/// Check if the contract is paused. Panics if paused.
pub fn require_not_paused(env: &Env) {
    let paused: bool = env
        .storage()
        .instance()
        .get(&PauseKey::Paused)
        .unwrap_or(false);
    if paused {
        panic!("contract is paused");
    }
}

/// Set the pause state. Only callable by admin (enforced by caller).
pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&PauseKey::Paused, &paused);
    PauseToggled { paused }.publish(env);
}

/// Check current pause state (view).
pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&PauseKey::Paused)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_pause_unpause() {
        let env = Env::default();
        let contract_id = env.register(crate::LendingPool {}, ());
        env.as_contract(&contract_id, || {
            assert!(!is_paused(&env));

            set_paused(&env, true);
            assert!(is_paused(&env));

            set_paused(&env, false);
            assert!(!is_paused(&env));
        });
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn test_require_not_paused_panics() {
        let env = Env::default();
        let contract_id = env.register(crate::LendingPool {}, ());
        env.as_contract(&contract_id, || {
            set_paused(&env, true);
            require_not_paused(&env);
        });
    }
}
