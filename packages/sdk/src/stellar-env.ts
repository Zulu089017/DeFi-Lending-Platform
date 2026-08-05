// Stellar environment configurations for StellarPay.
// Import this file to get pre-configured network settings for testnet and mainnet.

import { Networks } from "@stellar/stellar-sdk";

/**
 * Stellar Testnet configuration (Futurenet for Soroban development).
 * Uses the testnet Horizon and Soroban RPC endpoints.
 */
export const TESTNET = {
  networkPassphrase: Networks.TESTNET,
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  friendbotUrl: "https://friendbot.stellar.org",
} as const;

/**
 * Stellar Mainnet configuration.
 * Uses the public network passphrase and mainnet endpoints.
 */
export const MAINNET = {
  networkPassphrase: Networks.PUBLIC,
  rpcUrl: "https://soroban-mainnet.stellar.org",
  horizonUrl: "https://horizon.stellar.org",
  // Friendbot does not exist on mainnet.
} as const;

/**
 * Known Stellar asset contracts (SAC — Stellar Asset Contract) for
 * commonly wrapped assets.
 *
 * The Stellar Asset Contract is a built-in Soroban contract that wraps
 * Stellar classic assets (XLM, USDC, etc.) as Soroban tokens. These
 * addresses are deterministic and well-known per network.
 */
export const STELLAR_ASSET_CONTRACTS = {
  testnet: {
    XLM: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
  mainnet: {
    XLM: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
  },
} as const;
