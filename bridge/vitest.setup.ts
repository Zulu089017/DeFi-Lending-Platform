// Vitest setup for the bridge service.
//
// `config.ts` Zod-parses `process.env` at module load. Because ESM static
// imports are hoisted and evaluated BEFORE a test file's module body runs,
// setting env vars inside the test file (module scope or `beforeAll`) is
// not reliable — `config.ts` may already be evaluated. Setting the vars
// here, in a `setupFiles` entry that runs before every test file loads,
// guarantees they are present whenever any bridge module is imported.

const TEST_ENV = {
  ETHEREUM_RPC: "https://eth.llamarpc.com",
  POLYGON_RPC: "https://polygon-rpc.com",
  SOLANA_RPC: "https://api.mainnet-beta.solana.com",
  ETHEREUM_BRIDGE: "0x0000000000000000000000000000000000000001",
  POLYGON_BRIDGE: "0x0000000000000000000000000000000000000002",
  STELLAR_RPC: "https://horizon-testnet.stellar.org",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  STELLAR_CONTROLLER: "CABC",
  // A well-known Stellar testnet keypair (public; never used for value).
  RELAYER_SECRET: "SAFPBBB7QFEQXNQ37LJLYH3KMBVYMB4NEHUKYQA7DETL4WTC4HWOOYBA",
  ATTESTER_KEYS: "key1,key2,key3",
  ATTESTER_THRESHOLD: "2",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  POLL_INTERVAL_MS: "1000",
  PORT: "4100",
  LOG_LEVEL: "fatal",
} as const;

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}
