import Redis from "ioredis";

let redisClient = null;
let _isConnected = false;

export function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on('error', () => {
      _isConnected = false;
    });

    redisClient.on('connect', () => {
      _isConnected = true;
      console.log('Redis connected');
    });

    redisClient.on('close', () => {
      _isConnected = false;
    });
  }
  return redisClient;
}

export function isRedisConnected() {
  return _isConnected && redisClient && redisClient.status === 'ready';
}

export async function connectRedis() {
  const client = getRedisClient();
  if (client.status === 'wait') {
    await client.connect();
  }
  return client;
}

export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    _isConnected = false;
  }
}

// Health check
export async function checkRedisHealth() {
  try {
    const client = getRedisClient();
    await client.ping();
    return { status: 'healthy', latency: Date.now() };
  } catch (err) {
    return { status: 'unhealthy', error: err.message };
  }
}