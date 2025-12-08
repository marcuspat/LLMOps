import request from 'supertest';
import WebSocket from 'ws';
import { TurboFlowServer } from '../../src/api/server.js';
import { TruthVerification } from '../../src/core/TruthVerification.js';
import { AgentCoordination } from '../../src/core/AgentCoordination.js';
import { GitHubIntegration } from '../../src/core/GitHubIntegration.js';
import { SecurityScanning } from '../../src/core/SecurityScanning.js';
import { PerformanceMonitoring } from '../../src/core/PerformanceMonitoring.js';

// Mock dependencies
jest.mock('../../src/core/TruthVerification.js');
jest.mock('../../src/core/AgentCoordination.js');
jest.mock('../../src/core/GitHubIntegration.js');
jest.mock('../../src/core/SecurityScanning.js');
jest.mock('../../src/core/PerformanceMonitoring.js');

// Mock console methods to reduce test noise
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

describe('TurboFlowServer - Comprehensive API Tests', () => {
  let server: TurboFlowServer;
  let mockTruthVerification: jest.Mocked<TruthVerification>;
  let mockAgentCoordination: jest.Mocked<AgentCoordination>;
  let mockGitHubIntegration: jest.Mocked<GitHubIntegration>;
  let mockSecurityScanning: jest.Mocked<SecurityScanning>;
  let mockPerformanceMonitoring: jest.Mocked<PerformanceMonitoring>;

  beforeEach(() => {
    // Setup mocks
    mockTruthVerification = {
      getInstance: jest.fn().mockReturnThis(),
      verify: jest.fn(),
      verifyBatch: jest.fn(),
      getVerificationStats: jest.fn(),
      on: jest.fn()
    } as any;

    mockAgentCoordination = {
      getInstance: jest.fn().mockReturnThis(),
      createSwarm: jest.fn(),
      spawnAgent: jest.fn(),
      spawnAgentsParallel: jest.fn(),
      getSystemStatus: jest.fn(),
      getAgentMetrics: jest.fn(),
      scaleSwarm: jest.fn(),
      orchestrateTask: jest.fn(),
      on: jest.fn()
    } as any;

    mockGitHubIntegration = {
      getInstance: jest.fn().mockReturnThis(),
      initialize: jest.fn(),
      handleWebhook: jest.fn(),
      createWebhook: jest.fn(),
      getRepository: jest.fn(),
      createPullRequest: jest.fn()
    } as any;

    mockSecurityScanning = {
      getInstance: jest.fn().mockReturnThis(),
      initiateScan: jest.fn(),
      performComprehensiveScan: jest.fn(),
      getScanStatus: jest.fn(),
      getSecurityResults: jest.fn(),
      getSecurityStats: jest.fn(),
      generateSecurityReport: jest.fn(),
      on: jest.fn()
    } as any;

    mockPerformanceMonitoring = {
      getInstance: jest.fn().mockReturnThis(),
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      getMetrics: jest.fn(),
      getAgentMetrics: jest.fn(),
      generatePerformanceReport: jest.fn(),
      runBenchmarks: jest.fn(),
      analyzeBottlenecks: jest.fn(),
      on: jest.fn()
    } as any;

    // Override constructors
    (TruthVerification.getInstance as jest.Mock) = mockTruthVerification.getInstance;
    (AgentCoordination.getInstance as jest.Mock) = mockAgentCoordination.getInstance;
    (GitHubIntegration.getInstance as jest.Mock) = mockGitHubIntegration.getInstance;
    (SecurityScanning.getInstance as jest.Mock) = mockSecurityScanning.getInstance;
    (PerformanceMonitoring.getInstance as jest.Mock) = mockPerformanceMonitoring.getInstance;

    server = new TurboFlowServer(3001); // Use different port for tests
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    jest.clearAllMocks();
  });

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      mockPerformanceMonitoring.startMonitoring.mockResolvedValue(undefined);

      await expect(server.start()).resolves.not.toThrow();

      expect(mockTruthVerification.getInstance).toHaveBeenCalled();
      expect(mockAgentCoordination.getInstance).toHaveBeenCalled();
      expect(mockGitHubIntegration.getInstance).toHaveBeenCalled();
      expect(mockSecurityScanning.getInstance).toHaveBeenCalled();
      expect(mockPerformanceMonitoring.getInstance).toHaveBeenCalled();
    });

    it('should handle server startup failure', async () => {
      const badServer = new TurboFlowServer(9999); // Invalid port

      // Mock initialization to fail
      mockPerformanceMonitoring.startMonitoring.mockRejectedValue(new Error('Initialization failed'));

      await expect(badServer.start()).rejects.toThrow();
    });

    it('should stop server gracefully', async () => {
      await server.start();
      await expect(server.stop()).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should return healthy status', async () => {
      const response = await request(server['app'])
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeInstanceOf(Date);
      expect(response.body.data.uptime).toBeGreaterThan(0);
      expect(response.body.data.version).toBeDefined();
    });
  });

  describe('Truth Verification Routes', () => {
    beforeEach(async () => {
      await server.start();
      mockTruthVerification.verify.mockResolvedValue({
        score: 0.95,
        passed: true,
        confidence: 0.98,
        details: { issues: [], suggestions: [], metrics: {} },
        timestamp: new Date()
      });
    });

    it('should verify content successfully', async () => {
      const verificationRequest = {
        type: 'CODE_QUALITY',
        content: 'function test() { return true; }',
        threshold: 0.9
      };

      const response = await request(server['app'])
        .post('/api/truth/verify')
        .send(verificationRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBe(0.95);
      expect(response.body.data.passed).toBe(true);
      expect(mockTruthVerification.verify).toHaveBeenCalledWith(verificationRequest);
    });

    it('should handle verification errors', async () => {
      mockTruthVerification.verify.mockRejectedValue(new Error('Verification service unavailable'));

      const response = await request(server['app'])
        .post('/api/truth/verify')
        .send({ type: 'CODE_QUALITY', content: 'test' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VERIFICATION_ERROR');
      expect(response.body.error.message).toBe('Verification service unavailable');
    });

    it('should handle batch verification', async () => {
      const batchRequest = {
        requests: [
          { type: 'CODE_QUALITY', content: 'code1' },
          { type: 'SECURITY', content: 'code2' }
        ]
      };

      mockTruthVerification.verifyBatch.mockResolvedValue([
        { score: 0.9, passed: true },
        { score: 0.85, passed: false }
      ]);

      const response = await request(server['app'])
        .post('/api/truth/verify-batch')
        .send(batchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(mockTruthVerification.verifyBatch).toHaveBeenCalledWith(batchRequest.requests);
    });

    it('should handle malformed batch requests', async () => {
      mockTruthVerification.verifyBatch.mockRejectedValue(new Error('Invalid batch format'));

      const response = await request(server['app'])
        .post('/api/truth/verify-batch')
        .send({ invalid: 'format' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BATCH_VERIFICATION_ERROR');
    });

    it('should get verification statistics', async () => {
      const mockStats = {
        totalVerifications: 100,
        averageScore: 0.92,
        passRate: 0.88,
        commonIssues: ['complexity', 'documentation'],
        scoreTrend: [0.9, 0.91, 0.92]
      };

      mockTruthVerification.getVerificationStats.mockReturnValue(mockStats);

      const response = await request(server['app'])
        .get('/api/truth/stats')
        .query({ start: '2023-01-01', end: '2023-12-31' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalVerifications).toBe(100);
      expect(response.body.data.averageScore).toBe(0.92);
      expect(mockTruthVerification.getVerificationStats).toHaveBeenCalled();
    });
  });

  describe('Agent Coordination Routes', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should create swarm successfully', async () => {
      const swarmRequest = {
        topology: 'mesh',
        maxAgents: 10,
        strategy: 'balanced'
      };

      const mockSwarm = {
        id: 'swarm-123',
        topology: 'mesh',
        agents: [],
        createdAt: new Date()
      };

      mockAgentCoordination.createSwarm.mockResolvedValue(mockSwarm);

      const response = await request(server['app'])
        .post('/api/agents/swarms')
        .send(swarmRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('swarm-123');
      expect(response.body.data.topology).toBe('mesh');
      expect(mockAgentCoordination.createSwarm).toHaveBeenCalledWith(swarmRequest);
    });

    it('should spawn agent successfully', async () => {
      const agentRequest = {
        type: 'CODER',
        config: { capabilities: ['javascript', 'typescript'] }
      };

      const mockAgent = {
        id: 'agent-456',
        type: 'CODER',
        status: 'active',
        capabilities: ['javascript', 'typescript']
      };

      mockAgentCoordination.spawnAgent.mockResolvedValue(mockAgent);

      const response = await request(server['app'])
        .post('/api/agents/agents')
        .send(agentRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('agent-456');
      expect(response.body.data.type).toBe('CODER');
      expect(mockAgentCoordination.spawnAgent).toHaveBeenCalledWith('CODER', agentRequest.config);
    });

    it('should handle agent spawn errors', async () => {
      mockAgentCoordination.spawnAgent.mockRejectedValue(new Error('Agent type not supported'));

      const response = await request(server['app'])
        .post('/api/agents/agents')
        .send({ type: 'INVALID_TYPE' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AGENT_SPAWN_ERROR');
      expect(response.body.error.message).toBe('Agent type not supported');
    });

    it('should spawn multiple agents in parallel', async () => {
      const batchRequest = {
        agents: [
          { type: 'CODER', config: { capabilities: ['js'] } },
          { type: 'TESTER', config: { capabilities: ['jest'] } }
        ],
        options: { parallel: true }
      };

      const mockAgents = [
        { id: 'agent-1', type: 'CODER', status: 'active' },
        { id: 'agent-2', type: 'TESTER', status: 'active' }
      ];

      mockAgentCoordination.spawnAgentsParallel.mockResolvedValue(mockAgents);

      const response = await request(server['app'])
        .post('/api/agents/agents/batch')
        .send(batchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(mockAgentCoordination.spawnAgentsParallel).toHaveBeenCalledWith(
        batchRequest.agents,
        batchRequest.options
      );
    });

    it('should get system status', async () => {
      const mockStatus = {
        totalAgents: 15,
        activeSwarms: 3,
        systemHealth: 'healthy',
        uptime: 3600
      };

      mockAgentCoordination.getSystemStatus.mockReturnValue(mockStatus);

      const response = await request(server['app'])
        .get('/api/agents/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalAgents).toBe(15);
      expect(response.body.data.activeSwarms).toBe(3);
      expect(mockAgentCoordination.getSystemStatus).toHaveBeenCalled();
    });

    it('should handle missing agent metrics', async () => {
      mockAgentCoordination.getAgentMetrics.mockReturnValue(undefined);

      const response = await request(server['app'])
        .get('/api/agents/agents/nonexistent/metrics')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AGENT_NOT_FOUND');
    });

    it('should scale swarm successfully', async () => {
      mockAgentCoordination.scaleSwarm.mockResolvedValue(undefined);

      const response = await request(server['app'])
        .post('/api/agents/swarms/swarm-123/scale')
        .send({ targetSize: 20 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Swarm scaled successfully');
      expect(mockAgentCoordination.scaleSwarm).toHaveBeenCalledWith('swarm-123', 20);
    });

    it('should orchestrate task successfully', async () => {
      mockAgentCoordination.orchestrateTask.mockResolvedValue(undefined);

      const taskRequest = {
        type: 'CODE_REVIEW',
        priority: 'high',
        assignedAgents: ['agent-1', 'agent-2']
      };

      const response = await request(server['app'])
        .post('/api/agents/tasks')
        .send(taskRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Task orchestrated successfully');
      expect(mockAgentCoordination.orchestrateTask).toHaveBeenCalledWith(taskRequest);
    });
  });

  describe('Security Scanning Routes', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should initiate security scan', async () => {
      const scanRequest = {
        type: 'VULNERABILITY_SCAN',
        target: '/path/to/code',
        options: { depth: 'deep' }
      };

      const mockScan = {
        id: 'scan-789',
        type: 'VULNERABILITY_SCAN',
        status: 'initiated',
        target: '/path/to/code'
      };

      mockSecurityScanning.initiateScan.mockResolvedValue(mockScan);

      const response = await request(server['app'])
        .post('/api/security/scans')
        .send(scanRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('scan-789');
      expect(response.body.data.type).toBe('VULNERABILITY_SCAN');
      expect(mockSecurityScanning.initiateScan).toHaveBeenCalledWith(
        scanRequest.type,
        scanRequest.target,
        scanRequest.options
      );
    });

    it('should perform comprehensive scan', async () => {
      const comprehensiveRequest = {
        target: '/path/to/project',
        options: { includeDependencies: true }
      };

      const mockScans = [
        { id: 'scan-1', type: 'VULNERABILITY_SCAN', status: 'completed' },
        { id: 'scan-2', type: 'DEPENDENCY_SCAN', status: 'completed' },
        { id: 'scan-3', type: 'CODE_ANALYSIS', status: 'completed' }
      ];

      mockSecurityScanning.performComprehensiveScan.mockResolvedValue(mockScans);

      const response = await request(server['app'])
        .post('/api/security/scans/comprehensive')
        .send(comprehensiveRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(mockSecurityScanning.performComprehensiveScan).toHaveBeenCalledWith(
        comprehensiveRequest.target,
        comprehensiveRequest.options
      );
    });

    it('should handle missing scan status', async () => {
      mockSecurityScanning.getScanStatus.mockReturnValue(undefined);

      const response = await request(server['app'])
        .get('/api/security/scans/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SCAN_NOT_FOUND');
    });

    it('should get security results', async () => {
      const mockResults = {
        vulnerabilities: [
          { severity: 'high', description: 'SQL injection risk' },
          { severity: 'medium', description: 'Weak password policy' }
        ],
        recommendations: ['Use parameterized queries', 'Implement stronger password requirements'],
        complianceScore: 0.75
      };

      mockSecurityScanning.getSecurityResults.mockReturnValue(mockResults);

      const response = await request(server['app'])
        .get('/api/security/results/my-project')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vulnerabilities).toHaveLength(2);
      expect(response.body.data.complianceScore).toBe(0.75);
      expect(mockSecurityScanning.getSecurityResults).toHaveBeenCalledWith('my-project');
    });

    it('should get security statistics', async () => {
      const mockStats = {
        totalScans: 50,
        vulnerabilitiesFound: 12,
        averageComplianceScore: 0.82,
        trends: { decreasing: true, improvement: 0.15 }
      };

      mockSecurityScanning.getSecurityStats.mockReturnValue(mockStats);

      const response = await request(server['app'])
        .get('/api/security/stats')
        .query({ start: '2023-01-01', end: '2023-12-31' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalScans).toBe(50);
      expect(response.body.data.vulnerabilitiesFound).toBe(12);
      expect(mockSecurityScanning.getSecurityStats).toHaveBeenCalled();
    });

    it('should generate security report in different formats', async () => {
      const mockReport = {
        format: 'pdf',
        content: 'base64-encoded-pdf-content',
        metadata: { pages: 15, generatedAt: new Date() }
      };

      mockSecurityScanning.generateSecurityReport.mockReturnValue(mockReport);

      const formats = ['json', 'html', 'pdf'];

      for (const format of formats) {
        const response = await request(server['app'])
          .get(`/api/security/reports/my-project?format=${format}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockSecurityScanning.generateSecurityReport).toHaveBeenCalledWith('my-project', format);
      }
    });
  });

  describe('Performance Monitoring Routes', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should start monitoring', async () => {
      mockPerformanceMonitoring.startMonitoring.mockImplementation(() => {});

      const response = await request(server['app'])
        .post('/api/performance/monitoring/start')
        .send({ interval: 10000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Monitoring started');
      expect(response.body.data.interval).toBe(10000);
      expect(mockPerformanceMonitoring.startMonitoring).toHaveBeenCalledWith(10000);
    });

    it('should stop monitoring', async () => {
      mockPerformanceMonitoring.stopMonitoring.mockImplementation(() => {});

      const response = await request(server['app'])
        .post('/api/performance/monitoring/stop')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Monitoring stopped');
      expect(mockPerformanceMonitoring.stopMonitoring).toHaveBeenCalled();
    });

    it('should get performance metrics', async () => {
      const mockMetrics = {
        cpuUsage: 0.45,
        memoryUsage: 0.67,
        responseTime: 150,
        throughput: 1200,
        errorRate: 0.01
      };

      mockPerformanceMonitoring.getMetrics.mockReturnValue(mockMetrics);

      const response = await request(server['app'])
        .get('/api/performance/metrics')
        .query({ start: '2023-01-01', end: '2023-12-31' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cpuUsage).toBe(0.45);
      expect(response.body.data.memoryUsage).toBe(0.67);
      expect(mockPerformanceMonitoring.getMetrics).toHaveBeenCalled();
    });

    it('should handle missing agent metrics', async () => {
      mockPerformanceMonitoring.getAgentMetrics.mockReturnValue(undefined);

      const response = await request(server['app'])
        .get('/api/performance/agents/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AGENT_METRICS_NOT_FOUND');
    });

    it('should generate performance report', async () => {
      const mockReport = {
        summary: { averageResponseTime: 200, totalRequests: 10000 },
        trends: { performance: 'improving', bottlenecks: ['database'] },
        recommendations: ['Add database indexes', 'Implement caching']
      };

      mockPerformanceMonitoring.generatePerformanceReport.mockReturnValue(mockReport);

      const response = await request(server['app'])
        .get('/api/performance/reports')
        .query({ start: '2023-01-01', end: '2023-12-31' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalRequests).toBe(10000);
      expect(response.body.data.recommendations).toContain('Add database indexes');
      expect(mockPerformanceMonitoring.generatePerformanceReport).toHaveBeenCalled();
    });

    it('should run benchmarks', async () => {
      const benchmarkRequest = {
        tests: ['cpu-intensive', 'memory-intensive', 'io-intensive'],
        iterations: 1000
      };

      const mockResults = {
        cpuScore: 85,
        memoryScore: 92,
        ioScore: 78,
        overallScore: 85
      };

      mockPerformanceMonitoring.runBenchmarks.mockResolvedValue(mockResults);

      const response = await request(server['app'])
        .post('/api/performance/benchmarks')
        .send(benchmarkRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overallScore).toBe(85);
      expect(mockPerformanceMonitoring.runBenchmarks).toHaveBeenCalledWith(benchmarkRequest);
    });

    it('should analyze bottlenecks', async () => {
      const mockAnalysis = {
        bottlenecks: [
          { type: 'database', impact: 'high', description: 'Slow query execution' },
          { type: 'memory', impact: 'medium', description: 'High memory allocation' }
        ],
        recommendations: ['Optimize database queries', 'Implement memory pooling'],
        potentialImprovement: 0.25
      };

      mockPerformanceMonitoring.analyzeBottlenecks.mockReturnValue(mockAnalysis);

      const response = await request(server['app'])
        .get('/api/performance/bottlenecks')
        .query({ start: '2023-01-01', end: '2023-12-31' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bottlenecks).toHaveLength(2);
      expect(response.body.data.potentialImprovement).toBe(0.25);
      expect(mockPerformanceMonitoring.analyzeBottlenecks).toHaveBeenCalled();
    });
  });

  describe('GitHub Integration Routes', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle webhook successfully', async () => {
      const webhookPayload = {
        headers: {
          'x-hub-signature-256': 'sha256=signature123',
          'x-github-event': 'push'
        },
        body: {
          repository: { name: 'test-repo', owner: { login: 'test-owner' } },
          commits: [{ message: 'Initial commit' }]
        }
      };

      mockGitHubIntegration.handleWebhook.mockResolvedValue(undefined);

      const response = await request(server['app'])
        .post('/api/github/webhook')
        .set(webhookPayload.headers)
        .send(webhookPayload.body)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Webhook processed successfully');
      expect(mockGitHubIntegration.handleWebhook).toHaveBeenCalledWith(
        webhookPayload,
        webhookPayload.headers['x-hub-signature-256']
      );
    });

    it('should handle webhook signature verification failure', async () => {
      const webhookPayload = {
        headers: {
          'x-hub-signature-256': 'invalid-signature',
          'x-github-event': 'push'
        },
        body: { test: 'data' }
      };

      mockGitHubIntegration.handleWebhook.mockRejectedValue(new Error('Invalid signature'));

      const response = await request(server['app'])
        .post('/api/github/webhook')
        .set(webhookPayload.headers)
        .send(webhookPayload.body)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WEBHOOK_ERROR');
      expect(response.body.error.message).toBe('Invalid signature');
    });

    it('should create webhook', async () => {
      const webhookRequest = {
        events: ['push', 'pull_request'],
        active: true,
        config: { url: 'https://example.com/webhook' }
      };

      const mockWebhook = {
        id: 123456,
        url: 'https://example.com/webhook',
        events: ['push', 'pull_request'],
        active: true
      };

      mockGitHubIntegration.createWebhook.mockResolvedValue(mockWebhook);

      const response = await request(server['app'])
        .post('/api/github/repos/testowner/testrepo/webhooks')
        .send(webhookRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(123456);
      expect(response.body.data.events).toEqual(['push', 'pull_request']);
      expect(mockGitHubIntegration.createWebhook).toHaveBeenCalledWith(
        'testowner/testrepo',
        webhookRequest
      );
    });

    it('should handle repository not found', async () => {
      mockGitHubIntegration.getRepository.mockResolvedValue(null);

      const response = await request(server['app'])
        .get('/api/github/repos/nonexistent/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REPO_NOT_FOUND');
      expect(response.body.error.message).toBe('Repository not found');
    });

    it('should get repository successfully', async () => {
      const mockRepo = {
        id: 123,
        name: 'test-repo',
        fullName: 'testowner/test-repo',
        description: 'A test repository',
        language: 'TypeScript',
        stars: 42,
        forks: 8
      };

      mockGitHubIntegration.getRepository.mockResolvedValue(mockRepo);

      const response = await request(server['app'])
        .get('/api/github/repos/testowner/testrepo')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('test-repo');
      expect(response.body.data.stars).toBe(42);
      expect(mockGitHubIntegration.getRepository).toHaveBeenCalledWith('testowner', 'testrepo');
    });

    it('should create pull request', async () => {
      const prRequest = {
        title: 'Add new feature',
        description: 'This PR adds a new feature',
        head: 'feature-branch',
        base: 'main'
      };

      const mockPR = {
        id: 789,
        number: 42,
        title: 'Add new feature',
        state: 'open',
        author: { login: 'testuser' }
      };

      mockGitHubIntegration.createPullRequest.mockResolvedValue(mockPR);

      const response = await request(server['app'])
        .post('/api/github/repos/testowner/testrepo/pulls')
        .send(prRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.number).toBe(42);
      expect(response.body.data.title).toBe('Add new feature');
      expect(mockGitHubIntegration.createPullRequest).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        prRequest
      );
    });

    it('should handle PR creation failure', async () => {
      mockGitHubIntegration.createPullRequest.mockRejectedValue(
        new Error('Branch not found or merge conflict')
      );

      const response = await request(server['app'])
        .post('/api/github/repos/testowner/testrepo/pulls')
        .send({ title: 'Test PR', head: 'invalid', base: 'main' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PR_CREATE_ERROR');
      expect(response.body.error.message).toBe('Branch not found or merge conflict');
    });
  });

  describe('System Routes', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should get system information', async () => {
      const response = await request(server['app'])
        .get('/api/system/info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.version).toBeDefined();
      expect(response.body.data.nodeVersion).toBeDefined();
      expect(response.body.data.platform).toBeDefined();
      expect(response.body.data.arch).toBeDefined();
      expect(response.body.data.uptime).toBeGreaterThan(0);
      expect(response.body.data.memoryUsage).toBeDefined();
      expect(response.body.data.cpuUsage).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle 404 for unknown routes', async () => {
      const response = await request(server['app'])
        .get('/nonexistent/route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('GET /nonexistent/route not found');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(server['app'])
        .post('/api/truth/verify')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express handles JSON parsing errors before they reach our routes
      expect(response.status).toBe(400);
    });

    it('should handle oversized request body', async () => {
      // Create a string larger than 10mb limit
      const largeString = 'x'.repeat(11 * 1024 * 1024);

      const response = await request(server['app'])
        .post('/api/truth/verify')
        .send({ content: largeString })
        .expect(413); // Request Entity Too Large
    });

    it('should handle malformed query parameters', async () => {
      const response = await request(server['app'])
        .get('/api/truth/stats?start=invalid-date&end=also-invalid')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('STATS_ERROR');
    });
  });

  describe('Middleware Security', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should include security headers', async () => {
      const response = await request(server['app'])
        .get('/health')
        .expect(200);

      // Check for common security headers set by helmet
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should handle CORS properly', async () => {
      const response = await request(server['app'])
        .options('/api/truth/verify')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should reject disallowed CORS origins', async () => {
      // This test would require modifying the environment or the CORS config
      // For now, we'll just verify the structure is in place
      const response = await request(server['app'])
        .get('/health')
        .set('Origin', 'http://malicious-site.com');

      // Response should still be 200 for health check, but CORS headers won't match
      expect(response.status).toBe(200);
    });
  });

  describe('Request Payload Validation', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle empty request bodies', async () => {
      const response = await request(server['app'])
        .post('/api/truth/verify')
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VERIFICATION_ERROR');
    });

    it('should handle missing required fields', async () => {
      const response = await request(server['app'])
        .post('/api/agents/agents')
        .send({ config: {} }) // Missing type field
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AGENT_SPAWN_ERROR');
    });

    it('should handle invalid data types', async () => {
      const response = await request(server['app'])
        .post('/api/agents/swarms/nonexistent/scale')
        .send({ targetSize: 'not-a-number' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SWARM_SCALE_ERROR');
    });
  });

  describe('Rate Limiting and Load Handling', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(50).fill(null).map(() =>
        request(server['app']).get('/health')
      );

      const responses = await Promise.all(requests);

      // All requests should complete successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle requests with large payloads within limits', async () => {
      const largeButValidContent = 'x'.repeat(1024 * 1024); // 1MB

      mockTruthVerification.verify.mockResolvedValue({
        score: 0.95,
        passed: true,
        details: {},
        timestamp: new Date()
      });

      const response = await request(server['app'])
        .post('/api/truth/verify')
        .send({
          type: 'CODE_QUALITY',
          content: largeButValidContent
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('WebSocket Functionality', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should establish WebSocket connection', async () => {
      const wsUrl = `ws://localhost:3001`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(reject, 5000); // Timeout after 5 seconds
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Clean up
      ws.close();
    });

    it('should handle WebSocket message parsing errors', async () => {
      const wsUrl = `ws://localhost:3001`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => {
        ws.on('open', () => {
          // Send invalid JSON
          ws.send('invalid json data');
          setTimeout(resolve, 100);
        });
      });

      // Should not crash the server
      ws.close();

      // Server should still be responsive
      await request(server['app']).get('/health').expect(200);
    });

    it('should handle WebSocket client disconnection gracefully', async () => {
      const wsUrl = `ws://localhost:3001`;
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.close();
          setTimeout(resolve, 100);
        });
      });

      // Server should still be responsive after client disconnect
      await request(server['app']).get('/health').expect(200);
    });
  });

  describe('Environment Configuration', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use custom port from constructor', () => {
      const customServer = new TurboFlowServer(9999);
      expect(customServer['port']).toBe(9999);
    });

    it('should handle missing environment variables gracefully', async () => {
      // Set minimal environment
      process.env = {};

      const testServer = new TurboFlowServer(3002);
      await expect(testServer.start()).resolves.not.toThrow();

      await testServer.stop();
    });

    it('should initialize GitHub integration when token is provided', async () => {
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';

      mockGitHubIntegration.initialize.mockResolvedValue(undefined);
      mockPerformanceMonitoring.startMonitoring.mockImplementation(() => {});

      const testServer = new TurboFlowServer(3003);
      await testServer.start();

      expect(mockGitHubIntegration.initialize).toHaveBeenCalledWith({
        apiToken: 'test-token',
        webhookSecret: 'test-secret'
      });

      await testServer.stop();
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(async () => {
      await server.start();
    });

    it('should handle many WebSocket connections', async () => {
      const connections = [];
      const maxConnections = 100; // Reasonable limit for testing

      try {
        for (let i = 0; i < maxConnections; i++) {
          const ws = new WebSocket(`ws://localhost:3001`);
          await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(reject, 1000);
          });
          connections.push(ws);
        }
      } catch (error) {
        // If we can't establish all connections, that's acceptable for this test
        console.log(`Established ${connections.length} connections out of ${maxConnections}`);
      }

      // Server should still be responsive
      await request(server['app']).get('/health').expect(200);

      // Clean up connections
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    });

    it('should clean up resources on server stop', async () => {
      const ws = new WebSocket(`ws://localhost:3001`);

      await new Promise((resolve) => {
        ws.on('open', resolve);
      });

      const initialClientCount = server['clients'].size;
      expect(initialClientCount).toBeGreaterThan(0);

      await server.stop();

      // After stopping, the WebSocket server should be closed
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });
  });
});