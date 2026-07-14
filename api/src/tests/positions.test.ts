import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../index.js";
import { resetDb } from "./helpers/db.js";
import { seedLendingEvent } from "./helpers/seed.js";

describe("GET /v1/positions/:user", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns empty collateral and debt for a user with no events", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({ method: "GET", url: "/v1/positions/alice" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ user: "alice", collateral: {}, debt: {} });
    } finally {
      await app.close();
    }
  });

  it("aggregates supply and borrow per asset for a single user", async () => {
    await seedLendingEvent({ type: "supply", user: "alice", asset: "XLM", amount: 100n });
    await seedLendingEvent({ type: "borrow", user: "alice", asset: "XLM", amount: 50n });
    await seedLendingEvent({ type: "supply", user: "alice", asset: "USDC", amount: 200n });

    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({ method: "GET", url: "/v1/positions/alice" });
      const body = res.json() as Record<string, unknown>;
      expect(body.user).toBe("alice");
      expect(body.collateral).toEqual({ XLM: "100", USDC: "200" });
      expect(body.debt).toEqual({ XLM: "50" });
    } finally {
      await app.close();
    }
  });

  it("subtracts repay from debt and withdraw from collateral", async () => {
    await seedLendingEvent({ type: "supply", user: "alice", asset: "XLM", amount: 100n });
    await seedLendingEvent({ type: "borrow", user: "alice", asset: "XLM", amount: 50n });
    await seedLendingEvent({ type: "withdraw", user: "alice", asset: "XLM", amount: 30n });
    await seedLendingEvent({ type: "repay", user: "alice", asset: "XLM", amount: 20n });

    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({ method: "GET", url: "/v1/positions/alice" });
      const body = res.json() as Record<string, unknown>;
      expect(body.collateral).toEqual({ XLM: "70" }); // 100 - 30
      expect(body.debt).toEqual({ XLM: "30" }); // 50 - 20
    } finally {
      await app.close();
    }
  });

  it("isolates positions by user (no cross-user leakage)", async () => {
    await seedLendingEvent({ type: "supply", user: "alice", asset: "XLM", amount: 100n });
    await seedLendingEvent({ type: "supply", user: "bob", asset: "XLM", amount: 999n });

    const app = await buildApp({ logger: false });
    try {
      const alice = (await app.inject({ method: "GET", url: "/v1/positions/alice" })).json() as Record<string, unknown>;
      const bob = (await app.inject({ method: "GET", url: "/v1/positions/bob" })).json() as Record<string, unknown>;
      expect(alice.collateral).toEqual({ XLM: "100" });
      expect(bob.collateral).toEqual({ XLM: "999" });
    } finally {
      await app.close();
    }
  });
});

describe("GET /v1/health-factor/:user", () => {
  beforeEach(async () => {
    await resetDb();
  });

  // NOTE on `Infinity` serialisation:
  // `JSON.stringify(Infinity)` is `"null"` per the JSON spec, so the
  // health-factor route's `Infinity` reaches the client as `null`. The
  // server-side `debt === 0n` branch still fires, so `status: "ok"` is
  // correct. A future improvement would be to return a finite sentinel
  // (e.g. `Number.MAX_VALUE`) or a string "Infinity"; for now we
  // assert the wire format.

  it("returns 'ok' for a user with no debt (Infinity serialises to JSON null)", async () => {
    await seedLendingEvent({ type: "supply", user: "alice", asset: "XLM", amount: 100n });
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({ method: "GET", url: "/v1/health-factor/alice" });
      const body = res.json() as Record<string, unknown>;
      expect(body.user).toBe("alice");
      expect(body.healthFactor).toBeNull();
      expect(body.status).toBe("ok");
    } finally {
      await app.close();
    }
  });

  it("returns 'ok' for a healthy position (hf >= 1.2)", async () => {
    // supply=1000, borrow=100, liq_threshold=0.85 → hf = 1000*0.85/100 = 8.5
    await seedLendingEvent({ type: "supply", user: "alice", asset: "XLM", amount: 1000n });
    await seedLendingEvent({ type: "borrow", user: "alice", asset: "XLM", amount: 100n });
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({ method: "GET", url: "/v1/health-factor/alice" });
      const body = res.json() as Record<string, unknown>;
      expect(body.healthFactor).toBeCloseTo(8.5);
      expect(body.status).toBe("ok");
    } finally {
      await app.close();
    }
  });

  it("returns 'warn' for an at-risk position (1 <= hf < 1.2)", async () => {
    // supply=130, borrow=100, liq_threshold=0.85 → hf = 130*0.85/100 = 1.105
    await seedLendingEvent({ type: "supply", user: "alice", asset: "XLM", amount: 130n });
    await seedLendingEvent({ type: "borrow", user: "alice", asset: "XLM", amount: 100n });
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({ method: "GET", url: "/v1/health-factor/alice" });
      const body = res.json() as Record<string, unknown>;
      expect(body.healthFactor).toBeCloseTo(1.105);
      expect(body.status).toBe("warn");
    } finally {
      await app.close();
    }
  });

  it("returns 'liquidatable' for an underwater position (hf < 1)", async () => {
    // supply=50, borrow=100, liq_threshold=0.85 → hf = 50*0.85/100 = 0.425
    await seedLendingEvent({ type: "supply", user: "alice", asset: "XLM", amount: 50n });
    await seedLendingEvent({ type: "borrow", user: "alice", asset: "XLM", amount: 100n });
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({ method: "GET", url: "/v1/health-factor/alice" });
      const body = res.json() as Record<string, unknown>;
      expect(body.healthFactor).toBeCloseTo(0.425);
      expect(body.status).toBe("liquidatable");
    } finally {
      await app.close();
    }
  });

  it("clamps debt to zero when repay exceeds borrow (underflow guard)", async () => {
    await seedLendingEvent({ type: "supply", user: "alice", asset: "XLM", amount: 1000n });
    await seedLendingEvent({ type: "borrow", user: "alice", asset: "XLM", amount: 100n });
    await seedLendingEvent({ type: "repay", user: "alice", asset: "XLM", amount: 500n });
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({ method: "GET", url: "/v1/health-factor/alice" });
      const body = res.json() as Record<string, unknown>;
      // After over-repay, debt is 0 → server returns `Infinity`, which
      // JSON-stringifies to `null` (per spec). Assert the wire format.
      expect(body.healthFactor).toBeNull();
      expect(body.status).toBe("ok");
    } finally {
      await app.close();
    }
  });
});
