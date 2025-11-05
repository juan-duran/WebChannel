import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private windowMs: number;

  constructor(windowMs: number = 60000) {
    this.limits = new Map();
    this.windowMs = windowMs;

    setInterval(() => this.cleanup(), windowMs);
  }

  check(key: string, limit: number): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetAt) {
      this.limits.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

const apiRateLimiter = new RateLimiter(60000);

export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown';

  if (!apiRateLimiter.check(key, config.security.apiRateLimit)) {
    logger.warn({ ip: req.ip, path: req.path }, 'API rate limit exceeded');
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  next();
}

export class UserRateLimiter {
  private limiter: RateLimiter;

  constructor() {
    this.limiter = new RateLimiter(60000);
  }

  check(userId: string): boolean {
    return this.limiter.check(userId, config.security.userRateLimit);
  }
}

export const userRateLimiter = new UserRateLimiter();
