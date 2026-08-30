import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

const testDbPool = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn(), connect: vi.fn() }));

vi.mock('../config/db.js', () => ({
  default: testDbPool
}));

import { startTestDatabase, stopTestDatabase, cleanDatabase, createTestUser, createTestQuiz, generateTestToken, testPool } from './setup.js';
import app from '../server.js';

describe('Auth API Integration Tests', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    await startTestDatabase();
    // Make the mocked pool delegate to the real test pool
    testDbPool.query = testPool.query.bind(testPool);
    testDbPool.end = testPool.end.bind(testPool);
    testDbPool.connect = testPool.connect.bind(testPool);
  }, 60000);

  afterAll(async () => {
    await stopTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase(testPool);
    // Reset rate limit keys in Redis
    if (testDbPool.query) {
      // Clear any rate limit keys
      try {
        const redis = (await import('../services/redisClient.js')).getRedisClient();
        const keys = await redis.keys('ratelimit:*');
        if (keys.length) await redis.del(...keys);
      } catch {}
    }
    testUser = await createTestUser(testPool, { username: 'testuser', email: 'test@example.com' });
    authToken = await generateTestToken(testUser.id);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'password123',
          email: 'new@example.com'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.username).toBe('newuser');
    });

    it('should reject duplicate username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'other@example.com'
        });

      expect(res.status).toBe(400);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'a',
          password: 'short'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword123'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('testuser');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user info with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `token=${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testUser.id);
      expect(res.body.username).toBe('testuser');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'token=invalid');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear auth cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `token=${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

describe('Quiz API Integration Tests', () => {
  let testUser;
  let testQuiz;
  let authToken;

  beforeAll(async () => {
    await startTestDatabase();
    testDbPool.query = testPool.query.bind(testPool);
    testDbPool.end = testPool.end.bind(testPool);
    testDbPool.connect = testPool.connect.bind(testPool);
  }, 60000);

  afterAll(async () => {
    await stopTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase(testPool);
    testUser = await createTestUser(testPool);
    testQuiz = await createTestQuiz(testPool);
    authToken = await generateTestToken(testUser.id);
  });

  describe('GET /api/quizzes', () => {
    it('should return paginated quizzes', async () => {
      const res = await request(app)
        .get('/api/quizzes')
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('quizzes');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.quizzes)).toBe(true);
    });
  });

  describe('GET /api/quiz/:id', () => {
    it('should return quiz by id', async () => {
      const res = await request(app)
        .get(`/api/quiz/${testQuiz.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testQuiz.id);
    });

    it('should return 404 for non-existent quiz', async () => {
      const res = await request(app)
        .get('/api/quiz/99999');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/shared/:shareId', () => {
    it('should return shared quiz without answers', async () => {
      const res = await request(app)
        .get(`/api/shared/${testQuiz.share_id}`);

      expect(res.status).toBe(200);
      expect(res.body.shared).toBe(true);
      expect(res.body.questions).toBeDefined();
    });
  });
});
