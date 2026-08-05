import { describe, it, expect } from "vitest";
import { buildApp } from "../index.js";

describe("POST /v1/quote/wrap", () => {
  it("returns a quote for valid input", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/quote/wrap",
        payload: {
          sourceChain: "ethereum",
          token: "USDC",
          amount: "1000000",
          stellarDest: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, unknown>;
      expect(body.bridgeFee).toBe("1000000");
      expect(body.estimatedTime).toBe("30-90s");
      expect(body.rate).toBe("1:1");
    } finally {
      await app.close();
    }
  });

  it("accepts every sourceChain enum (ethereum, polygon, solana)", async () => {
    const app = await buildApp({ logger: false });
    try {
      for (const chain of ["ethereum", "polygon", "solana"] as const) {
        const res = await app.inject({
          method: "POST",
          url: "/v1/quote/wrap",
          payload: {
            sourceChain: chain,
            token: "USDC",
            amount: "1000000",
            stellarDest: "GABC",
          },
        });
        expect(res.statusCode, `chain=${chain}`).toBe(200);
      }
    } finally {
      await app.close();
    }
  });

  it("returns 400 for missing fields", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/quote/wrap",
        payload: { sourceChain: "ethereum", token: "USDC" },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as { error: unknown };
      expect(body.error).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it("returns 400 for an unknown sourceChain", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/quote/wrap",
        payload: {
          sourceChain: "bitcoin",
          token: "USDC",
          amount: "1000000",
          stellarDest: "GABC",
        },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe("POST /v1/quote/unwrap", () => {
  it("returns a quote for valid input", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/quote/unwrap",
        payload: {
          amount: "1000000",
          sourceChain: "ethereum",
          sourceAddr: "0xabc",
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, unknown>;
      expect(body.bridgeFee).toBe("0");
      expect(body.estimatedTime).toBe("30-120s");
      expect(body.rate).toBe("1:1");
    } finally {
      await app.close();
    }
  });

  it("returns 400 for missing fields", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/quote/unwrap",
        payload: { amount: "1000000" },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("returns 400 for an unknown sourceChain", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/v1/quote/unwrap",
        payload: {
          amount: "1000000",
          sourceChain: "bitcoin",
          sourceAddr: "0xabc",
        },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
