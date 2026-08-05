# Protocol Specification — Rate Model

> This document is the formal specification of the StellarPay interest rate model.
> It is the authoritative reference for implementers and auditors.

## Notation

- $U$ — utilization ratio: $U = B / D$ where $B$ = total borrows, $D$ = total
  deposits.
- $U_{kink}$ — the "kink" utilization (default 0.80).
- $R_{base}$ — base borrow APY (default 2% = 200 bps).
- $R_{kink}$ — borrow APY at the kink (default 12% = 1200 bps).
- $R_{max}$ — borrow APY at 100% utilization (default 150% = 15000 bps).
- $R_{supply}$ — supply APY derived from borrow APY.

## Borrow rate

The borrow APY is a piecewise-linear (kinked) function:

$$R_{borrow}(U) = \begin{cases} R_{base} + U \cdot \frac{R_{kink} - R_{base}}{U_{kink}} & \text{if } U \leq U_{kink} \\[4pt] R_{kink} + (U - U_{kink}) \cdot \frac{R_{max} - R_{kink}}{1 - U_{kink}} & \text{if } U > U_{kink} \end{cases}$$

### Example with default parameters

| Utilization | Borrow APY |
| ----------- | ---------- |
| 0%          | 2.00%      |
| 40%         | 7.00%      |
| 80% (kink)  | 12.00%     |
| 90%         | 81.00%     |
| 100%        | 150.00%    |

## Supply rate

The supply APY is derived from the borrow APY, with a protocol reserve factor
$f$ (default 10%):

$$R_{supply}(U) = R_{borrow}(U) \cdot U \cdot (1 - f)$$

The reserve factor $f$ sends a share of interest to a protocol treasury. It does
not reduce depositor yield; it takes from the borrower's interest payment.

### Example

At $U = 0.80$, $R_{borrow} = 12\%$:

$$R_{supply} = 0.12 \cdot 0.80 \cdot (1 - 0.10) = 0.0864 = 8.64\% \text{ APY}$$

## Index-based accrual

Interest is not paid per block in "real" tokens. Instead, a **borrow index**
$I(t)$ is tracked per asset. A user's debt at time $t$ is:

$$debt(t) = principal \cdot \frac{I(t)}{I_{snap}}$$

where $I_{snap}$ is the index value when the user last borrowed or repaid.

The index grows according to:

$$I(t + \Delta t) = I(t) \cdot (1 + R_{borrow} \cdot \frac{\Delta t}{T_{year}})$$

where $T_{year}$ = 31,536,000 seconds (365 days).

## Rate model parameters

| Parameter        | Symbol     | Default   | Configurable? |
| ---------------- | ---------- | --------- | ------------- |
| Base APY         | $R_{base}$ | 200 bps   | Yes (admin)   |
| Kink utilization | $U_{kink}$ | 0.80      | Yes (admin)   |
| Kink APY         | $R_{kink}$ | 1200 bps  | Yes (admin)   |
| Max APY          | $R_{max}$  | 15000 bps | Yes (admin)   |
| Reserve factor   | $f$        | 0.10      | Yes (admin)   |

## Reference implementation

The on-chain implementation is in
`contracts/contracts/lending_pool/src/lib.rs` in the functions
`borrow_apy_bps` and `accrue_interest`. The SDK exposes these as read-only
estimates via the `/v1/quote` API.
