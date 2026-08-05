// Stellar Trustline & Memo Validation

import { Horizon } from "@stellar/stellar-sdk";

export interface TrustlineInfo {
  asset: string;
  issuer: string;
  balance: string;
  limit: string;
  authorized: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate that an account has a trustline for a given asset.
 */
export async function hasTrustline(
  server: Horizon.Server,
  accountId: string,
  assetCode: string,
  assetIssuer: string,
): Promise<ValidationResult> {
  try {
    const account = await server.loadAccount(accountId);
    const balance = account.balances.find(
      (b: any) =>
        b.asset_type !== "native" &&
        b.asset_code === assetCode &&
        b.asset_issuer === assetIssuer,
    );

    if (!balance) {
      return {
        valid: false,
        error: `No trustline found for ${assetCode} (issuer: ${assetIssuer.slice(0, 8)}...)`,
        warnings: [
          "You must establish a trustline before receiving this asset.",
          "Visit the asset page in your wallet to add the trustline.",
        ],
      };
    }

    if (!(balance as any).is_authorized && (balance as any).is_authorized !== undefined) {
      return {
        valid: false,
        error: `Trustline for ${assetCode} is not authorized`,
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Failed to load account" };
  }
}

/**
 * Get all trustlines for an account.
 */
export async function getTrustlines(
  server: Horizon.Server,
  accountId: string,
): Promise<TrustlineInfo[]> {
  try {
    const account = await server.loadAccount(accountId);
    return account.balances
      .filter((b: any) => b.asset_type !== "native")
      .map((b: any) => ({
        asset: b.asset_code,
        issuer: b.asset_issuer,
        balance: b.balance,
        limit: b.limit,
        authorized: b.is_authorized ?? true,
      }));
  } catch {
    return [];
  }
}

// ── Memo Validation ────────────────────────────────────────────────

const MEMO_TEXT_MAX = 28; // bytes
const MEMO_ID_MAX = BigInt("9223372036854775807"); // max int64

export function validateMemo(memo: string, type: "text" | "id" | "hash" | "return" = "text"): ValidationResult {
  if (!memo) return { valid: true };

  switch (type) {
    case "text": {
      const bytes = new TextEncoder().encode(memo);
      if (bytes.length > MEMO_TEXT_MAX) {
        return {
          valid: false,
          error: `Memo text exceeds ${MEMO_TEXT_MAX} bytes (got ${bytes.length})`,
        };
      }
      return { valid: true };
    }

    case "id": {
      try {
        const id = BigInt(memo);
        if (id < 0n || id > MEMO_ID_MAX) {
          return { valid: false, error: "Memo ID out of range (0 to 2^63-1)" };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: "Memo ID must be a valid integer" };
      }
    }

    case "hash": {
      if (!/^[0-9a-fA-F]{64}$/.test(memo)) {
        return {
          valid: false,
          error: "Memo hash must be 32 bytes (64 hex characters)",
        };
      }
      return { valid: true };
    }

    case "return": {
      if (!/^[0-9a-fA-F]{64}$/.test(memo)) {
        return {
          valid: false,
          error: "Memo return must be 32 bytes (64 hex characters)",
        };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: "Invalid memo type" };
  }
}

// ── Network Switching ──────────────────────────────────────────────

export type StellarNetwork = "testnet" | "mainnet" | "futurenet";

export interface NetworkConfig {
  network: StellarNetwork;
  rpcUrl: string;
  passphrase: string;
  horizonUrl: string;
}

export const STELLAR_NETWORKS: Record<StellarNetwork, NetworkConfig> = {
  testnet: {
    network: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    network: "mainnet",
    rpcUrl: "https://soroban.stellar.org",
    passphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
  },
  futurenet: {
    network: "futurenet",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    passphrase: "Test SDF Future Network ; October 2022",
    horizonUrl: "https://horizon-futurenet.stellar.org",
  },
};

export function getNetworkConfig(network: StellarNetwork): NetworkConfig {
  return STELLAR_NETWORKS[network];
}
