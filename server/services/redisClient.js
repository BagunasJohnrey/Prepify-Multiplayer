import Redis from "ioredis";

let redisClient = null;

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

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected');
    });
  }
  return redisClient;
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