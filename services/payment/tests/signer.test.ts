import { describe, it, expect } from "vitest";

// NOTE: required env vars for `config.ts` are provided by `vitest.setup.ts`
// (see `setupFiles` in vitest.config.ts). Setting them here in module scope
// does NOT work because ESM static imports are hoisted and evaluate
// `config.ts` before this module body runs.

import { payloadHash } from "../src/attest/signer.js";

describe("payloadHash", () => {
  it("produces a deterministic 32-byte sha256 digest", () => {
    const args = {
      chainId: 1,
      sourceToken:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      amount: 1_000_000n,
      stellarDest: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      salt: "0x2222222222222222222222222222222222222222222222222222222222222222",
      nonce: 42n,
    };
    const h1 = payloadHash(args);
    const h2 = payloadHash(args);
    expect(h1).toBeInstanceOf(Uint8Array);
    expect(h1.length).toBe(32);
    expect(Buffer.from(h1).toString("hex")).toBe(
      Buffer.from(h2).toString("hex"),
    );
  });

  /**
   * Pin the sha256 digest for the canonical inputs above. This is the
   * single source of truth that catches drift between the Rust
   * (`build_canonical_payload` in lending_controller.rs) and the TS
   * (`payloadHash` here) payload constructions.
   *
   * To regenerate after a verified intentional change:
   *   1. Run this file: `npm test -- bridge/tests/signer.test.ts`
   *   2. The test will print the actual digest via the failure message
   *      below. Copy the 64-hex-char value into CANONICAL_DIGEST.
   *   3. Re-run the test — it should pass.
   *   4. Commit the updated value. The Rust test in
   *      contracts/lending/controller/src/lib.rs
   *      (invariant_C6_payload_digest_matches_ts) pins the same bytes so
   *      a cross-language drift surfaces immediately.
   */
  // Pinned on 2026-07-31 against @stellar/stellar-sdk 12.x. Regenerate
  // only after a verified intentional change to the payload layout, then
  // update the matching Rust test
  // (invariant_C6_payload_digest_matches_ts) in
  // contracts/lending/controller/src/lib.rs.
  const CANONICAL_DIGEST = "fd426f52b5772d98e1ae591139e3935b5c56671f2b1b7d2e1adb7460dffcffcc";
  it("matches the pinned canonical sha256 digest (drift canary)", () => {
    const args = {
      chainId: 1,
      sourceToken:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      amount: 1_000_000n,
      stellarDest: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      salt: "0x2222222222222222222222222222222222222222222222222222222222222222",
      nonce: 42n,
    };
    const actual = Buffer.from(payloadHash(args)).toString("hex");
    if (CANONICAL_DIGEST.startsWith("REPLACE_WITH_ACTUAL_") || CANONICAL_DIGEST.length !== 64) {
      throw new Error(
        "CANONICAL_DIGEST placeholder not set (or wrong length). Run the test, copy the printed digest into CANONICAL_DIGEST, and commit. " +
          `Actual digest for the canonical inputs: ${actual}`,
      );
    }
    expect(actual).toBe(CANONICAL_DIGEST);
  });

  it("rejects salts that are not exactly 32 bytes", () => {
    expect(() =>
      payloadHash({
        chainId: 1,
        sourceToken: "0x" + "11".repeat(32),
        amount: 1n,
        stellarDest: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
        salt: "0x" + "22".repeat(31), // 31 bytes
        nonce: 1n,
      }),
    ).toThrow(/salt must be 32 bytes/);
  });

  it("serialises an ed25519 Address to 44 bytes of XDR", async () => {
    // An ed25519 account Address serialises to 44 bytes of ScVal XDR:
    // 4-byte ScVal tag + 4-byte ScAddress tag + 4-byte AccountId tag +
    // 32-byte raw pubkey. The on-chain `build_canonical_payload` asserts
    // this exact length, so the off-chain signer must too.
    // (If @stellar/stellar-sdk changes its XDR format, this test will fail.)
    const { Address } = await import("@stellar/stellar-sdk");
    const xdr = Address.fromString(
      "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    )
      .toScVal()
      .toXDR();
    expect(Buffer.from(xdr).length).toBe(44);
  });

  it("changes digest when any field changes", () => {
    const base = {
      chainId: 1,
      sourceToken: "0x" + "11".repeat(32),
      amount: 1_000_000n,
      stellarDest: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      salt: "0x" + "22".repeat(32),
      nonce: 42n,
    };
    const h0 = payloadHash(base);
    expect(Buffer.from(payloadHash({ ...base, chainId: 2 })).toString("hex")).not.toBe(
      Buffer.from(h0).toString("hex"),
    );
    expect(
      Buffer.from(payloadHash({ ...base, amount: 1_000_001n })).toString("hex"),
    ).not.toBe(Buffer.from(h0).toString("hex"));
    expect(
      Buffer.from(payloadHash({ ...base, nonce: 43n })).toString("hex"),
    ).not.toBe(Buffer.from(h0).toString("hex"));
    expect(
      Buffer.from(
        payloadHash({
          ...base,
          salt: "0x" + "33".repeat(32),
        }),
      ).toString("hex"),
    ).not.toBe(Buffer.from(h0).toString("hex"));
  });
});
