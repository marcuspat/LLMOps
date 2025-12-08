import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { Pool } from 'pg';
import Redis from 'ioredis';
import nock from 'nock';

// Mock services
let mongoServer: MongoMemoryServer;
let pgPool: Pool;
let redisClient: Redis;

beforeAll(async () => {
  // Start MongoDB in-memory instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;

  // Setup test PostgreSQL database
  pgPool = new Pool({
    connectionString: 'postgresql://test:test@localhost:5432/testdb',
  });

  // Setup test Redis instance
  redisClient = new Redis({
    host: 'localhost',
    port: 6379,
    db: 1,
  });

  // Enable nock for HTTP mocking
  nock.disableNetConnect();
  nock.enableNetConnect(/^(127\.0\.0\.1|localhost)/);

  // Setup test data
  await setupTestData();
});

afterAll(async () => {
  // Cleanup test databases
  await mongoServer.stop();
  await pgPool.end();
  await redisClient.quit();

  // Restore network connections
  nock.cleanAll();
  nock.enableNetConnect();
});

beforeEach(async () => {
  // Reset test data before each test
  await resetTestData();
});

afterEach(() => {
  // Clean up any remaining nock interceptors
  nock.cleanAll();
});

async function setupTestData() {
  // Create test tables in PostgreSQL
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS repositories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      owner VARCHAR(255) NOT NULL,
      url VARCHAR(500) NOT NULL,
      private BOOLEAN DEFAULT false,
      language VARCHAR(100),
      user_id UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Setup test collections in MongoDB
  // This would be handled by your MongoDB client setup
}

async function resetTestData() {
  // Clean up test data
  await pgPool.query('TRUNCATE TABLE repositories, users CASCADE;');

  // Clear all Redis keys
  await redisClient.flushdb();
}

// Mock GitHub API
export function mockGitHubAPI() {
  const githubApi = nock('https://api.github.com');

  githubApi.get('/user').reply(200, {
    id: 123456,
    login: 'test-user',
    name: 'Test User',
    email: 'test@example.com',
  });

  githubApi.get('/user/repos').reply(200, [
    {
      id: 123,
      name: 'test-repo',
      full_name: 'test-user/test-repo',
      private: false,
      language: 'TypeScript',
    }
  ]);

  githubApi.get('/repos/test-user/test-repo/pulls').reply(200, [
    {
      id: 456,
      number: 1,
      title: 'Test PR',
      state: 'open',
    }
  ]);

  return githubApi;
}

// Mock external services
export function mockExternalServices() {
  // Mock Claude API
  nock('https://api.anthropic.com')
    .post('/v1/messages')
    .reply(200, {
      id: 'msg-test-id',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Test response' }],
    });

  // Mock OpenAI API
  nock('https://api.openai.com')
    .post('/v1/chat/completions')
    .reply(200, {
      id: 'chatcmpl-test',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Test response',
          },
        },
      ],
    });
}

// Test utilities
export const testUtils = {
  createTestUser: async () => {
    const result = await pgPool.query(
      'INSERT INTO users (email, name, role) VALUES ($1, $2, $3) RETURNING *',
      ['test@example.com', 'Test User', 'user']
    );
    return result.rows[0];
  },

  createTestRepo: async (userId: string) => {
    const result = await pgPool.query(
      'INSERT INTO repositories (name, owner, url, private, language, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      ['test-repo', 'test-user', 'https://github.com/test-user/test-repo', false, 'TypeScript', userId]
    );
    return result.rows[0];
  },

  waitForCondition: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Condition not met within timeout');
  },
};