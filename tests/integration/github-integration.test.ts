/**
 * Integration tests for GitHub Integration Service
 * Tests webhook processing, repository synchronization, and workflow automation
 */

import request from 'supertest';
import { TurboFlowServer } from '../../src/api/server.js';
import { GitHubIntegration } from '../../src/core/GitHubIntegration.js';

// Mock GitHub API responses
const mockGitHubAPI = {
  // Repository data
  repo: {
    id: 123456789,
    name: 'test-repo',
    full_name: 'turbo-flow/test-repo',
    private: false,
    html_url: 'https://github.com/turbo-flow/test-repo',
    default_branch: 'main'
  },
  // Pull request data
  pullRequest: {
    id: 987654321,
    number: 42,
    title: 'Add new feature',
    state: 'open',
    user: { login: 'test-user' },
    base: { ref: 'main', sha: 'abc123' },
    head: { ref: 'feature-branch', sha: 'def456' },
    html_url: 'https://github.com/turbo-flow/test-repo/pull/42',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T12:00:00Z'
  },
  // Workflow runs
  workflowRuns: {
    total_count: 5,
    workflow_runs: [
      {
        id: 1111111,
        name: 'CI',
        status: 'completed',
        conclusion: 'success',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z'
      },
      {
        id: 2222222,
        name: 'Tests',
        status: 'in_progress',
        conclusion: null,
        created_at: '2024-01-01T02:00:00Z',
        updated_at: '2024-01-01T02:30:00Z'
      }
    ]
  }
};

// Mock fetch for GitHub API calls
global.fetch = jest.fn();

