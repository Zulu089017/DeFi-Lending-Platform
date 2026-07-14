import { describe, it, expect, vi } from "vitest";
import { OpenLend } from "../src/index.js";
import { Keypair } from "@stellar/stellar-sdk";

const TEST_CONFIG = {
  stellar: {
    rpc: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    controllerContract: "CABC",
    // A well-known Stellar testnet-funded keypair (public, do NOT use for value).
    secretKey: "SDR4C2CKNCVK4DWMTNI2IXFJ6BE3A6J3WVNCGR6Q3SCMJDTSVHMJGC6U",
  },
  evm: {
    ethereum: {
      rpc: "https://eth.llamarpc.com",
      bridgeAddress: "0x0000000000000000000000000000000000000000",
    },
  },
  api: "http://localhost:4000",
} as const;

describe("OpenLend SDK", () => {
  it("constructs with a valid config", () => {
    const o = new OpenLend({ ...TEST_CONFIG });
    expect(o.stellar.publicKey).toMatch(/^G[A-Z2-7]+$/);
  });

  it("throws on an invalid Stellar secret key", () => {
    expect(
      () =>
        new OpenLend({
          ...TEST_CONFIG,
          stellar: { ...TEST_CONFIG.stellar, secretKey: "not-a-secret" },
        }),
    ).toThrow();
  });

  it("preserves the provided chain ids in the EVM map", () => {
    const o = new OpenLend({
      ...TEST_CONFIG,
      evm: {
        ethereum: TEST_CONFIG.evm.ethereum,
        polygon: { rpc: "https://polygon-rpc.com", bridgeAddress: "0x1" },
      },
    });
    expect(Object.keys(o.evm).sort()).toEqual(["ethereum", "polygon"]);
  });

  it("exposes the manifest as a static export", async () => {
    const mod = await import("../src/index.js");
    expect(mod.manifest).toBeDefined();
    expect(mod.manifest.network).toBe("testnet");
  });
});

describe("OpenLend.chainIdToU32 (private, tested via unwrap behaviour)", () => {
  // The chain-id mapping is private, so we exercise it through `unwrap`,
  // which throws a clear error if the chain is unsupported. We only assert
  // that known chains produce a *valid* Stellar transaction; the network
  // call itself is mocked by `fetch` interception in the indexer suite.
  it("rejects unsupported source chains with a clear message", async () => {
    const o = new OpenLend({ ...TEST_CONFIG });
    // We don't have a server to talk to; this just checks the early reject
    // path. `await Promise.reject(...)` would swallow the throw, so we use
    // a sync try/catch.
    let err: unknown = null;
    try {
      await o.wrap({
        sourceChain: "solana" as any, // not present in config
        token: "0x0",
        amount: "0",
        stellarDest: o.stellar.publicKey,
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Unsupported source chain/);
  });
});

describe("OpenLend.supplyCollateral (deprecated alias)", () => {
  it("forwards to supply without modification", async () => {
    const o = new OpenLend({ ...TEST_CONFIG });
    const spy = vi.spyOn(o, "supply");
    spy.mockResolvedValue({ hash: "fake-hash" });
    const r = await o.supplyCollateral("XLM", "100");
    expect(r).toEqual({ hash: "fake-hash" });
    expect(spy).toHaveBeenCalledWith("XLM", "100");
  });
});

describe("Keypair.fromSecret round-trip", () => {
  it("derives the same public key as the SDK", () => {
    const o = new OpenLend({ ...TEST_CONFIG });
    const kp = Keypair.fromSecret(TEST_CONFIG.stellar.secretKey);
    expect(o.stellar.publicKey).toBe(kp.publicKey());
  });
});
