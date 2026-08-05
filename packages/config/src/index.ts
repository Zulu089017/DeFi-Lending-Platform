// Central configuration for all StellarPay apps and services.

export const STELLAR_NETWORKS = {
  testnet: {
    rpc: "https://soroban-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    horizon: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    rpc: "https://soroban-mainnet.stellar.org",
    passphrase: "Public Global Stellar Network ; September 2015",
    horizon: "https://horizon.stellar.org",
  },
  futurenet: {
    rpc: "https://rpc-futurenet.stellar.org",
    passphrase: "Test SDF Future Network ; October 2022",
    horizon: "https://horizon-futurenet.stellar.org",
  },
} as const;

export const DEFAULT_NETWORK = "testnet" as const;

export const API_DEFAULTS = {
  port: 4000,
  corsOrigin: "http://localhost:3000",
  rateLimit: { max: 100, windowMs: 60_000 },
} as const;

export const TX_CONFIRMATIONS: Record<string, number> = {
  ethereum: 12,
  polygon: 50,
  solana: 32,
};

export const PROTOCOL_FEES = {
  liquidationBonusBps: 500, // 5%
  protocolFeeBps: 100, // 1%
} as const;
