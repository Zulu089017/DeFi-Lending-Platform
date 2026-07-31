import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/** Simple in-memory rate limiter for the OpenLend API.
 *
 *  Production should use a shared Redis counter so that rate limits are
 *  enforced across all API pod replicas. This module provides a
 *  straightforward `fastify` `preHandler` hook that works without any
 *  external dependency.
 */

interface RateLimitBucket {
  count: number;
  resetAt: number; // ms timestamp
}

const buckets = new Map<string, RateLimitBucket>();

/** Maximum requests per window (default: 300 req/min per IP). */
const DEFAULT_MAX = 300;

/** Window duration in ms (default: 60 seconds). */
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Create a Fastify preHandler hook that rate-limits requests by client IP.
 *
 * @param max      Max requests allowed within `windowMs`. Default 300.
 * @param windowMs Duration of the sliding window in ms. Default 60_000 (1 min).
 * @returns        A Fastify `preHandler` function.
 */
export function rateLimiter(max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS) {
  // Periodic cleanup to prevent unbounded map growth.
  const CLEANUP_MS = 60_000;
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (now > b.resetAt) buckets.delete(key);
    }
  }, CLEANUP_MS);

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count++;

    // Set rate-limit headers per IETF draft-ietf-httpapi-ratelimit-headers.
    const remaining = Math.max(0, max - bucket.count);
    reply.header("X-RateLimit-Limit", max);
    reply.header("X-RateLimit-Remaining", remaining);
    reply.header("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      reply.header("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      return reply.code(429).send({
        error: "Too Many Requests",
        message: `Rate limit of ${max} requests per ${windowMs / 1000}s exceeded.`,
      });
    }
  };
}

/**
 * Per-route rate limiter with stricter limits for expensive endpoints.
 *
 * Uses a separate bucket namespace keyed by `prefix + ":" + ip`.
 *
 * @remarks Reserved for future use on expensive endpoints (e.g. quote
 * endpoint may need a stricter per-IP limit than the global 300/min).
 */
export function routeRateLimiter(
  prefix: string,
  max: number,
  windowMs = DEFAULT_WINDOW_MS,
) {
  const CLEANUP_MS = 60_000;
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (now > b.resetAt) buckets.delete(key);
    }
  }, CLEANUP_MS);

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `${prefix}:${ip}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count++;
    const remaining = Math.max(0, max - bucket.count);
    reply.header("X-RateLimit-Limit", max);
    reply.header("X-RateLimit-Remaining", remaining);

    if (bucket.count > max) {
      reply.header("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      return reply.code(429).send({
        error: "Too Many Requests",
        message: `${prefix} rate limit exceeded.`,
      });
    }
  };
}
