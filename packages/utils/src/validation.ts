// Address Validation and Collateral Safety Checks

import { isValidStellarPublicKey, isValidStellarSecret } from "./transaction";

// ── Stellar Address Validation ──────────────────────────────────────

export function validateStellarAddress(address: string): {
  valid: boolean;
  error?: string;
} {
  if (!address || typeof address !== "string") {
    return { valid: false, error: "Address is required" };
  }

  const trimmed = address.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Address cannot be empty" };
  }

  if (!isValidStellarPublicKey(trimmed)) {
    return { valid: false, error: "Invalid Stellar address format (must start with G and be 56 chars)" };
  }

  return { valid: true };
}

export function validateStellarSecret(secret: string): {
  valid: boolean;
  error?: string;
} {
  if (!secret || typeof secret !== "string") {
    return { valid: false, error: "Secret key is required" };
  }

  if (!isValidStellarSecret(secret.trim())) {
    return { valid: false, error: "Invalid Stellar secret key format (must start with S and be 56 chars)" };
  }

  return { valid: true };
}

// ── EVM Address Validation ──────────────────────────────────────────

export function validateEvmAddress(address: string): {
  valid: boolean;
  error?: string;
} {
  if (!address || typeof address !== "string") {
    return { valid: false, error: "Address is required" };
  }

  const trimmed = address.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { valid: false, error: "Invalid EVM address (must be 0x + 40 hex chars)" };
  }

  // Checksum validation
  const clean = trimmed.slice(2).toLowerCase();
  const hasMixedCase = trimmed.slice(2) !== clean && trimmed.slice(2) !== trimmed.slice(2).toUpperCase();
  if (hasMixedCase) {
    // EIP-55 checksum validation would go here
    // For now, accept any valid-format address
  }

  return { valid: true };
}

// ── Collateral Validation ───────────────────────────────────────────

export interface CollateralCheck {
  asset: string;
  collateralAmount: string;
  collateralUsd: number;
  debtAmount: string;
  debtUsd: number;
  ltvBps: number; // max LTV in basis points
}

export function validateCollateralHealth(check: CollateralCheck): {
  safe: boolean;
  healthFactor: number;
  maxBorrowUsd: number;
  currentLtvBps: number;
  warning?: string;
} {
  const collateralUsd = check.collateralUsd;
  const debtUsd = check.debtUsd;
  const maxBorrowUsd = (collateralUsd * check.ltvBps) / 10_000;

  const currentLtvBps = collateralUsd > 0
    ? Math.round((debtUsd / collateralUsd) * 10_000)
    : 0;

  const healthFactor = debtUsd > 0
    ? collateralUsd / debtUsd
    : Number.POSITIVE_INFINITY;

  const warnings: string[] = [];

  if (healthFactor < 1.0) {
    warnings.push("CRITICAL: Position is underwater (HF < 1.0)");
  } else if (healthFactor < 1.25) {
    warnings.push("WARNING: Health factor is dangerously low (HF < 1.25)");
  } else if (healthFactor < 1.5) {
    warnings.push("CAUTION: Health factor is approaching liquidation threshold");
  }

  if (debtUsd > maxBorrowUsd) {
    warnings.push(`Borrow exceeds max LTV of ${check.ltvBps / 100}%`);
  }

  return {
    safe: healthFactor >= 1.25 && debtUsd <= maxBorrowUsd,
    healthFactor: isFinite(healthFactor) ? Math.round(healthFactor * 100) / 100 : Infinity,
    maxBorrowUsd,
    currentLtvBps,
    warning: warnings.length > 0 ? warnings.join(". ") : undefined,
  };
}

// ── Amount Validation ───────────────────────────────────────────────

export function validateAmount(amount: string, decimals = 7): {
  valid: boolean;
  error?: string;
  parsed?: bigint;
} {
  if (!amount || amount.trim().length === 0) {
    return { valid: false, error: "Amount is required" };
  }

  const trimmed = amount.trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { valid: false, error: "Amount must be a positive number" };
  }

  try {
    const parts = trimmed.split(".");
    const whole = parts[0];
    const frac = (parts[1] ?? "").padEnd(decimals, "0").slice(0, decimals);
    const parsed = BigInt(whole + frac);

    if (parsed <= 0n) {
      return { valid: false, error: "Amount must be greater than zero" };
    }

    return { valid: true, parsed };
  } catch {
    return { valid: false, error: "Invalid amount format" };
  }
}
