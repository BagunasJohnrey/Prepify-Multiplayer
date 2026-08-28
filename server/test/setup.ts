import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';

let GenericContainer: any;
let Wait: any;
let StartedTestContainer: any;

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.CLIENT_URL = 'http://localhost:5173';
// Set DATABASE_URL before any app imports so config/db.js uses the local DB
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('neon')) {
  process.env.DATABASE_URL = 'postgresql://prepify:prepify@localhost:5432/prepify';
}

// Global test container
let postgresContainer: StartedTestContainer;
let testPool: Pool;

/**
 * Start PostgreSQL test container
 */
// Check if Docker is available
async function isDockerAvailable(): Promise<boolean> {
  try {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const proc = spawn('docker', ['version'], { stdio: 'ignore' });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000); // Timeout after 5s
    });
  } catch {
    return false;
  }
}

export async function startTestDatabase(): Promise<Pool> {
  // Reuse existing pool if already connected
  if (testPool) {
    try {
      await testPool.query('SELECT 1');
      return testPool;
    } catch {
      await testPool.end().catch(() => {});
      testPool = null;
    }
  }

  // Always try docker-compose postgres first
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://prepify:prepify@localhost:5432/prepify';
  process.env.DATABASE_URL = databaseUrl;
  
  testPool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    ssl: false,
    statement_timeout: 30000,
    query_timeout: 30000,
    idle_in_transaction_session_timeout: 30000
  });
  testPool.on('error', (err) => {
    console.warn('Pool idle client error:', err.message);
  });
  
  try {
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    await runMigrationsWithRetry(testPool);
    return testPool;
  } catch (err) {
    console.warn('docker-compose postgres failed, trying testcontainers:', err.message);
    await testPool.end().catch(() => {});
    testPool = null;
  }
  
  // Fall back to testcontainers
  const dockerAvailable = await isDockerAvailable();
  
  if (!dockerAvailable) {
    console.warn('Docker not available for testcontainers. Using mock pool.');
    testPool = createMockPool();
    return testPool;
  }

  // Dynamically import testcontainers to avoid import-time crashes
  const tc = await import('testcontainers');
  GenericContainer = tc.GenericContainer;
  Wait = tc.Wait;

  postgresContainer = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'prepify_test'
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
    .start();

  const host = postgresContainer.getHost();
  const port = postgresContainer.getMappedPort(5432);

  const testcontainerUrl = `postgresql://test:test@${host}:${port}/prepify_test`;
  
  process.env.DATABASE_URL = testcontainerUrl;

  testPool = new Pool({
    connectionString: testcontainerUrl,
    max: 5,
    statement_timeout: 30000,
    query_timeout: 30000
  });
  testPool.on('error', (err) => {
    console.warn('Testcontainer pool idle client error:', err.message);
  });

  try {
    await runMigrationsWithRetry(testPool);
  } catch (migrationErr) {
    console.error('Migration failed after retries:', migrationErr);
    await testPool.end().catch(() => {});
    testPool = null;
    throw migrationErr;
  }

  return testPool;
}

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn()
  } as any;
}

const migrations = [
  `DROP TABLE IF EXISTS results CASCADE;`,
  `DROP TABLE IF EXISTS quizzes CASCADE;`,
  `DROP TABLE IF EXISTS users CASCADE;`,
  `CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    hearts INTEGER DEFAULT 3,
    xp INTEGER DEFAULT 0,
    last_heart_update TIMESTAMP DEFAULT NOW(),
    email VARCHAR(255),
    avatar_url TEXT,
    google_id VARCHAR(255) UNIQUE,
    profile_complete BOOLEAN DEFAULT false,
    last_login_date DATE,
    login_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    bookmarked_quizzes INTEGER[] DEFAULT '{}',
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    friends INTEGER[] DEFAULT '{}'
  );`,
  `CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    course VARCHAR(100),
    difficulty VARCHAR(50),
    description TEXT,
    questions JSONB NOT NULL,
    items_count INTEGER,
    share_id VARCHAR(32) UNIQUE,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
  );`,
  `CREATE TABLE results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    history JSONB NOT NULL,
    percentage INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_results_completed_at ON results(completed_at DESC);`
];

/**
 * Run database migrations with retry logic for CI stability
 */
async function runMigrationsWithRetry(pool: Pool, maxRetries = 3) {
  for (const migration of migrations) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await pool.query(migration);
        break;
      } catch (err: any) {
        retries++;
        if (retries >= maxRetries) throw err;
        console.warn(`Migration retry ${retries}/${maxRetries} (${migration.substring(0, 40)}...):`, err.message);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }
  }
}

/**
 * Stop test database
 */
export async function stopTestDatabase() {
  if (testPool) {
    await testPool.end();
  }
  if (postgresContainer) {
    await postgresContainer.stop();
  }
}

/**
 * Clean database between tests
 */
export async function cleanDatabase(pool: Pool) {
  const tables = ['results', 'quizzes', 'users'];
  for (const table of tables) {
    await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
  }
}

/**
 * Create a test user directly in database
 */
export async function createTestUser(pool: Pool, overrides = {}) {
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('testpassword123', 10);
  
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, email, role, hearts, xp)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      overrides.username || `testuser_${Date.now()}`,
      passwordHash,
      overrides.email || `test_${Date.now()}@example.com`,
      overrides.role || 'user',
      overrides.hearts ?? 3,
      overrides.xp ?? 0
    ]
  );
  
  return result.rows[0];
}

/**
 * Create a test quiz directly in database
 */
export async function createTestQuiz(pool: Pool, overrides = {}) {
  const questions = [
    {
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      answer: '4',
      explanation: 'Basic arithmetic'
    },
    {
      question: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      answer: 'Paris',
      explanation: 'Paris is the capital of France'
    }
  ];

  const result = await pool.query(
    `INSERT INTO quizzes (title, course, difficulty, description, questions, items_count, share_id, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      overrides.title || `Test Quiz ${Date.now()}`,
      overrides.course || 'General',
      overrides.difficulty || 'easy',
      overrides.description || 'Test quiz description',
      JSON.stringify(overrides.questions || questions),
      overrides.items_count || questions.length,
      overrides.share_id || `share_${Date.now()}`,
      overrides.tags || ['test', 'general']
    ]
  );
  
  return result.rows[0];
}

/**
 * Create a test result directly in database
 */
export async function createTestResult(pool: Pool, userId: number, quizId: number, overrides = {}) {
  const history = [
    {
      question: 'What is 2+2?',
      selected: '4',
      correct: '4',
      isCorrect: true,
      timeMs: 5000
    },
    {
      question: 'What is the capital of France?',
      selected: 'Paris',
      correct: 'Paris',
      isCorrect: true,
      timeMs: 3000
    }
  ];

  const result = await pool.query(
    `INSERT INTO results (user_id, quiz_id, score, total_questions, history, percentage, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      quizId,
      overrides.score ?? 2,
      overrides.totalQuestions ?? 2,
      JSON.stringify(overrides.history || history),
      overrides.percentage ?? 100,
      overrides.completedAt || new Date()
    ]
  );
  
  return result.rows[0];
}

/**
 * Generate a valid JWT token for testing
 */
export async function generateTestToken(userId: number, role = 'user') {
  const { default: jwt } = await import('jsonwebtoken');
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

// Global setup/teardown - only mocks, no database
// Integration tests should call startTestDatabase()/stopTestDatabase() explicitly

beforeEach(() => {
  vi.clearAllMocks();
});

// Export for use in tests
export { testPool };