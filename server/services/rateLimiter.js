import { getRedisClient } from "./redisClient.js";

/**
 * Sliding window rate limiter using Redis
 * Uses a sorted set with timestamps as scores for precise sliding window
 */
export class RedisRateLimiter {
  constructor(options = {}) {
    this.redis = getRedisClient();
    this.keyPrefix = options.keyPrefix || 'ratelimit:';
    this.windowMs = options.windowMs || 60000; // 1 minute default
    this.maxRequests = options.maxRequests || 100;
    this.message = options.message || 'Too many requests, please try again later';
    this.statusCode = options.statusCode || 429;
    this.standardHeaders = options.standardHeaders ?? true;
    this.legacyHeaders = options.legacyHeaders ?? false;
  }

  /**
   * Generate the Redis key for a given identifier
   */
  getKey(identifier) {
    return `${this.keyPrefix}${identifier}`;
  }

  /**
   * Check and increment the rate limit counter
   * Returns { allowed: boolean, remaining: number, resetTime: number, total: number }
   */
  async consume(identifier, cost = 1) {
    const key = this.getKey(identifier);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const windowEnd = now + this.windowMs; // For TTL

    const multi = this.redis.multi();

    // Remove expired entries
    multi.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    multi.zcard(key);

    // Add new request(s)
    for (let i = 0; i < cost; i++) {
      multi.zadd(key, now + i, `${now}:${i}:${Math.random()}`);
    }

    // Set expiry on the key (windowMs * 2 to be safe)
    multi.pexpire(key, this.windowMs * 2);

    const results = await multi.exec();
    const currentCount = results[1][1]; // zcard result
    const newCount = currentCount + cost;

    const allowed = newCount <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - newCount);
    const resetTime = now + this.windowMs;

    return {
      allowed,
      remaining,
      resetTime,
      total: newCount,
      retryAfter: allowed ? null : Math.ceil(this.windowMs / 1000)
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier) {
    const key = this.getKey(identifier);
    await this.redis.del(key);
  }

  /**
   * Get current rate limit status without consuming
   */
  async getStatus(identifier) {
    const key = this.getKey(identifier);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    await this.redis.zremrangebyscore(key, 0, windowStart);
    const count = await this.redis.zcard(key);

    return {
      total: count,
      remaining: Math.max(0, this.maxRequests - count),
      resetTime: now + this.windowMs
    };
  }
}

/**
 * Express middleware factory for rate limiting
 */
export function createRateLimitMiddleware(options = {}) {
  const limiter = new RedisRateLimiter(options);

  return async (req, res, next) => {
    // Get identifier (IP by default, can be customized)
    const identifier = options.keyGenerator 
      ? options.keyGenerator(req) 
      : req.ip || req.connection.remoteAddress || 'unknown';

    try {
      const result = await limiter.consume(identifier, options.cost || 1);

      // Set standard headers
      if (limiter.standardHeaders) {
        res.setHeader('RateLimit-Limit', options.maxRequests || 100);
        res.setHeader('RateLimit-Remaining', result.remaining);
        res.setHeader('RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      }

      if (limiter.legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', options.maxRequests || 100);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      }

      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
        }
        return res.status(limiter.statusCode).json({
          error: limiter.message,
          retryAfter: result.retryAfter
        });
      }

      next();
    } catch (err) {
      console.error('Rate limiter error:', err);
      // Fail open - allow request through if Redis is down
      next();
    }
  };
}

/**
 * Socket.IO middleware for rate limiting
 */
export function createSocketRateLimiter(options = {}) {
  const limiter = new RedisRateLimiter({
    ...options,
    keyPrefix: `${options.keyPrefix || 'ratelimit:'}socket:`
  });

  return async (socket, next) => {
    const ip = socket.handshake.address;
    const identifier = `ip:${ip}`;

    try {
      const result = await limiter.consume(identifier);
      
      if (!result.allowed) {
        return next(new Error(limiter.message));
      }
      
      // Attach rate limit info to socket for later use
      socket.rateLimit = result;
      next();
    } catch (err) {
      console.error('Socket rate limiter error:', err);
      // Fail open
      next();
    }
  };
}

// Pre-configured limiters for common use cases
export const apiLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later.',
  keyPrefix: 'ratelimit:api:'
});

export const authLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyPrefix: 'ratelimit:auth:'
});

export const passwordResetLimiter = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyPrefix: 'ratelimit:pwreset:'
});

export const generateLimiter = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Generation limit reached. Please try again later.',
  keyPrefix: 'ratelimit:generate:'
});

export const socketLimiter = createSocketRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many connections from this IP',
  keyPrefix: 'ratelimit:socket:'
});