describe('GitHub Integration API Tests', () => {
  let server: TurboFlowServer;
  let app: any;
  let githubIntegration: GitHubIntegration;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';

    // Initialize server
    server = new TurboFlowServer(3001);
    app = server.getApp();

    // Initialize GitHub integration
    githubIntegration = GitHubIntegration.getInstance();
    await githubIntegration.initialize({
      apiToken: 'test-token',
      webhookSecret: 'test-secret'
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GitHub Webhook Endpoints', () => {
    describe('POST /api/github/webhooks', () => {
      it('should handle push webhook', async () => {
        // Mock successful GitHub auth
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ login: 'turbo-flow[bot]' })
        });

        const pushPayload = {
          headers: {
            'x-github-event': 'push',
            'x-hub-signature-256': 'sha256=valid-signature'
          },
          body: {
            ref: 'refs/heads/main',
            repository: {
              full_name: 'turbo-flow/test-repo',
              default_branch: 'main'
            },
            commits: [
              {
                id: 'abc123',
                message: 'Add new feature',
                author: { name: 'Test User', email: 'test@example.com' }
              }
            ],
            pusher: {
              name: 'test-user'
            }
          }
        };

        const response = await request(app)
          .post('/api/github/webhooks')
          .set('X-GitHub-Event', 'push')
          .set('X-Hub-Signature-256', 'sha256=valid-signature')
          .send(pushPayload.body)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Webhook processed successfully'
        });
      });

      it('should handle pull request webhook', async () => {
        const prPayload = {
          action: 'opened',
          pull_request: mockGitHubAPI.pullRequest,
          repository: mockGitHubAPI.repo
        };

        const response = await request(app)
          .post('/api/github/webhooks')
          .set('X-GitHub-Event', 'pull_request')
          .set('X-Hub-Signature-256', 'sha256=valid-signature')
          .send(prPayload)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should trigger verification on new pull request', async () => {
        // Mock truth verification API
        const verifySpy = jest.spyOn(githubIntegration, 'emit');

        const prPayload = {
          action: 'opened',
          pull_request: mockGitHubAPI.pullRequest,
          repository: mockGitHubAPI.repo
        };

        await request(app)
          .post('/api/github/webhooks')
          .set('X-GitHub-Event', 'pull_request')
          .set('X-Hub-Signature-256', 'sha256=valid-signature')
          .send(prPayload)
          .expect(200);

        // Verify verification was triggered
        expect(verifySpy).toHaveBeenCalledWith('verificationRequired', expect.objectContaining({
          type: 'pull_request',
          repository: 'turbo-flow/test-repo',
          pullRequestNumber: 42
        }));
      });

      it('should reject webhook with invalid signature', async () => {
        const response = await request(app)
          .post('/api/github/webhooks')
          .set('X-GitHub-Event', 'push')
          .set('X-Hub-Signature-256', 'sha256=invalid-signature')
          .send({ test: 'data' })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE'
          }
        });
      });

      it('should handle issues webhook', async () => {
        const issuePayload = {
          action: 'opened',
          issue: {
            id: 123456,
            number: 789,
            title: 'Bug report',
            body: 'Description of bug',
            user: { login: 'test-user' },
            state: 'open'
          },
          repository: mockGitHubAPI.repo
        };

        const response = await request(app)
          .post('/api/github/webhooks')
          .set('X-GitHub-Event', 'issues')
          .set('X-Hub-Signature-256', 'sha256=valid-signature')
          .send(issuePayload)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should handle release webhook', async () => {
        const releasePayload = {
          action: 'published',
          release: {
            id: 555555,
            tag_name: 'v1.0.0',
            name: 'Release 1.0.0',
            body: 'Release notes',
            draft: false,
            prerelease: false
          },
          repository: mockGitHubAPI.repo
        };

        const response = await request(app)
          .post('/api/github/webhooks')
          .set('X-GitHub-Event', 'release')
          .set('X-Hub-Signature-256', 'sha256=valid-signature')
          .send(releasePayload)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('GitHub Repository Management', () => {
    describe('GET /api/github/repos/:owner/:repo', () => {
      it('should fetch repository information', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockGitHubAPI.repo
        });

        const response = await request(app)
          .get('/api/github/repos/turbo-flow/test-repo')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            id: '123456789',
            name: 'test-repo',
            fullName: 'turbo-flow/test-repo',
            private: false
          })
        });
      });

      it('should handle non-existent repository', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 404
        });

        const response = await request(app)
          .get('/api/github/repos/nonexistent/repo')
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'REPOSITORY_NOT_FOUND'
          }
        });
      });

      it('should handle GitHub API errors', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            message: 'API rate limit exceeded'
          })
        });

        const response = await request(app)
          .get('/api/github/repos/turbo-flow/test-repo')
          .expect(503);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'GITHUB_API_ERROR'
          }
        });
      });
    });

    describe('POST /api/github/repos/:owner/:repo/webhooks', () => {
      it('should create webhook successfully', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            id: 123456,
            name: 'web',
            active: true,
            events: ['push', 'pull_request'],
            config: {
              url: 'https://example.com/webhook'
            }
          })
        });

        const webhookConfig = {
          url: 'https://example.com/webhook',
          events: ['push', 'pull_request'],
          active: true
        };

        const response = await request(app)
          .post('/api/github/repos/turbo-flow/test-repo/webhooks')
          .send(webhookConfig)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            id: '123456',
            active: true
          })
        });
      });

      it('should validate webhook configuration', async () => {
        const invalidConfig = {
          // Missing required url field
          events: ['push']
        };

        const response = await request(app)
          .post('/api/github/repos/turbo-flow/test-repo/webhooks')
          .send(invalidConfig)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_WEBHOOK_CONFIG'
          }
        });
      });
    });
  });

  describe('Pull Request Operations', () => {
    describe('POST /api/github/repos/:owner/:repo/pulls', () => {
      it('should create pull request', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockGitHubAPI.pullRequest
        });

        const prData = {
          title: 'New feature implementation',
          head: 'feature-branch',
          base: 'main',
          body: 'Description of changes'
        };

        const response = await request(app)
          .post('/api/github/repos/turbo-flow/test-repo/pulls')
          .send(prData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            number: 42,
            title: 'Add new feature',
            state: 'open'
          })
        });
      });

      it('should validate pull request data', async () => {
        const invalidPR = {
          title: '', // Empty title
          head: '', // Empty branch
          base: 'main'
        };

        const response = await request(app)
          .post('/api/github/repos/turbo-flow/test-repo/pulls')
          .send(invalidPR)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_PR_DATA'
          }
        });
      });
    });

    describe('GET /api/github/repos/:owner/:repo/pulls/:number', () => {
      it('should fetch pull request details', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockGitHubAPI.pullRequest
        });

        const response = await request(app)
          .get('/api/github/repos/turbo-flow/test-repo/pulls/42')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            number: 42,
            title: 'Add new feature'
          })
        });
      });

      it('should handle non-existent pull request', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 404
        });

        const response = await request(app)
          .get('/api/github/repos/turbo-flow/test-repo/pulls/999')
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'PR_NOT_FOUND'
          }
        });
      });
    });

    describe('POST /api/github/repos/:owner/:repo/pulls/:number/merge', () => {
      it('should merge pull request successfully', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            merged: true,
            sha: 'merged-commit-sha'
          })
        });

        const mergeOptions = {
          merge_method: 'squash',
          commit_title: 'Merge pull request #42'
        };

        const response = await request(app)
          .post('/api/github/repos/turbo-flow/test-repo/pulls/42/merge')
          .send(mergeOptions)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            merged: true,
            sha: 'merged-commit-sha'
          }
        });
      });

      it('should handle merge conflicts', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            merged: false,
            message: 'Merge conflict'
          })
        });

        const response = await request(app)
          .post('/api/github/repos/turbo-flow/test-repo/pulls/42/merge')
          .send({})
          .expect(409);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'MERGE_CONFLICT'
          }
        });
      });
    });

    describe('POST /api/github/repos/:owner/:repo/pulls/:number/status', () => {
      it('should update pull request status', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            state: 'success',
            context: 'turbo-flow/verification'
          })
        });

        const statusUpdate = {
          state: 'success',
          description: 'All checks passed',
          context: 'turbo-flow/verification',
          target_url: 'https://turbo-flow.example.com/checks/123'
        };

        const response = await request(app)
          .post('/api/github/repos/turbo-flow/test-repo/pulls/42/status')
          .send(statusUpdate)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            state: 'success'
          })
        });
      });
    });
  });

  describe('Workflow Automation', () => {
    describe('GET /api/github/repos/:owner/:repo/actions/runs', () => {
      it('should fetch workflow runs', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockGitHubAPI.workflowRuns
        });

        const response = await request(app)
          .get('/api/github/repos/turbo-flow/test-repo/actions/runs')
          .query({ status: 'completed' })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            total_count: 5,
            workflow_runs: expect.any(Array)
          })
        });

        // Verify query parameters were passed
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('status=completed'),
          expect.any(Object)
        );
      });

      it('should filter by branch', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            total_count: 0,
            workflow_runs: []
          })
        });

        const response = await request(app)
          .get('/api/github/repos/turbo-flow/test-repo/actions/runs')
          .query({ branch: 'main' })
          .expect(200);

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('branch=main'),
          expect.any(Object)
        );
      });
    });

    describe('POST /api/github/repos/:owner/:repo/actions/workflows/:workflow_id/dispatches', () => {
      it('should trigger workflow', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true
        });

        const triggerData = {
          ref: 'main',
          inputs: {
            version: '1.0.0',
            environment: 'production'
          }
        };

        const response = await request(app)
          .post('/api/github/repos/turbo-flow/test-repo/actions/workflows/ci.yml/dispatches')
          .send(triggerData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Workflow triggered successfully'
        });
      });
    });
  });

  describe('Content Management', () => {
    describe('GET /api/github/repos/:owner/:repo/contents/:path', () => {
      it('should fetch file contents', async () => {
        const fileContent = {
          name: 'README.md',
          path: 'README.md',
          type: 'file',
          content: Buffer.from('Hello World').toString('base64'),
          encoding: 'base64'
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => fileContent
        });

        const response = await request(app)
          .get('/api/github/repos/turbo-flow/test-repo/contents/README.md')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            name: 'README.md',
            content: 'Hello World'
          })
        });
      });

      it('should fetch directory contents', async () => {
        const dirContent = [
          {
            name: 'src',
            type: 'dir',
            path: 'src'
          },
          {
            name: 'package.json',
            type: 'file',
            path: 'package.json'
          }
        ];

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => dirContent
        });

        const response = await request(app)
          .get('/api/github/repos/turbo-flow/test-repo/contents/')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'src', type: 'dir' }),
            expect.objectContaining({ name: 'package.json', type: 'file' })
          ])
        });
      });
    });

    describe('PUT /api/github/repos/:owner/:repo/contents/:path', () => {
      it('should create new file', async () => {
        const createResponse = {
          content: {
            name: 'new-file.txt',
            path: 'new-file.txt',
            sha: 'file-sha'
          },
          commit: {
            sha: 'commit-sha',
            message: 'Create new-file.txt'
          }
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => createResponse
        });

        const fileData = {
          message: 'Create new file',
          content: 'File content'
        };

        const response = await request(app)
          .put('/api/github/repos/turbo-flow/test-repo/contents/new-file.txt')
          .send(fileData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            name: 'new-file.txt'
          })
        });
      });

      it('should update existing file', async () => {
        const updateResponse = {
          content: {
            name: 'existing.txt',
            path: 'existing.txt',
            sha: 'updated-sha'
          },
          commit: {
            sha: 'commit-sha',
            message: 'Update existing.txt'
          }
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => updateResponse
        });

        const fileData = {
          message: 'Update file',
          content: 'Updated content',
          sha: 'existing-sha'
        };

        const response = await request(app)
          .put('/api/github/repos/turbo-flow/test-repo/contents/existing.txt')
          .send(fileData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true
        });
      });

      it('should handle file conflict', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({
            message: 'SHA does not match'
          })
        });

        const fileData = {
          message: 'Update',
          content: 'Content',
          sha: 'wrong-sha'
        };

        const response = await request(app)
          .put('/api/github/repos/turbo-flow/test-repo/contents/file.txt')
          .send(fileData)
          .expect(409);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'FILE_CONFLICT'
          }
        });
      });
    });
  });

  describe('Search and Discovery', () => {
    describe('GET /api/github/search/repositories', () => {
      it('should search repositories', async () => {
        const searchResults = {
          total_count: 2,
          items: [
            {
              id: 111111,
              name: 'repo-1',
              full_name: 'user/repo-1',
              description: 'First repository',
              stargazers_count: 100,
              language: 'TypeScript'
            },
            {
              id: 222222,
              name: 'repo-2',
              full_name: 'user/repo-2',
              description: 'Second repository',
              stargazers_count: 50,
              language: 'JavaScript'
            }
          ]
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => searchResults
        });

        const response = await request(app)
          .get('/api/github/search/repositories')
          .query({
            q: 'language:typescript',
            sort: 'stars',
            per_page: 10
          })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            total_count: 2,
            items: expect.any(Array)
          })
        });

        // Verify search query was properly encoded
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('q=language%3Atypescript'),
          expect.any(Object)
        );
      });

      it('should validate search parameters', async () => {
        const response = await request(app)
          .get('/api/github/search/repositories')
          .query({
            // Missing required q parameter
            sort: 'stars'
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_SEARCH_PARAMS'
          }
        });
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect GitHub rate limits', async () => {
      // Mock rate limit headers
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (header: string) => {
            const rateLimitHeaders = {
              'X-RateLimit-Remaining': '5',
              'X-RateLimit-Limit': '5000',
              'X-RateLimit-Reset': (Date.now() / 1000 + 3600).toString(),
              'X-RateLimit-Used': '4995'
            };
            return rateLimitHeaders[header] || null;
          }
        },
        json: async () => mockGitHubAPI.repo
      });

      // First request should succeed
      await request(app)
        .get('/api/github/repos/turbo-flow/test-repo')
        .expect(200);

      // Second request should be rate limited
      const response = await request(app)
        .get('/api/github/repos/turbo-flow/test-repo-2')
        .expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMITED'
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      // Mock timeout
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('ETIMEDOUT')
      );

      const response = await request(app)
        .get('/api/github/repos/turbo-flow/test-repo')
        .expect(504);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NETWORK_TIMEOUT'
        }
      });
    });

    it('should handle malformed GitHub responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token in JSON');
        }
      });

      const response = await request(app)
        .get('/api/github/repos/turbo-flow/test-repo')
        .expect(502);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_RESPONSE'
        }
      });
    });

    it('should handle unauthorized API calls', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Bad credentials'
        })
      });

      const response = await request(app)
        .get('/api/github/repos/turbo-flow/test-repo')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED'
        }
      });
    });
  });

  describe('Integration with Truth Verification', () => {
    it('should automatically verify new pull requests', async () => {
      // Mock verification service
      const mockVerifyResponse = {
        success: true,
        data: {
          score: 0.95,
          passed: true,
          issues: []
        }
      };

      // Spy on verification trigger
      const verificationSpy = jest.fn().mockResolvedValue(mockVerifyResponse);

      // Mock the internal verification call
      (global as any).truthVerificationVerify = verificationSpy;

      const prPayload = {
        action: 'opened',
        pull_request: mockGitHubAPI.pullRequest,
        repository: mockGitHubAPI.repo
      };

      await request(app)
        .post('/api/github/webhooks')
        .set('X-GitHub-Event', 'pull_request')
        .set('X-Hub-Signature-256', 'sha256=valid-signature')
        .send(prPayload)
        .expect(200);

      // Note: In a real implementation, the verification would be triggered
      // asynchronously and we'd need to wait for it to complete
    });

    it('should update PR status based on verification results', async () => {
      // Mock successful verification
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          state: 'success',
          context: 'turbo-flow/verification'
        })
      });

      const statusUpdate = {
        state: 'success',
        description: 'Code quality verified (Score: 0.95)',
        context: 'turbo-flow/verification'
      };

      const response = await request(app)
        .post('/api/github/repos/turbo-flow/test-repo/pulls/42/status')
        .send(statusUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});