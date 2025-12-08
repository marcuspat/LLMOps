import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { GitHubWebhookHandler } from '../../src/github-agents/webhook-handlers';
import { GitHubAgentCoordinator } from '../../src/github-agents/agent-coordination';
import { Octokit } from '@octokit/rest';

describe('GitHub Agents Integration Tests', () => {
  let webhookHandler: GitHubWebhookHandler;
  let coordinator: GitHubAgentCoordinator;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeAll(async () => {
    // Mock GitHub API client
    mockOctokit = {
      apps: {
        getOrgInstallation: jest.fn(),
        createInstallationAccessToken: jest.fn()
      },
      pulls: {
        get: jest.fn(),
        createReview: jest.fn(),
        requestReviewers: jest.fn()
      },
      issues: {
        get: jest.fn(),
        createComment: jest.fn(),
        addLabels: jest.fn()
      },
      repos: {
        get: jest.fn(),
        createStatus: jest.fn()
      }
    } as any;

    // Initialize coordinator
    coordinator = new GitHubAgentCoordinator({
      healthCheckInterval: 30000,
      taskQueueInterval: 10000,
      shutdownTimeout: 60000,
      maxConcurrentTasks: 10
    });

    // Initialize webhook handler
    webhookHandler = new GitHubWebhookHandler(mockOctokit, {
      prManager: {
        autoAssign: true,
        qualityThreshold: 0.8,
        reviewTimeout: 86400000,
        autoReview: true
      },
      issueTracker: {
        autoTriage: true,
        duplicateDetection: true,
        autoAssign: true,
        maxAssignees: 3
      },
      securityManager: {
        autoScan: true,
        blockOnCritical: true,
        policyEnforcement: true,
        threatIntelligence: true
      },
      workflowManager: {
        autoOptimize: true,
        parallelExecution: true,
        cachingEnabled: true,
        securityScan: true
      },
      repoArchitect: {
        autoAnalyze: true,
        structureOptimization: true,
        bestPracticesEnforcement: true,
        refactoringEnabled: true
      }
    });
  });

  afterAll(async () => {
    await coordinator.shutdown();
  });

  describe('Webhook Event Handling', () => {
    test('should handle pull request opened event', async () => {
      const prEvent = {
        name: 'pull_request',
        payload: {
          action: 'opened',
          pull_request: {
            number: 123,
            title: 'Add new feature',
            body: 'This PR adds a new feature to the application.',
            user: {
              login: 'testuser'
            },
            base: {
              ref: 'main'
            },
            head: {
                ref: 'feature-branch',
                sha: 'abc123'
            }
          },
          repository: {
            name: 'test-repo',
            owner: {
              login: 'testowner'
            }
          }
        }
      };

      // Mock API responses
      mockOctokit.pulls.get.mockResolvedValue({
        data: prEvent.payload.pull_request
      } as any);

      // Should not throw any errors
      await expect(webhookHandler.handleEvent(prEvent)).resolves.not.toThrow();
    });

    test('should handle issue opened event', async () => {
      const issueEvent = {
        name: 'issues',
        payload: {
          action: 'opened',
          issue: {
            number: 456,
            title: 'Bug in authentication',
            body: 'The authentication system is not working properly.',
            user: {
              login: 'testuser'
            }
          },
          repository: {
            name: 'test-repo',
            owner: {
              login: 'testowner'
            }
          }
        }
      };

      mockOctokit.issues.get.mockResolvedValue({
        data: issueEvent.payload.issue
      } as any);

      await expect(webhookHandler.handleEvent(issueEvent)).resolves.not.toThrow();
    });

    test('should handle push event', async () => {
      const pushEvent = {
        name: 'push',
        payload: {
          ref: 'refs/heads/main',
          repository: {
            name: 'test-repo',
            owner: {
              login: 'testowner'
            }
          },
          commits: [
            {
              id: 'commit1',
              message: 'Add new feature',
              author: {
                name: 'Test Author'
              }
            }
          ]
        }
      };

      await expect(webhookHandler.handleEvent(pushEvent)).resolves.not.toThrow();
    });
  });

  describe('Agent Coordination', () => {
    test('should distribute task to suitable agent', async () => {
      const mockAgent = {
        id: 'test-agent',
        name: 'Test Agent',
        capabilities: ['code-review'],
        status: 'idle',
        getCurrentWorkload: jest.fn().mockReturnValue(0),
        isOverloaded: jest.fn().mockReturnValue(false),
        isHealthy: jest.fn().mockResolvedValue(true),
        assignTask: jest.fn().mockResolvedValue(undefined),
        subscribesTo: jest.fn().mockReturnValue(false),
        onStateChange: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      };

      await coordinator.registerAgent(mockAgent);

      const task = {
        id: 'task-1',
        type: 'code-review',
        priority: 1,
        data: { prNumber: 123 },
        startedAt: Date.now()
      };

      const assignedAgents = await coordinator.distributeTask(task);
      expect(assignedAgents).toContain('test-agent');
      expect(mockAgent.assignTask).toHaveBeenCalledWith(task);
    });

    test('should update shared state', () => {
      const key = 'test:state';
      const value = { status: 'active', count: 5 };

      coordinator.updateSharedState(key, value);
      const retrievedValue = coordinator.getSharedState(key);

      expect(retrievedValue).toEqual(value);
    });

    test('should get agent status overview', () => {
      const mockAgent1 = {
        id: 'agent-1',
        status: 'idle' as const,
        getCurrentWorkload: jest.fn().mockReturnValue(0),
        isOverloaded: jest.fn().mockReturnValue(false),
        isHealthy: jest.fn().mockResolvedValue(true),
        assignTask: jest.fn(),
        subscribesTo: jest.fn(),
        onStateChange: jest.fn(),
        shutdown: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      };

      const mockAgent2 = {
        id: 'agent-2',
        status: 'busy' as const,
        getCurrentWorkload: jest.fn().mockReturnValue(3),
        isOverloaded: jest.fn().mockReturnValue(false),
        isHealthy: jest.fn().mockResolvedValue(true),
        assignTask: jest.fn(),
        subscribesTo: jest.fn(),
        onStateChange: jest.fn(),
        shutdown: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      };

      // Register agents (using direct property access for testing)
      (coordinator as any).agents.set('agent-1', mockAgent1);
      (coordinator as any).agents.set('agent-2', mockAgent2);
      (coordinator as any).activeAgents.add('agent-1');
      (coordinator as any).activeAgents.add('agent-2');

      const status = coordinator.getAgentStatus();
      expect(status.total).toBe(2);
      expect(status.active).toBe(2);
      expect(status.idle).toBe(1);
      expect(status.busy).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle webhook processing errors gracefully', async () => {
      const invalidEvent = {
        name: 'invalid_event',
        payload: {}
      };

      // Should handle unknown event types gracefully
      await expect(webhookHandler.handleEvent(invalidEvent)).resolves.not.toThrow();
    });

    test('should handle agent task assignment failures', async () => {
      const mockFailingAgent = {
        id: 'failing-agent',
        name: 'Failing Agent',
        capabilities: ['test-task'],
        status: 'idle' as const,
        getCurrentWorkload: jest.fn().mockReturnValue(0),
        isOverloaded: jest.fn().mockReturnValue(false),
        isHealthy: jest.fn().mockResolvedValue(true),
        assignTask: jest.fn().mockRejectedValue(new Error('Task assignment failed')),
        subscribesTo: jest.fn(),
        onStateChange: jest.fn(),
        shutdown: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      };

      await coordinator.registerAgent(mockFailingAgent);

      const task = {
        id: 'failing-task',
        type: 'test-task',
        priority: 1,
        data: {},
        startedAt: Date.now()
      };

      // Should not throw even when agent fails
      await expect(coordinator.distributeTask(task)).resolves.not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    test('should track agent performance metrics', () => {
      const initialMetrics = coordinator.getMetrics();
      expect(initialMetrics.tasksProcessed).toBe(0);
      expect(initialMetrics.tasksSuccessful).toBe(0);
      expect(initialMetrics.tasksFailed).toBe(0);
    });

    test('should update metrics on task completion', async () => {
      const mockAgent = {
        id: 'metrics-agent',
        name: 'Metrics Agent',
        capabilities: ['test-task'],
        status: 'idle' as const,
        getCurrentWorkload: jest.fn().mockReturnValue(0),
        isOverloaded: jest.fn().mockReturnValue(false),
        isHealthy: jest.fn().mockResolvedValue(true),
        assignTask: jest.fn().mockImplementation(() => {
          // Simulate task completion
          setTimeout(() => {
            mockAgent.emit('task:completed', {
              id: 'metrics-task',
              type: 'test-task',
              priority: 1,
              data: {},
              startedAt: Date.now() - 1000
            });
          }, 100);
          return Promise.resolve();
        }),
        subscribesTo: jest.fn(),
        onStateChange: jest.fn(),
        shutdown: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      };

      await coordinator.registerAgent(mockAgent);

      const task = {
        id: 'metrics-task',
        type: 'test-task',
        priority: 1,
        data: {},
        startedAt: Date.now()
      };

      await coordinator.distributeTask(task);

      // Wait for task completion simulation
      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = coordinator.getMetrics();
      expect(metrics.tasksProcessed).toBe(1);
      expect(metrics.tasksSuccessful).toBe(1);
    });
  });
});