import type { Context, Next } from 'hono';

// Simple in-memory rate limiter
class RateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly windowMs: number, private readonly maxRequests: number) {}

  check(key: string): boolean {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetAt) {
      this.requests.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }
}

const HOUR_MS = 60 * 60 * 1000;

// Rate Limits
// Read:    1000 requests/hour per token
// Write:   100 requests/hour per token
// Auth:    10 requests/hour per IP

const readLimiter = new RateLimiter(HOUR_MS, 1000);
const writeLimiter = new RateLimiter(HOUR_MS, 100);
const authLimiter = new RateLimiter(HOUR_MS, 10);

function getIpInfo(c: Context): string {
  // Try to get IP, fallback to something generic if local (edge cases)
  const forwarded = c.req.header('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0]!.trim() : '127.0.0.1';
}

function getTokenKey(c: Context): string | null {
  const header = c.req.header('Authorization');
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export const readRateLimit = async (c: Context, next: Next): Promise<Response | void> => {
  const token = getTokenKey(c);
  if (token) {
    if (!readLimiter.check(token)) {
      return c.json({ error: 'rate_limited', message: 'Read rate limit exceeded', status: 429 }, 429);
    }
  }
  return await next();
};

export const writeRateLimit = async (c: Context, next: Next): Promise<Response | void> => {
  const token = getTokenKey(c);
  if (token) {
    if (!writeLimiter.check(token)) {
      return c.json({ error: 'rate_limited', message: 'Write rate limit exceeded', status: 429 }, 429);
    }
  }
  return await next();
};

export const authRateLimit = async (c: Context, next: Next): Promise<Response | void> => {
  const ip = getIpInfo(c);
  if (!authLimiter.check(ip)) {
    return c.json({ error: 'rate_limited', message: 'Auth rate limit exceeded', status: 429 }, 429);
  }
  return await next();
};
