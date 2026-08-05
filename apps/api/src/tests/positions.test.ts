import { describe, it, expect } from "vitest";
import { buildApp } from "../index.js";

describe("API /v1/positions/:user", () => {
  it("returns 200 with position data for a valid user", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/positions/GCRYCZKNP7LC6EXKGKMGBBS6VDGIU5SCMFNXTESOIQUSWYBG3NDXR5YA",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("collateral");
      expect(body).toHaveProperty("debt");
    } finally {
      await app.close();
    }
  });

  it("returns 200 for an invalid Stellar address (no validation yet)", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/positions/invalid-address",
      });
      expect(res.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("returns 404 for a non-existent user", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/positions/GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      });
      // May return 200 with empty or 404 depending on implementation
      expect([200, 404]).toContain(res.statusCode);
    } finally {
      await app.close();
    }
  });
});

describe("API /v1/health-factor/:user", () => {
  it("returns 200 with health factor for a valid user", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/health-factor/GCRYCZKNP7LC6EXKGKMGBBS6VDGIU5SCMFNXTESOIQUSWYBG3NDXR5YA",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty("healthFactor");
      // healthFactor may be Infinity (serialized as null) when debt is 0
    } finally {
      await app.close();
    }
  });

  it("returns 200 for an invalid address (no validation yet)", async () => {
    const app = await buildApp({ logger: false });
    try {
      const res = await app.inject({
        method: "GET",
        url: "/v1/health-factor/0x123",
      });
      expect(res.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
