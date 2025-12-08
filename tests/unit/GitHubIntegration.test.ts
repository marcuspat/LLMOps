/**
 * Unit tests for GitHub Integration Service
 * Tests webhook handling, API connections, and repository management
 */

import { GitHubIntegration } from '../../src/core/GitHubIntegration.js';
import { GitHubRepo, GitHubPullRequest, GitHubHook } from '../../src/types/index.js';

// Mock fetch for GitHub API calls
global.fetch = jest.fn();

// Mock crypto for signature verification
const mockCrypto = {
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-signature')
  }))
};
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

describe('GitHubIntegration Service', () => {
  let githubIntegration: GitHubIntegration;
  const mockConfig = {
    apiToken: 'test-token',
    webhookSecret: 'test-secret',
    baseUrl: 'https://api.github.com'
  };

  beforeEach(() => {
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
    githubIntegration = GitHubIntegration.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = GitHubIntegration.getInstance();
      const instance2 = GitHubIntegration.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with valid config', async () => {
      // Mock successful authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });

      await expect(githubIntegration.initialize(mockConfig)).resolves.not.toThrow();

      // Verify authentication was checked
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'token test-token'
          })
        })
      );
    });

    it('should throw error with invalid token', async () => {
      // Mock failed authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Bad credentials' })
      });

      await expect(githubIntegration.initialize(mockConfig)).rejects.toThrow('GitHub authentication failed');
    });

    it('should handle network errors during initialization', async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(githubIntegration.initialize(mockConfig)).rejects.toThrow('GitHub authentication failed');
    });
  });

  describe('Webhook Management', () => {
    beforeEach(async () => {
      // Initialize before webhook tests
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should create webhook successfully', async () => {
      // Mock webhook creation response
      const mockWebhook: GitHubHook = {
        id: '123456',
        name: 'Turbo Flow Webhook',
        events: ['push', 'pull_request', 'issues', 'release'],
        active: true,
        config: {
          url: 'https://example.com/webhook',
          contentType: 'application/json'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhook
      });

      const hookConfig = {
        url: 'https://example.com/webhook',
        secret: 'webhook-secret'
      };

      const webhook = await githubIntegration.createWebhook('test-repo', hookConfig);

      expect(webhook).toEqual(mockWebhook);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-repo/hooks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            id: expect.any(String),
            name: 'Turbo Flow Webhook',
            events: ['push', 'pull_request', 'issues', 'release'],
            active: true,
            config: {
              url: 'https://example.com/webhook',
              secret: 'webhook-secret',
              contentType: 'application/json'
            }
          })
        })
      );
    });

    it('should handle webhook creation for non-existent repository', async () => {
      const hookConfig = {
        url: 'https://example.com/webhook'
      };

      await expect(githubIntegration.createWebhook('non-existent-repo', hookConfig))
        .rejects.toThrow('Repository non-existent-repo not found');
    });

    it('should handle webhook creation failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Hook creation failed' })
      });

      const hookConfig = {
        url: 'https://example.com/webhook'
      };

      await expect(githubIntegration.createWebhook('test-repo', hookConfig))
        .rejects.toThrow('Failed to create webhook');
    });
  });

  describe('Webhook Event Handling', () => {
    beforeEach(async () => {
      // Initialize with mocked authentication
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should handle push events', async () => {
      const pushPayload = {
        headers: {
          'x-github-event': 'push'
        },
        body: {
          ref: 'refs/heads/main',
          repository: {
            full_name: 'test/repo'
          },
          commits: [{}, {}],
          pusher: {
            name: 'test-user'
          }
        }
      };

      // Spy on the event emitter
      const emitSpy = jest.spyOn(githubIntegration as any, 'emit');

      await githubIntegration.handleWebhook(pushPayload, 'valid-signature');

      expect(emitSpy).toHaveBeenCalledWith('pushEvent', {
        repository: 'test/repo',
        branch: 'main',
        commits: 2,
        pusher: 'test-user',
        timestamp: expect.any(Date)
      });
    });

    it('should handle pull request events', async () => {
      const prPayload = {
        headers: {
          'x-github-event': 'pull_request'
        },
        body: {
          action: 'opened',
          pull_request: {
            id: 123,
            number: 42,
            title: 'Test PR',
            state: 'open',
            user: { login: 'test-user' },
            base: { ref: 'main' },
            head: { ref: 'feature-branch' },
            html_url: 'https://github.com/test/repo/pull/42',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          repository: {
            full_name: 'test/repo'
          }
        }
      };

      const emitSpy = jest.spyOn(githubIntegration as any, 'emit');

      await githubIntegration.handleWebhook(prPayload, 'valid-signature');

      expect(emitSpy).toHaveBeenCalledWith('pullRequestEvent', {
        action: 'opened',
        repository: 'test/repo',
        pullRequest: expect.objectContaining({
          id: '123',
          number: 42,
          title: 'Test PR',
          state: 'open'
        }),
        timestamp: expect.any(Date)
      });

      // Should emit verificationRequired for opened PRs
      expect(emitSpy).toHaveBeenCalledWith('verificationRequired', {
        type: 'pull_request',
        repository: 'test/repo',
        pullRequestNumber: 42
      });
    });

    it('should handle issues events', async () => {
      const issuesPayload = {
        headers: {
          'x-github-event': 'issues'
        },
        body: {
          action: 'opened',
          issue: {
            id: 456,
            number: 78,
            title: 'Test Issue',
            state: 'open',
            user: { login: 'test-user' }
          },
          repository: {
            full_name: 'test/repo'
          }
        }
      };

      const emitSpy = jest.spyOn(githubIntegration as any, 'emit');

      await githubIntegration.handleWebhook(issuesPayload, 'valid-signature');

      expect(emitSpy).toHaveBeenCalledWith('issuesEvent', {
        action: 'opened',
        repository: 'test/repo',
        issue: {
          id: 456,
          number: 78,
          title: 'Test Issue',
          state: 'open',
          author: 'test-user'
        },
        timestamp: expect.any(Date)
      });
    });

    it('should handle release events', async () => {
      const releasePayload = {
        headers: {
          'x-github-event': 'release'
        },
        body: {
          action: 'published',
          release: {
            id: 789,
            tag_name: 'v1.0.0',
            name: 'Release 1.0.0',
            draft: false,
            prerelease: false
          },
          repository: {
            full_name: 'test/repo'
          }
        }
      };

      const emitSpy = jest.spyOn(githubIntegration as any, 'emit');

      await githubIntegration.handleWebhook(releasePayload, 'valid-signature');

      expect(emitSpy).toHaveBeenCalledWith('releaseEvent', {
        action: 'published',
        repository: 'test/repo',
        release: {
          id: 789,
          tagName: 'v1.0.0',
          name: 'Release 1.0.0',
          draft: false,
          prerelease: false
        },
        timestamp: expect.any(Date)
      });
    });

    it('should reject invalid webhook signature', async () => {
      // Mock signature verification to fail
      mockCrypto.createHmac().digest.mockReturnValueOnce('different-signature');

      const payload = {
        headers: {},
        body: { test: 'data' }
      };

      await expect(githubIntegration.handleWebhook(payload, 'invalid-signature'))
        .rejects.toThrow('Invalid webhook signature');
    });

    it('should handle unknown event types', async () => {
      const unknownPayload = {
        headers: {
          'x-github-event': 'unknown_event'
        },
        body: {}
      };

      // Should not throw error
      await expect(githubIntegration.handleWebhook(unknownPayload, 'valid-signature'))
        .resolves.not.toThrow();
    });
  });

  describe('Repository Operations', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should get repository information', async () => {
      const mockRepo = {
        id: 12345,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        html_url: 'https://github.com/owner/test-repo',
        private: false,
        default_branch: 'main'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepo
      });

      const repo = await githubIntegration.getRepository('owner', 'test-repo');

      expect(repo).toEqual({
        id: '12345',
        owner: 'owner',
        name: 'test-repo',
        fullName: 'owner/test-repo',
        url: 'https://github.com/owner/test-repo',
        private: false,
        defaultBranch: 'main',
        hooks: []
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/test-repo',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'token test-token'
          })
        })
      );
    });

    it('should return null for non-existent repository', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const repo = await githubIntegration.getRepository('owner', 'non-existent');

      expect(repo).toBeNull();
    });

    it('should use cached repository data', async () => {
      const mockRepo: GitHubRepo = {
        id: '12345',
        owner: 'owner',
        name: 'test-repo',
        fullName: 'owner/test-repo',
        url: 'https://github.com/owner/test-repo',
        private: false,
        defaultBranch: 'main',
        hooks: []
      };

      // Simulate cached repository (bypass cache invalidation for test)
      (githubIntegration as any).repositories.set('owner/test-repo', mockRepo);

      const repo = await githubIntegration.getRepository('owner', 'test-repo');

      expect(repo).toEqual(mockRepo);
      // Should not make API call for cached repo
      expect(global.fetch).not.toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/test-repo',
        expect.any(Object)
      );
    });
  });

  describe('Pull Request Operations', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should create pull request', async () => {
      const mockPR = {
        id: 98765,
        number: 42,
        title: 'Test PR',
        state: 'open',
        user: { login: 'test-user' },
        base: { ref: 'main' },
        head: { ref: 'feature-branch' },
        html_url: 'https://github.com/owner/repo/pull/42',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPR
      });

      const prData = {
        title: 'Test PR',
        head: 'feature-branch',
        base: 'main',
        body: 'Test PR body'
      };

      const pr = await githubIntegration.createPullRequest('owner', 'repo', prData);

      expect(pr).toEqual({
        id: '98765',
        number: 42,
        title: 'Test PR',
        state: 'open',
        author: 'test-user',
        baseBranch: 'main',
        headBranch: 'feature-branch',
        url: 'https://github.com/owner/repo/pull/42',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      });
    });

    it('should get pull request details', async () => {
      const mockPR = {
        id: 98765,
        number: 42,
        title: 'Test PR',
        state: 'open',
        user: { login: 'test-user' },
        base: { ref: 'main' },
        head: { ref: 'feature-branch' },
        html_url: 'https://github.com/owner/repo/pull/42',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPR
      });

      const pr = await githubIntegration.getPullRequest('owner', 'repo', 42);

      expect(pr).toBeDefined();
      expect(pr?.number).toBe(42);
      expect(pr?.title).toBe('Test PR');
    });

    it('should merge pull request successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ merged: true, sha: 'abc123' })
      });

      const merged = await githubIntegration.mergePullRequest('owner', 'repo', 42, {
        mergeMethod: 'squash'
      });

      expect(merged).toBe(true);
    });

    it('should handle merge failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ merged: false, message: 'Merge conflict' })
      });

      const merged = await githubIntegration.mergePullRequest('owner', 'repo', 42);

      expect(merged).toBe(false);
    });

    it('should update pull request status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'success' })
      });

      const statusUpdate = {
        sha: 'abc123',
        state: 'success' as const,
        description: 'Checks passed',
        context: 'turbo-flow/verification'
      };

      await expect(githubIntegration.updatePullRequestStatus('owner', 'repo', 42, statusUpdate))
        .resolves.not.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should respect rate limits', async () => {
      // Mock rate limit headers
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (header: string) => {
            switch (header) {
              case 'X-RateLimit-Remaining':
                return '5'; // Low remaining requests
              case 'X-RateLimit-Limit':
                return '5000';
              case 'X-RateLimit-Reset':
                return (Date.now() / 1000 + 3600).toString();
              default:
                return null;
            }
          }
        },
        json: async () => ({})
      });

      // Make first request to update rate limit info
      await githubIntegration.getRepository('owner', 'repo');

      // Second request should be rate limited
      await expect(githubIntegration.getRepository('owner', 'repo2'))
        .rejects.toMatchObject({
          success: false,
          error: {
            code: 'RATE_LIMITED'
          }
        });
    });

    it('should parse rate limit headers correctly', async () => {
      const mockHeaders = {
        'X-RateLimit-Limit': '5000',
        'X-RateLimit-Remaining': '4999',
        'X-RateLimit-Reset': '1640995200',
        'X-RateLimit-Used': '1'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (header: string) => mockHeaders[header] || null
        },
        json: async () => ({})
      });

      await githubIntegration.getRepository('owner', 'repo');

      // Verify rate limit was tracked
      const rateLimitInfo = (githubIntegration as any).rateLimitTracker.getRateLimitInfo();
      expect(rateLimitInfo.limit).toBe(5000);
      expect(rateLimitInfo.remaining).toBe(4999);
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should search repositories', async () => {
      const mockSearchResults = {
        items: [
          {
            id: 123,
            name: 'repo1',
            full_name: 'owner/repo1',
            stargazers_count: 100
          },
          {
            id: 456,
            name: 'repo2',
            full_name: 'owner/repo2',
            stargazers_count: 200
          }
        ],
        total_count: 2
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResults
      });

      const result = await githubIntegration.searchRepositories('topic:typescript', {
        sort: 'stars',
        perPage: 10
      });

      expect(result.data.items).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search/repositories?'),
        expect.any(Object)
      );
    });

    it('should handle search with options', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], total_count: 0 })
      });

      await githubIntegration.searchRepositories('test', {
        sort: 'updated',
        order: 'desc',
        perPage: 5,
        page: 2
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=test&sort=updated&order=desc&per_page=5&page=2'),
        expect.any(Object)
      );
    });
  });

  describe('User Operations', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should get current user information', async () => {
      const mockUser = {
        login: 'test-user',
        id: 12345,
        name: 'Test User',
        email: 'test@example.com'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      const user = await githubIntegration.getUser();

      expect(user.data.login).toBe('test-user');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.any(Object)
      );
    });

    it('should get specific user information', async () => {
      const mockUser = {
        login: 'target-user',
        id: 67890,
        name: 'Target User'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      const user = await githubIntegration.getUser('target-user');

      expect(user.data.login).toBe('target-user');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/users/target-user',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await githubIntegration.getRepository('owner', 'repo');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NETWORK_ERROR');
    });

    it('should handle API errors with proper formatting', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          message: 'Rate limit exceeded',
          documentation_url: 'https://docs.github.com/rest/overview/rate-limits-for-the-rest-api'
        })
      });

      const result = await githubIntegration.getRepository('owner', 'repo');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('403');
      expect(result.error.message).toContain('Rate limit exceeded');
    });

    it('should handle malformed API responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const result = await githubIntegration.getRepository('owner', 'repo');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NETWORK_ERROR');
    });
  });

  describe('Workflow Operations', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should get workflow runs', async () => {
      const mockWorkflowRuns = {
        total_count: 5,
        workflow_runs: [
          {
            id: 123456,
            name: 'CI',
            status: 'completed',
            conclusion: 'success'
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkflowRuns
      });

      const result = await githubIntegration.getWorkflowRuns('owner', 'repo', 'completed');

      expect(result.data.workflow_runs).toHaveLength(1);
    });

    it('should trigger workflow', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const result = await githubIntegration.triggerWorkflow('owner', 'repo', 'ci.yml', {
        version: '1.0.0'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Content Operations', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should get repository contents', async () => {
      const mockContents = {
        name: 'README.md',
        path: 'README.md',
        type: 'file',
        content: Buffer.from('README content').toString('base64')
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockContents
      });

      const result = await githubIntegration.getContents('owner', 'repo', 'README.md');

      expect(result.success).toBe(true);
    });

    it('should create or update file', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: {
            name: 'test.txt',
            path: 'test.txt'
          }
        })
      });

      const result = await githubIntegration.createOrUpdateFile(
        'owner',
        'repo',
        'test.txt',
        'File content',
        'Create test file'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'test-user' })
      });
      await githubIntegration.initialize(mockConfig);
    });

    it('should emit events for repository operations', async () => {
      const emitSpy = jest.spyOn(githubIntegration as any, 'emit');

      await githubIntegration.createPullRequest('owner', 'repo', {
        title: 'Test PR',
        head: 'feature',
        base: 'main'
      });

      expect(emitSpy).toHaveBeenCalledWith('pullRequestCreated', {
        repository: 'owner/repo',
        pullRequest: expect.any(Object)
      });
    });

    it('should emit events for file operations', async () => {
      const emitSpy = jest.spyOn(githubIntegration as any, 'emit');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: {} })
      });

      await githubIntegration.createOrUpdateFile(
        'owner',
        'repo',
        'test.txt',
        'content',
        'commit message'
      );

      expect(emitSpy).toHaveBeenCalledWith('fileUpdated', {
        repository: 'owner/repo',
        path: 'test.txt',
        message: 'commit message'
      });
    });
  });
});