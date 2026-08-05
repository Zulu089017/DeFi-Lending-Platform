// In-Memory Cache Utility
// Reduces redundant API calls with TTL-based caching.

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;

  /** Get a cached value, or compute and store it. */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs = 30_000,
  ): Promise<T> {
    const cached = this.store.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      this.hits++;
      return cached.data as T;
    }

    this.misses++;
    const data = await fetcher();
    this.store.set(key, { data, timestamp: Date.now(), ttlMs });
    return data;
  }

  /** Get a cached value synchronously (returns null if miss). */
  get<T>(key: string): T | null {
    const cached = this.store.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
      this.hits++;
      return cached.data as T;
    }
    return null;
  }

  /** Set a value in the cache. */
  set<T>(key: string, data: T, ttlMs = 30_000): void {
    this.store.set(key, { data, timestamp: Date.now(), ttlMs });
  }

  /** Invalidate a specific key. */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Invalidate all keys matching a prefix. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Clear the entire cache. */
  clear(): void {
    this.store.clear();
  }

  /** Get cache statistics. */
  stats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? Math.round((this.hits / (this.hits + this.misses)) * 100)
        : 0,
    };
  }
}

/** Shared cache instance for cross-package use. */
export const sharedCache = new MemoryCache();
