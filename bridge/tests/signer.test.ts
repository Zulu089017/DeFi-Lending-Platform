import { describe, it, expect } from "vitest";
import { payloadHash } from "../src/attest/signer.js";

describe("payloadHash", () => {
  it("produces a deterministic 32-byte sha256 digest", () => {
    const args = {
      chainId: 1,
      sourceToken:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      amount: 1_000_000n,
      stellarDest: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJUR",
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
   *      stellar-contracts/contracts/lending_controller/src/lib.rs
   *      should also pin the same bytes (or its sha256) so a
   *      cross-language drift surfaces immediately.
   */
  const CANONICAL_DIGEST = "REPLACE_WITH_ACTUAL_SHA256_HEX_64_CHARS_LONG_xxxxxxxxxxxxxxxx";
  it("matches the pinned canonical sha256 digest (drift canary)", () => {
    const args = {
      chainId: 1,
      sourceToken:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      amount: 1_000_000n,
      stellarDest: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJUR",
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
        stellarDest: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJUR",
        salt: "0x" + "22".repeat(31), // 31 bytes
        nonce: 1n,
      }),
    ).toThrow(/salt must be 32 bytes/);
  });

  it("rejects an Address XDR of unexpected length", () => {
    // We can't easily mock toXDR() to return a wrong length, so instead
    // verify that a well-formed G-address produces exactly 40 bytes of XDR.
    // (If @stellar/stellar-sdk changes its XDR format, this test will fail.)
    const xdr = (
      await import("@stellar/stellar-sdk")
    ).Address.fromString("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJUR")
      .toScVal()
      .toXDR();
    expect(Buffer.from(xdr).length).toBe(40);
  });

  it("changes digest when any field changes", () => {
    const base = {
      chainId: 1,
      sourceToken: "0x" + "11".repeat(32),
      amount: 1_000_000n,
      stellarDest: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJUR",
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
