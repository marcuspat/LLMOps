// GitHub integration test setup
import { jest } from '@jest/globals';
import nock from 'nock';

// Mock GitHub API responses
export function setupGitHubMocks() {
  // Mock user authentication
  nock('https://api.github.com')
    .get('/user')
    .reply(200, {
      id: 123456,
      login: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
    });

  // Mock repository operations
  nock('https://api.github.com')
    .get('/repos/test-owner/test-repo')
    .reply(200, {
      id: 123,
      name: 'test-repo',
      full_name: 'test-owner/test-repo',
      private: false,
      language: 'TypeScript',
    });

  // Mock pull requests
  nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/pulls')
    .reply(200, [
      {
        id: 456,
        number: 1,
        title: 'Test PR',
        state: 'open',
        body: 'Test PR body',
      },
    ]);

  // Mock issues
  nock('https://api.github.com')
    .get('/repos/test-owner/test-repo/issues')
    .reply(200, [
      {
        id: 789,
        number: 1,
        title: 'Test Issue',
        state: 'open',
        body: 'Test issue body',
      },
    ]);
}

// Global setup for GitHub tests
beforeAll(() => {
  setupGitHubMocks();
});

afterEach(() => {
  nock.cleanAll();
});

// Export test utilities
export const githubTestUtils = {
  createMockRepo: () => ({
    id: 123,
    name: 'test-repo',
    owner: 'test-owner',
    url: 'https://github.com/test-owner/test-repo',
    private: false,
    language: 'TypeScript',
  }),

  createMockPR: () => ({
    id: 456,
    number: 1,
    title: 'Test PR',
    state: 'open',
    body: 'Test PR body',
  }),

  createMockIssue: () => ({
    id: 789,
    number: 1,
    title: 'Test Issue',
    state: 'open',
    body: 'Test issue body',
  }),
};