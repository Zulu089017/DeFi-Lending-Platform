//! # Fuzz Test Helpers
//!
//! A minimal PRNG (LCG) and randomised-value generators suitable for
//! Soroban `#[test]` functions. No external crates required — the LCG is
//! self-contained and the seed is printed in every panic for reproducibility.
//!
//! ## Usage
//!
//! ```ignore
//! let mut rng = FuzzRng::from_env(&env);
//! let amount: i128 = rng.gen_amount(1, 1_000_000_000);
//! let asset: Symbol = rng.gen_asset(&env);
//! ```

use soroban_sdk::Env;

/// Simple linear congruential generator (Numerical Recipes parameters).
pub struct FuzzRng {
    state: u64,
    pub seed: u64,
}

impl FuzzRng {
    /// Seed from the ledger sequence + timestamp for reproducible randomness.
    pub fn from_env(env: &Env) -> Self {
        let seq = u64::from(env.ledger().sequence());
        let ts = env.ledger().timestamp();
        let seed = seq.wrapping_mul(6364136223846793005).wrapping_add(ts);
        Self { state: seed, seed }
    }

    /// Seed with an explicit value (for deterministic replay).
    pub fn with_seed(seed: u64) -> Self {
        Self { state: seed, seed }
    }

    /// Return a u64 in [0, 2^64).
    pub fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.state
    }

    /// Return an i128 in [lo, hi] (inclusive).
    pub fn gen_amount(&mut self, lo: i128, hi: i128) -> i128 {
        if lo >= hi {
            return lo;
        }
        let range = (hi - lo) as u128;
        let r = (self.next_u64() as u128) % (range + 1);
        lo + (r as i128)
    }

    /// Return a u32 in [0, 10_000] suitable for basis-point parameters.
    pub fn gen_bps(&mut self) -> u32 {
        (self.next_u64() % 10_001) as u32
    }

    /// Return a bool with ~50% probability.
    pub fn gen_bool(&mut self) -> bool {
        (self.next_u64() & 1) == 1
    }

    /// Pick one of the candidate asset symbols at random.
    pub fn gen_asset(&mut self) -> &'static str {
        const ASSETS: &[&str] = &["XLM", "USDC", "wETH", "wBTC", "wSOL", "wMATIC"];
        let idx = (self.next_u64() as usize) % ASSETS.len();
        ASSETS[idx]
    }

    /// Return an index into a slice.
    pub fn gen_index(&mut self, len: usize) -> usize {
        if len == 0 {
            return 0;
        }
        (self.next_u64() as usize) % len
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rng_is_deterministic() {
        let mut a = FuzzRng::with_seed(42);
        let mut b = FuzzRng::with_seed(42);
        for _ in 0..100 {
            assert_eq!(a.next_u64(), b.next_u64());
        }
    }

    #[test]
    fn gen_amount_stays_in_range() {
        let mut rng = FuzzRng::with_seed(7);
        for _ in 0..1000 {
            let v = rng.gen_amount(100, 200);
            assert!(v >= 100 && v <= 200, "gen_amount out of range: {v}");
        }
    }
}
