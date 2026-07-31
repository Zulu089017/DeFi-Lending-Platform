# OpenLend Governance Model

> How protocol parameters are proposed, decided, and executed.

## Principles

OpenLend governance is **minimally viable** at launch: a multisig of
trusted signers that can be replaced by a full DAO after the protocol
matures and has been audited. The goal is safety-first: enable
parameter updates and emergency intervention without creating a
complex governance token that could be attacked before the protocol is
battle-tested.

## Roles

| Role | Scope | Incumbent |
|---|---|---|
| **Protocol Admin** | Upgrade contracts, change attesters, set oracle publishers | 3-of-5 multisig (Gnosis Safe) |
| **Attesters** | Sign bridge wrap/release attestations | 2-of-3 off-chain signers |
| **Oracle Publishers** | Submit price updates | 3 publishers with staggered keys |
| **Emergency Pauser** | Pause the protocol in an emergency | Protocol Admin (same multisig) |
| **Treasury Guardian** | Manage protocol fee treasury | 2-of-3 multisig (separate from Admin) |

## Parameter governance

| Parameter | Who can change | Timelock | Quorum |
|---|---|---|---|
| Collateral LTV | Protocol Admin | 24h | 3/5 |
| Liquidation bonus | Protocol Admin | 24h | 3/5 |
| Fee BPS | Protocol Admin | 48h | 4/5 |
| Attester set | Protocol Admin | 48h | 4/5 |
| Oracle publishers | Protocol Admin | 24h | 3/5 |
| Pause / unpause | Protocol Admin | 0h | 3/5 |
| Contract upgrade | Protocol Admin | 72h | 4/5 |
| Treasury withdrawal | Treasury Guardian | 72h | 2/3 |

## Timelock

All non-emergency parameter changes go through a **24–72 hour
timelock**:

1. **Proposal**: a multisig signer creates a transaction on the
   timelock contract.
2. **Queue**: the timelock contract stores the call data and an
   `eta` timestamp.
3. **Execute**: after `eta`, anyone can call `execute()` to apply the
   change.

During the timelock window, the community can verify the proposed
change and exit if it is malicious.

## Future: Governance token

A governance token (`OPEN`) is planned but will not be launched until:

- The protocol has been audited by two independent firms.
- At least 6 months of incident-free mainnet operation.
- A formal tokenomics model is published and reviewed.

At that point, the multisig will be replaced by token-weighted
governance with delegation (similar to Compound's Governor Bravo).

## Emergency override

The Protocol Admin multisig can bypass the timelock only when:

- The `Paused` flag is `true` (already in emergency mode), OR
- A new critical vulnerability is reported and confirmed by at least 2
  independent security researchers.

Every emergency action is logged on-chain and retroactively reviewed.
