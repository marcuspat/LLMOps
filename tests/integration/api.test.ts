import request from 'supertest';
import { TurboFlowServer } from '../../src/api/server.js';
import { TruthVerificationRequest, VerificationType } from '../../src/types/index.js';

describe('API Integration Tests', () => {
  let server: TurboFlowServer;
  let app: any;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

    // Initialize server with a different port for testing
    server = new TurboFlowServer(3001);
    app = server.getApp();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Health and System Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          uptime: expect.any(Number),
          version: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should return system information', async () => {
      const response = await request(app)
        .get('/api/system/info')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          version: expect.any(String),
          nodeVersion: expect.any(String),
          platform: expect.any(String),
          arch: expect.any(String),
          uptime: expect.any(Number),
          memoryUsage: expect.any(Object),
          cpuUsage: expect.any(Object)
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('Route GET /unknown-route not found')
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Truth Verification Endpoints', () => {
    describe('POST /api/truth/verify', () => {
      it('should verify code quality successfully', async () => {
        const verificationRequest: TruthVerificationRequest = {
          content: `
            function add(a: number, b: number): number {
              return a + b;
            }
          `,
          type: VerificationType.CODE_QUALITY,
          threshold: 0.8
        };

        const response = await request(app)
          .post('/api/truth/verify')
          .send(verificationRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            score: expect.any(Number),
            passed: expect.any(Boolean),
            confidence: expect.any(Number),
            details: {
              issues: expect.any(Array),
              suggestions: expect.any(Array),
              metrics: expect.any(Object)
            },
            timestamp: expect.any(Date)
          },
          timestamp: expect.any(String)
        });
      });

      it('should handle verification with missing content', async () => {
        const response = await request(app)
          .post('/api/truth/verify')
          .send({
            type: VerificationType.CODE_QUALITY
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'content and type are required'
          }
        });
      });

      it('should handle verification with invalid type', async () => {
        const response = await request(app)
          .post('/api/truth/verify')
          .send({
            content: 'some code',
            type: 'invalid_type'
          })
          .expect(500); // Will fail with validation error

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: expect.stringContaining('ERROR'),
            message: expect.any(String)
          }
        });
      });

      it('should verify test coverage', async () => {
        const verificationRequest: TruthVerificationRequest = {
          content: `
            describe('Math Utils', () => {
              it('should add two numbers', () => {
                expect(add(2, 3)).toBe(5);
              });

              it('should subtract two numbers', () => {
                expect(subtract(5, 3)).toBe(2);
              });
            });
          `,
          type: VerificationType.TEST_COVERAGE
        };

        const response = await request(app)
          .post('/api/truth/verify')
          .send(verificationRequest)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe('test_coverage');
      });

      it('should verify security', async () => {
        const verificationRequest: TruthVerificationRequest = {
          content: `
            function processInput(input: string): string {
              if (typeof input !== 'string') {
                throw new Error('Invalid input type');
              }
              return input.trim().toLowerCase();
            }
          `,
          type: VerificationType.SECURITY
        };

        const response = await request(app)
          .post('/api/truth/verify')
          .send(verificationRequest)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.details.metrics).toBeDefined();
      });
    });

    describe('POST /api/truth/verify-batch', () => {
      it('should verify multiple requests in batch', async () => {
        const batchRequest = {
          requests: [
            {
              content: 'function test1() { return true; }',
              type: VerificationType.CODE_QUALITY
            },
            {
              content: 'function test2() { return false; }',
              type: VerificationType.CODE_QUALITY
            },
            {
              content: 'describe("test", () => { expect(true).toBe(true); });',
              type: VerificationType.TEST_COVERAGE
            }
          ]
        };

        const response = await request(app)
          .post('/api/truth/verify-batch')
          .send(batchRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array),
          count: 3,
          timestamp: expect.any(String)
        });

        expect(response.body.data).toHaveLength(3);
        response.body.data.forEach((result: any) => {
          expect(result).toMatchObject({
            score: expect.any(Number),
            passed: expect.any(Boolean),
            timestamp: expect.any(Date)
          });
        });
      });

      it('should handle invalid batch request format', async () => {
        const response = await request(app)
          .post('/api/truth/verify-batch')
          .send({
            // Missing 'requests' array
            content: 'test'
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'requests must be an array'
          }
        });
      });

      it('should handle empty batch requests', async () => {
        const response = await request(app)
          .post('/api/truth/verify-batch')
          .send({ requests: [] })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: [],
          count: 0
        });
      });
    });

    describe('GET /api/truth/stats', () => {
      it('should return verification statistics', async () => {
        const response = await request(app)
          .get('/api/truth/stats')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            totalVerifications: expect.any(Number),
            averageScore: expect.any(Number),
            passRate: expect.any(Number),
            commonIssues: expect.any(Array),
            scoreTrend: expect.any(Array)
          },
          timestamp: expect.any(String)
        });
      });

      it('should return stats with time range filter', async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const response = await request(app)
          .get(`/api/truth/stats?start=${yesterday.toISOString()}&end=${now.toISOString()}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should handle invalid time range parameters', async () => {
        const response = await request(app)
          .get('/api/truth/stats?start=invalid-date')
          .expect(500);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: expect.stringContaining('ERROR'),
            message: expect.any(String)
          }
        });
      });
    });

    describe('GET /api/truth/types', () => {
      it('should return available verification types', async () => {
        const response = await request(app)
          .get('/api/truth/types')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array),
          count: expect.any(Number),
          timestamp: expect.any(String)
        });

        expect(response.body.data).toContain('code_quality');
        expect(response.body.data).toContain('test_coverage');
        expect(response.body.data).toContain('security');
        expect(response.body.data).toContain('performance');
        expect(response.body.data).toContain('documentation');
      });
    });
  });

  describe('Agent Coordination Endpoints', () => {
    describe('POST /api/agents/swarms', () => {
      it('should create a new swarm', async () => {
        const swarmConfig = {
          name: 'Test Swarm',
          topology: 'mesh',
          maxAgents: 5,
          strategy: 'balanced'
        };

        const response = await request(app)
          .post('/api/agents/swarms')
          .send(swarmConfig)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: expect.any(String),
            name: 'Test Swarm',
            topology: 'mesh',
            status: expect.any(String),
            agents: expect.any(Array),
            tasks: expect.any(Array),
            config: expect.any(Object),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date)
          }
        });
      });

      it('should handle swarm creation with missing required fields', async () => {
        const response = await request(app)
          .post('/api/agents/swarms')
          .send({
            // Missing name and topology
            maxAgents: 5
          })
          .expect(500);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'SWARM_CREATE_ERROR',
            message: expect.any(String)
          }
        });
      });
    });

    describe('POST /api/agents', () => {
      it('should spawn a new agent', async () => {
        const agentRequest = {
          type: 'coder',
          config: {
            name: 'Test Coder Agent',
            capabilities: ['coding', 'development']
          }
        };

        const response = await request(app)
          .post('/api/agents')
          .send(agentRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: expect.any(String),
            type: 'coder',
            name: expect.any(String),
            capabilities: expect.any(Array),
            status: expect.any(String),
            metrics: expect.any(Object)
          }
        });
      });

      it('should handle agent spawning with invalid type', async () => {
        const response = await request(app)
          .post('/api/agents')
          .send({
            type: 'invalid_agent_type',
            config: {}
          })
          .expect(500);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'AGENT_SPAWN_ERROR',
            message: expect.any(String)
          }
        });
      });
    });

    describe('POST /api/agents/batch', () => {
      it('should spawn multiple agents in parallel', async () => {
        const batchRequest = {
          agents: [
            {
              type: 'coder',
              name: 'Coder Agent 1',
              capabilities: ['coding']
            },
            {
              type: 'tester',
              name: 'Tester Agent 1',
              capabilities: ['testing']
            },
            {
              type: 'documenter',
              name: 'Documenter Agent 1',
              capabilities: ['documentation']
            }
          ],
          options: {
            maxConcurrency: 2
          }
        };

        const response = await request(app)
          .post('/api/agents/batch')
          .send(batchRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array)
        });

        expect(response.body.data).toHaveLength(3);
        response.body.data.forEach((agent: any) => {
          expect(agent).toMatchObject({
            id: expect.any(String),
            type: expect.any(String),
            name: expect.any(String),
            status: expect.any(String)
          });
        });
      });

      it('should handle empty batch request', async () => {
        const response = await request(app)
          .post('/api/agents/batch')
          .send({ agents: [] })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: []
        });
      });
    });

    describe('GET /api/agents/status', () => {
      it('should return system status', async () => {
        const response = await request(app)
          .get('/api/agents/status')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Object),
          timestamp: expect.any(String)
        });

        const statusData = response.body.data;
        expect(statusData).toHaveProperty('totalAgents');
        expect(statusData).toHaveProperty('activeSwarms');
        expect(statusData).toHaveProperty('systemHealth');
      });
    });

    describe('GET /api/agents/:agentId/metrics', () => {
      it('should return 404 for non-existent agent', async () => {
        const response = await request(app)
          .get('/api/agents/non-existent-agent/metrics')
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: 'Agent not found'
          }
        });
      });
    });

    describe('POST /api/agents/swarms/:swarmId/scale', () => {
      it('should scale swarm successfully', async () => {
        // First create a swarm
        const swarmResponse = await request(app)
          .post('/api/agents/swarms')
          .send({
            name: 'Scalable Swarm',
            topology: 'mesh',
            maxAgents: 10
          });

        const swarmId = swarmResponse.body.data.id;

        // Then scale it
        const response = await request(app)
          .post(`/api/agents/swarms/${swarmId}/scale`)
          .send({ targetSize: 5 })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: 'Swarm scaled successfully'
          }
        });
      });

      it('should handle scaling non-existent swarm', async () => {
        const response = await request(app)
          .post('/api/agents/swarms/non-existent-swarm/scale')
          .send({ targetSize: 5 })
          .expect(500);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'SWARM_SCALE_ERROR',
            message: expect.any(String)
          }
        });
      });
    });

    describe('POST /api/agents/tasks', () => {
      it('should orchestrate task successfully', async () => {
        const taskRequest = {
          name: 'Test Task',
          description: 'A test task for orchestration',
          type: 'code_generation',
          priority: 'medium',
          assignToSwarm: 'default'
        };

        const response = await request(app)
          .post('/api/agents/tasks')
          .send(taskRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: 'Task orchestrated successfully'
          }
        });
      });

      it('should handle task orchestration with missing required fields', async () => {
        const response = await request(app)
          .post('/api/agents/tasks')
          .send({
            // Missing required fields
            name: 'Incomplete Task'
          })
          .expect(500);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'TASK_ORCHESTRATION_ERROR',
            message: expect.any(String)
          }
        });
      });
    });
  });

  describe('Security Endpoints', () => {
    describe('POST /api/security/scans', () => {
      it('should initiate security scan', async () => {
        const scanRequest = {
          type: 'comprehensive',
          target: 'test-repo',
          options: {
            depth: 'standard',
            includeDependencies: true
          }
        };

        const response = await request(app)
          .post('/api/security/scans')
          .send(scanRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: expect.any(String),
            type: 'comprehensive',
            target: 'test-repo',
            status: expect.any(String),
            createdAt: expect.any(Date)
          }
        });
      });

      it('should handle scan initiation with invalid type', async () => {
        const response = await request(app)
          .post('/api/security/scans')
          .send({
            type: 'invalid_scan_type',
            target: 'test-repo'
          })
          .expect(500);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'SCAN_INIT_ERROR',
            message: expect.any(String)
          }
        });
      });
    });

    describe('POST /api/security/scans/comprehensive', () => {
      it('should perform comprehensive security scan', async () => {
        const scanRequest = {
          target: 'test-project',
          options: {
            includeSAST: true,
            includeDAST: true,
            includeDependencyScan: true,
            depth: 'deep'
          }
        };

        const response = await request(app)
          .post('/api/security/scans/comprehensive')
          .send(scanRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array)
        });

        const scanResults = response.body.data;
        expect(scanResults).toHaveLength(3); // SAST, DAST, Dependency scans
        scanResults.forEach((scan: any) => {
          expect(scan).toMatchObject({
            id: expect.any(String),
            type: expect.any(String),
            target: 'test-project',
            status: expect.any(String)
          });
        });
      });
    });

    describe('GET /api/security/scans/:scanId', () => {
      it('should return 404 for non-existent scan', async () => {
        const response = await request(app)
          .get('/api/security/scans/non-existent-scan')
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'SCAN_NOT_FOUND',
            message: 'Scan not found'
          }
        });
      });
    });

    describe('GET /api/security/results/:target', () => {
      it('should return security results for target', async () => {
        const response = await request(app)
          .get('/api/security/results/test-target')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array)
        });

        const results = response.body.data;
        if (results.length > 0) {
          expect(results[0]).toMatchObject({
            severity: expect.any(String),
            type: expect.any(String),
            description: expect.any(String),
            recommendation: expect.any(String)
          });
        }
      });
    });

    describe('GET /api/security/stats', () => {
      it('should return security statistics', async () => {
        const response = await request(app)
          .get('/api/security/stats')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            totalScans: expect.any(Number),
            averageSeverity: expect.any(Number),
            commonVulnerabilities: expect.any(Array),
            scanTrends: expect.any(Array)
          },
          timestamp: expect.any(String)
        });
      });
    });

    describe('GET /api/security/reports/:target', () => {
      it('should generate security report in JSON format', async () => {
        const response = await request(app)
          .get('/api/security/reports/test-target?format=json')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Object)
        });

        const report = response.body.data;
        expect(report).toHaveProperty('target', 'test-target');
        expect(report).toHaveProperty('format', 'json');
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('findings');
      });

      it('should support HTML format reports', async () => {
        const response = await request(app)
          .get('/api/security/reports/test-target?format=html')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Object)
        });

        const report = response.body.data;
        expect(report.format).toBe('html');
      });
    });
  });

  describe('Performance Monitoring Endpoints', () => {
    describe('POST /api/performance/monitoring/start', () => {
      it('should start performance monitoring', async () => {
        const response = await request(app)
          .post('/api/performance/monitoring/start')
          .send({ interval: 3000 })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: 'Monitoring started',
            interval: 3000
          }
        });
      });

      it('should start monitoring with default interval', async () => {
        const response = await request(app)
          .post('/api/performance/monitoring/start')
          .send({})
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: 'Monitoring started',
            interval: 5000
          }
        });
      });
    });

    describe('POST /api/performance/monitoring/stop', () => {
      it('should stop performance monitoring', async () => {
        const response = await request(app)
          .post('/api/performance/monitoring/stop')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            message: 'Monitoring stopped'
          }
        });
      });
    });

    describe('GET /api/performance/metrics', () => {
      it('should return performance metrics', async () => {
        const response = await request(app)
          .get('/api/performance/metrics')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Object)
        });

        const metrics = response.body.data;
        expect(metrics).toHaveProperty('cpu');
        expect(metrics).toHaveProperty('memory');
        expect(metrics).toHaveProperty('timestamp');
      });

      it('should support time range filtering', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const response = await request(app)
          .get(`/api/performance/metrics?start=${oneHourAgo.toISOString()}&end=${now.toISOString()}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });

    describe('GET /api/performance/agents/:agentId', () => {
      it('should return 404 for non-existent agent metrics', async () => {
        const response = await request(app)
          .get('/api/performance/agents/non-existent-agent')
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'AGENT_METRICS_NOT_FOUND',
            message: 'Agent metrics not found'
          }
        });
      });
    });

    describe('GET /api/performance/reports', () => {
      it('should generate performance report', async () => {
        const response = await request(app)
          .get('/api/performance/reports')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Object)
        });

        const report = response.body.data;
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('metrics');
        expect(report).toHaveProperty('recommendations');
      });

      it('should support time range filtered reports', async () => {
        const response = await request(app)
          .get('/api/performance/reports?start=2023-01-01T00:00:00Z&end=2023-01-02T00:00:00Z')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });

    describe('POST /api/performance/benchmarks', () => {
      it('should run performance benchmarks', async () => {
        const benchmarkRequest = {
          suite: 'api-endpoints',
          iterations: 100,
          warmupIterations: 10
        };

        const response = await request(app)
          .post('/api/performance/benchmarks')
          .send(benchmarkRequest)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Array)
        });

        const results = response.body.data;
        expect(results).toHaveLength(1); // One benchmark suite
        expect(results[0]).toMatchObject({
          suite: 'api-endpoints',
          averageLatency: expect.any(Number),
          maxLatency: expect.any(Number),
          minLatency: expect.any(Number),
          throughput: expect.any(Number)
        });
      });
    });

    describe('GET /api/performance/bottlenecks', () => {
      it('should analyze bottlenecks', async () => {
        const response = await request(app)
          .get('/api/performance/bottlenecks')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.any(Object)
        });

        const analysis = response.body.data;
        expect(analysis).toHaveProperty('bottlenecks');
        expect(analysis).toHaveProperty('recommendations');
        expect(Array.isArray(analysis.bottlenecks)).toBe(true);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/truth/verify')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('Unexpected token')
      });
    });

    it('should handle oversized requests', async () => {
      // Create a large content string (assuming 10mb limit)
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post('/api/truth/verify')
        .send({
          content: largeContent,
          type: VerificationType.CODE_QUALITY
        })
        .expect(413); // Payload Too Large
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/truth/verify')
          .send({
            content: 'function test() { return true; }',
            type: VerificationType.CODE_QUALITY
          })
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle request timeout scenarios', async () => {
      // This would typically require a very slow operation
      const response = await request(app)
        .post('/api/performance/benchmarks')
        .send({
          suite: 'slow-endpoints',
          iterations: 10000
        })
        .timeout(5000); // 5 second timeout for the test

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/truth/verify')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should reject unauthorized origins', async () => {
      const response = await request(app)
        .post('/api/truth/verify')
        .set('Origin', 'http://malicious-site.com')
        .send({
          content: 'test code',
          type: VerificationType.CODE_QUALITY
        })
        .expect(403); // Forbidden for unauthorized origin
    });
  });

  describe('Request/Response Format Validation', () => {
    it('should include consistent response format', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // All successful responses should have these fields
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('timestamp');
      if (response.body.success) {
        expect(response.body).toHaveProperty('data');
      } else {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      }
    });

    it('should handle missing request ID', async () => {
      const response = await request(app)
        .post('/api/truth/verify')
        .send({
          content: 'test',
          type: VerificationType.CODE_QUALITY
        })
        .expect(200);

      // Server should assign a request ID
      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers['x-request-id']).toMatch(/^req-\d+-[a-z0-9]+$/);
    });

    it('should preserve custom request ID', async () => {
      const customRequestId = 'custom-request-id-123';

      const response = await request(app)
        .post('/api/truth/verify')
        .set('X-Request-ID', customRequestId)
        .send({
          content: 'test',
          type: VerificationType.CODE_QUALITY
        })
        .expect(200);

      expect(response.headers['x-request-id']).toBe(customRequestId);
    });
  });
});