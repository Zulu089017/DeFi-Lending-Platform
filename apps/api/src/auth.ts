// API Authentication Module
// Supports JWT-based auth for dashboard users and API-key auth for service-to-service.

import { createHash, randomBytes } from "crypto";

export interface AuthUser {
  id: string;
  publicKey: string; // Stellar public key
  role: "user" | "admin" | "service";
}

export interface ApiKey {
  key: string;
  name: string;
  service: string;
  createdAt: string;
  expiresAt: string | null;
}

// ── JWT-like token (simplified for scaffold) ──

const TOKEN_SECRET = process.env.AUTH_SECRET || randomBytes(32).toString("hex");

export function createToken(user: AuthUser): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      pub: user.publicKey,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86_400, // 24h
    }),
  ).toString("base64url");

  const signature = createHash("sha256")
    .update(`${header}.${payload}.${TOKEN_SECRET}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const expected = createHash("sha256")
      .update(`${header}.${payload}.${TOKEN_SECRET}`)
      .digest("base64url");

    if (signature !== expected) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: decoded.sub,
      publicKey: decoded.pub,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

// ── API Key Management ──

const API_KEYS = new Map<string, ApiKey>();

export function createApiKey(name: string, service: string): ApiKey {
  const key = `spg_${randomBytes(24).toString("hex")}`;
  const apiKey: ApiKey = {
    key,
    name,
    service,
    createdAt: new Date().toISOString(),
    expiresAt: null,
  };
  API_KEYS.set(key, apiKey);
  return apiKey;
}

export function validateApiKey(key: string): ApiKey | null {
  return API_KEYS.get(key) || null;
}

export function revokeApiKey(key: string): boolean {
  return API_KEYS.delete(key);
}

// ── Middleware ──

export function authMiddleware(request: { headers: Record<string, string> }): AuthUser | null {
  const authHeader = request.headers["authorization"];
  if (!authHeader) return null;

  // Bearer token (JWT)
  if (authHeader.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice(7));
  }

  // API Key
  if (authHeader.startsWith("ApiKey ")) {
    const apiKey = validateApiKey(authHeader.slice(7));
    if (apiKey) {
      return {
        id: `service:${apiKey.service}`,
        publicKey: "",
        role: "service",
      };
    }
  }

  return null;
}
