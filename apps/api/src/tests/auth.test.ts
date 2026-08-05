import { describe, it, expect } from "vitest";
import { createToken, verifyToken, createApiKey, validateApiKey, revokeApiKey } from "../auth.js";

describe("Auth Module", () => {
  it("creates and verifies JWT tokens", () => {
    const user = { id: "user-1", publicKey: "GABC123", role: "user" as const };
    const token = createToken(user);
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);

    const verified = verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.id).toBe("user-1");
    expect(verified!.publicKey).toBe("GABC123");
    expect(verified!.role).toBe("user");
  });

  it("rejects tampered tokens", () => {
    const user = { id: "user-1", publicKey: "GABC123", role: "user" as const };
    const token = createToken(user);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({ sub: "hacker" })).toString("base64url")}.${parts[2]}`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it("manages API keys", () => {
    const key = createApiKey("Test Key", "indexer");
    expect(key.key).toMatch(/^spg_/);

    const validated = validateApiKey(key.key);
    expect(validated).not.toBeNull();
    expect(validated!.service).toBe("indexer");

    expect(revokeApiKey(key.key)).toBe(true);
    expect(validateApiKey(key.key)).toBeNull();
  });
});
