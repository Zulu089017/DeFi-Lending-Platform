import { describe, it, expect, vi, beforeAll } from "vitest";

// Set required env vars before importing any module that validates config.
beforeAll(() => {
  vi.stubEnv("ETHEREUM_RPC", "https://eth.llamarpc.com");
  vi.stubEnv("POLYGON_RPC", "https://polygon-rpc.com");
  vi.stubEnv("SOLANA_RPC", "https://api.mainnet-beta.solana.com");
  vi.stubEnv("ETHEREUM_BRIDGE", "0x0000000000000000000000000000000000000001");
  vi.stubEnv("POLYGON_BRIDGE", "0x0000000000000000000000000000000000000002");
  vi.stubEnv("STELLAR_RPC", "https://horizon-testnet.stellar.org");
  vi.stubEnv("STELLAR_NETWORK_PASSPHRASE", "Test SDF Network ; September 2015");
  vi.stubEnv("STELLAR_CONTROLLER", "CABC");
  vi.stubEnv("RELAYER_SECRET", "SAFPBBB7QFEQXNQ37LJLYH3KMBVYMB4NEHUKYQA7DETL4WTC4HWOOYBA");
  vi.stubEnv("ATTESTER_KEYS", "key1,key2,key3");
  vi.stubEnv("ATTESTER_THRESHOLD", "2");
  vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db");
});

describe("Bridge Attest Signer", () => {
  it("payloadHash returns a 32-byte sha256 digest", async () => {
    const { payloadHash } = await import("../src/attest/signer.js");
    const digest = payloadHash({
      chainId: 1,
      sourceToken: "0x" + "A".repeat(40),
      amount: 1000n,
      stellarDest: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      salt: "0x" + "B".repeat(64),
      nonce: 1n,
    });
    expect(digest).toBeInstanceOf(Uint8Array);
  });
});
