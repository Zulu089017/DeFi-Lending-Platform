//! # Integration & Fuzz Tests for StellarPay
//!
//! This crate contains three categories of tests:
//!
//! 1. **Cross-contract integration tests** — full lifecycle flows spanning
//!    multiple contracts (wrap → supply → borrow → liquidate → unwrap).
//! 2. **Fuzz tests** — randomised inputs that stress financial math edge
//!    cases (overflow, zero amounts, extreme values, rounding).
//! 3. **Property-based tests** — random sequences of operations followed by
//!    invariant assertions; each test generates a randomised scenario and
//!    checks that invariants from `docs/invariants.md` hold at every step.
//!
//! ## Running
//!
//! ```bash
//! cd contracts && cargo test --workspace --locked
//! ```
//!
//! The fuzz tests use a simple LCG-based PRNG seeded from the Soroban test
//! ledger sequence so that failures are reproducible from the seed logged
//! in the panic message.
//!
//! #![allow(non_snake_case)]

#[cfg(test)]
mod fuzz;
#[cfg(test)]
mod cross_contract;
#[cfg(test)]
mod property;
#[cfg(test)]
mod governance;
#[cfg(test)]
mod rewards;
