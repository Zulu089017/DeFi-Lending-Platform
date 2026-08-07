//! # Integration & Fuzz Tests for StellarPay
//!
//! This crate is test-only and intentionally skipped for wasm targets
//! (it uses std and the soroban-sdk `testutils` feature).
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

// On wasm target (cargo check for deployment), this crate is a no-op.
// On host target (cargo test), std and testutils are available.
#![cfg_attr(target_arch = "wasm32", no_std)]

#[cfg(not(target_arch = "wasm32"))]
extern crate std;

#[cfg(not(target_arch = "wasm32"))]
#[allow(non_snake_case)]
#[cfg(test)]
mod cross_contract;
#[cfg(not(target_arch = "wasm32"))]
#[allow(non_snake_case)]
#[cfg(test)]
mod fuzz;
#[cfg(not(target_arch = "wasm32"))]
#[allow(non_snake_case)]
#[cfg(test)]
mod governance;
#[cfg(not(target_arch = "wasm32"))]
#[allow(non_snake_case)]
#[cfg(test)]
mod property;
#[cfg(not(target_arch = "wasm32"))]
#[allow(non_snake_case)]
#[cfg(test)]
mod rewards;
