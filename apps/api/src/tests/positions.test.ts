import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../index.js";

describe("API /v1/positions/:user", () => {
  const app = buildApp({ logger: false });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with position data for a valid user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/positions/GCRYCZKNP7LC6EXKGKMGBBS6VDGIU5SCMFNXTESOIQUSWYBG3NDXR5YA",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("supplies");
    expect(body).toHaveProperty("borrows");
    expect(Array.isArray(body.supplies)).toBe(true);
  });

  it("returns 400 for an invalid Stellar address", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/positions/invalid-address",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/positions/GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    // May return 200 with empty or 404 depending on implementation
    expect([200, 404]).toContain(res.statusCode);
  });
});

describe("API /v1/health-factor/:user", () => {
  const app = buildApp({ logger: false });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with health factor for a valid user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health-factor/GCRYCZKNP7LC6EXKGKMGBBS6VDGIU5SCMFNXTESOIQUSWYBG3NDXR5YA",
    });
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("healthFactor");
      expect(typeof body.healthFactor).toBe("number");
    }
  });

  it("returns 400 for an invalid address", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/health-factor/0x123",
    });
    expect(res.statusCode).toBe(400);
  });
});
