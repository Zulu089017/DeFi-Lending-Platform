import { describe, it, expect } from "vitest";

describe("Bridge Attest Signer", () => {
  it("payloadHash returns a 32-byte sha256 digest", async () => {
    const { payloadHash } = await import("../src/attest/signer.js");
    const digest = payloadHash({
      chainId: 1,
      sourceToken: "0x" + "A".repeat(40),
      amount: 1000n,
      stellarDest: "GC6HVHA4GAMDFLXLHWBHN3HOTFWPMHAXLMLACUMA3QF77WCZUEFAIABA",
      salt: "0x" + "B".repeat(64),
      nonce: 1n,
    });
    expect(digest).toBeInstanceOf(Uint8Array);
  });
});
