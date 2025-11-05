import { LRUCache } from 'lru-cache';
import { config } from '../config/index.js';
import { CacheEntry, CacheKind, CacheMetrics } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class CacheService {
  private cache: LRUCache<string, CacheEntry>;
  private inflightRequests: Map<string, Promise<any>>;
  private metrics: CacheMetrics;

  constructor() {
    this.cache = new LRUCache<string, CacheEntry>({
      max: config.cache.maxItems,
      ttl: config.cache.ttlMs,
      allowStale: true,
      updateAgeOnGet: false,
      dispose: () => {
        this.metrics.evictions++;
      },
    });

    this.inflightRequests = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      inflight: 0,
      entries: 0,
      evictions: 0,
    };

    logger.info({ maxItems: config.cache.maxItems, ttlMs: config.cache.ttlMs }, 'Cache service initialized');
  }

  generateCacheKey(kind: CacheKind, params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    return `${kind}:${sortedParams}`;
  }

  async fetchWithCache<T>(
    kind: CacheKind,
    params: Record<string, string>,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key = this.generateCacheKey(kind, params);

    const entry = this.cache.get(key);
    if (entry) {
      const age = Date.now() - entry.at;
      this.metrics.hits++;
      logger.debug({ key, age, kind }, 'Cache hit');

      if (age > config.cache.ttlMs) {
        logger.debug({ key, kind }, 'Cache entry stale, revalidating in background');
        void fetcher()
          .then(data => {
            this.cache.set(key, { at: Date.now(), data });
            logger.debug({ key, kind }, 'Background revalidation completed');
          })
          .catch(err => {
            logger.warn({ key, kind, error: err.message }, 'Background revalidation failed');
          });
      }

      return entry.data;
    }

    this.metrics.misses++;
    logger.debug({ key, kind }, 'Cache miss');

    if (this.inflightRequests.has(key)) {
      this.metrics.inflight++;
      logger.debug({ key, kind }, 'Request already in-flight, awaiting result');
      return await this.inflightRequests.get(key)!;
    }

    const promise = fetcher()
      .then(data => {
        this.cache.set(key, { at: Date.now(), data });
        this.inflightRequests.delete(key);
        logger.debug({ key, kind }, 'Cache entry created');
        return data;
      })
      .catch(err => {
        this.inflightRequests.delete(key);
        throw err;
      });

    this.inflightRequests.set(key, promise);
    return await promise;
  }

  invalidate(keys?: string[], prefix?: string): number {
    let count = 0;

    if (keys && keys.length > 0) {
      for (const key of keys) {
        if (this.cache.delete(key)) {
          count++;
          logger.debug({ key }, 'Cache entry invalidated');
        }
      }
    } else if (prefix) {
      const allKeys = Array.from(this.cache.keys());
      for (const key of allKeys) {
        if (key.startsWith(prefix)) {
          if (this.cache.delete(key)) {
            count++;
          }
        }
      }
      logger.info({ prefix, count }, 'Cache entries invalidated by prefix');
    } else {
      this.cache.clear();
      count = this.cache.size;
      logger.info('All cache entries cleared');
    }

    return count;
  }

  getMetrics(): CacheMetrics {
    return {
      ...this.metrics,
      entries: this.cache.size,
      inflight: this.inflightRequests.size,
    };
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: config.cache.maxItems,
      ttlMs: config.cache.ttlMs,
      inflightRequests: this.inflightRequests.size,
      ...this.metrics,
    };
  }
}

export const cacheService = new CacheService();
