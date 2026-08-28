import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the redisClient module before importing rateLimiter
const mockMultiChain = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn()
};

const mockRedis = {
  multi: vi.fn(() => ({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn()
  })),
  del: vi.fn().mockResolvedValue(1),
  zremrangebyscore: vi.fn().mockResolvedValue(0),
  zcard: vi.fn().mockResolvedValue(0),
  ping: vi.fn().mockResolvedValue('PONG')
};

vi.mock('../redisClient.js', () => ({
  getRedisClient: () => mockRedis
}));

const { RedisRateLimiter, createRateLimitMiddleware } = await import('../rateLimiter.js');

describe('RedisRateLimiter', () => {
  let limiter;

  beforeEach(() => {
    vi.clearAllMocks();
    limiter = new RedisRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      keyPrefix: 'test:ratelimit:'
    });
  });

  describe('consume', () => {
    it('should allow request under limit', async () => {
      // zcard returns current count (5) before adding new
      const multiInstance = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 'OK'], [null, 'OK']])
      };
      mockRedis.multi.mockReturnValueOnce(multiInstance);

      const result = await limiter.consume('user123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - (5 + 1)
      expect(result.total).toBe(6);
    });

    it('should reject request over limit', async () => {
      const multiInstance = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 10], [null, 1], [null, 'OK'], [null, 'OK']])
      };
      mockRedis.multi.mockReturnValueOnce(multiInstance);

      const result = await limiter.consume('user123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(60);
    });

    it('should use custom cost', async () => {
      const multiInstance = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 8], [null, 1], [null, 1], [null, 1], [null, 'OK'], [null, 'OK']])
      };
      mockRedis.multi.mockReturnValueOnce(multiInstance);

      const result = await limiter.consume('user123', 3);

      expect(result.total).toBe(11); // 8 + 3
      expect(result.allowed).toBe(false);
    });
  });

  describe('reset', () => {
    it('should delete the key', async () => {
      await limiter.reset('user123');
      expect(mockRedis.del).toHaveBeenCalledWith('test:ratelimit:user123');
    });
  });

  describe('getStatus', () => {
    it('should return current status', async () => {
      mockRedis.zcard.mockResolvedValueOnce(3);

      const status = await limiter.getStatus('user123');

      expect(status.total).toBe(3);
      expect(status.remaining).toBe(7);
      expect(status.resetTime).toBeCloseTo(Date.now() + 60000, -2);
    });
  });
});

describe('createRateLimitMiddleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn()
    };
    mockNext = vi.fn();
  });

  it('should allow request under limit', async () => {
    const multiInstance = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 'OK'], [null, 'OK']])
    };
    mockRedis.multi.mockReturnValueOnce(multiInstance);

    const middleware = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 10
    });

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 429 when limit exceeded', async () => {
    const multiInstance = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 10], [null, 1], [null, 'OK'], [null, 'OK']])
    };
    mockRedis.multi.mockReturnValueOnce(multiInstance);

    const middleware = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 10,
      message: 'Custom rate limit message'
    });

    await middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Custom rate limit message',
      retryAfter: 60
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should set rate limit headers', async () => {
    const multiInstance = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 'OK'], [null, 'OK']])
    };
    mockRedis.multi.mockReturnValueOnce(multiInstance);

    const middleware = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 10,
      standardHeaders: true,
      legacyHeaders: true
    });

    await middleware(mockReq, mockRes, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Limit', 10);
    expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', expect.any(Number));
    expect(mockRes.setHeader).toHaveBeenCalledWith('RateLimit-Reset', expect.any(Number));
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('should fail open on Redis error', async () => {
    mockRedis.multi.mockImplementationOnce(() => {
      throw new Error('Redis connection failed');
    });

    const middleware = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 10
    });

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should use custom key generator', async () => {
    const multiInstance = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 'OK'], [null, 'OK']])
    };
    mockRedis.multi.mockReturnValueOnce(multiInstance);

    const middleware = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: (req) => `custom:${req.headers['x-user-id']}`
    });

    mockReq.headers = { 'x-user-id': 'user456' };

    await middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
