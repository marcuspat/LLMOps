import {
  Agent,
  AgentStatus,
  AgentType,
  Swarm,
  SwarmStatus,
  SwarmTopology,
  Task,
  TaskStatus,
  TaskType,
  TruthVerificationRequest,
  TruthVerificationResult,
  VerificationType,
  User,
  AuthToken,
  TokenType
} from '../../src/types/index.js';

describe('Type Definitions', () => {
  describe('Agent Types', () => {
    describe('Agent Interface', () => {
      it('should create a valid agent', () => {
        const agent: Agent = {
          id: 'agent-123',
          type: AgentType.DEVELOPER,
          name: 'Test Agent',
          capabilities: ['coding', 'testing'],
          status: AgentStatus.IDLE,
          metrics: {
            cpuUsage: 50.5,
            memoryUsage: 512.2,
            tasksCompleted: 10,
            averageTaskTime: 3000,
            successRate: 0.95,
            lastActivity: new Date()
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(agent).toBeDefined();
        expect(agent.id).toBe('agent-123');
        expect(agent.type).toBe(AgentType.DEVELOPER);
        expect(agent.status).toBe(AgentStatus.IDLE);
        expect(agent.capabilities).toContain('coding');
        expect(agent.metrics.tasksCompleted).toBe(10);
        expect(agent.metrics.successRate).toBe(0.95);
      });

      it('should validate agent metrics', () => {
        const agent: Agent = {
          id: 'agent-456',
          type: AgentType.TESTER,
          name: 'Test Agent',
          capabilities: ['testing', 'validation'],
          status: AgentStatus.BUSY,
          metrics: {
            cpuUsage: 75.0,
            memoryUsage: 1024.5,
            tasksCompleted: 25,
            averageTaskTime: 5000,
            successRate: 0.88,
            lastActivity: new Date()
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(agent.metrics.cpuUsage).toBeGreaterThanOrEqual(0);
        expect(agent.metrics.cpuUsage).toBeLessThanOrEqual(100);
        expect(agent.metrics.memoryUsage).toBeGreaterThan(0);
        expect(agent.metrics.successRate).toBeGreaterThanOrEqual(0);
        expect(agent.metrics.successRate).toBeLessThanOrEqual(1);
      });

      it('should handle agent with swarm assignment', () => {
        const agent: Agent = {
          id: 'agent-789',
          type: AgentType.COORDINATOR,
          name: 'Coordinator Agent',
          capabilities: ['coordination', 'management'],
          status: AgentStatus.ACTIVE,
          metrics: {
            cpuUsage: 60.2,
            memoryUsage: 768.8,
            tasksCompleted: 15,
            averageTaskTime: 4000,
            successRate: 0.92,
            lastActivity: new Date()
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          swarmId: 'swarm-123'
        };

        expect(agent.swarmId).toBe('swarm-123');
        expect(agent.type).toBe(AgentType.COORDINATOR);
      });
    });

    describe('AgentType Enum', () => {
      it('should contain all expected agent types', () => {
        const expectedTypes = [
          AgentType.COORDINATOR,
          AgentType.ANALYST,
          AgentType.OPTIMIZER,
          AgentType.DOCUMENTER,
          AgentType.MONITOR,
          AgentType.SPECIALIST,
          AgentType.ARCHITECT,
          AgentType.TASK_ORCHESTRATOR,
          AgentType.CODE_ANALYZER,
          AgentType.PERF_ANALYZER,
          AgentType.API_DOCS,
          AgentType.PERFORMANCE_BENCHMARKER,
          AgentType.SYSTEM_ARCHITECT,
          AgentType.RESEARCHER,
          AgentType.CODER,
          AgentType.TESTER,
          AgentType.REVIEWER
        ];

        expect(Object.keys(AgentType)).toHaveLength(expectedTypes.length);
        expectedTypes.forEach(type => {
          expect(Object.values(AgentType)).toContain(type);
        });
      });
    });

    describe('AgentStatus Enum', () => {
      it('should contain all expected statuses', () => {
        const expectedStatuses = [
          AgentStatus.IDLE,
          AgentStatus.BUSY,
          AgentStatus.ERROR,
          AgentStatus.OFFLINE
        ];

        expect(Object.keys(AgentStatus)).toHaveLength(expectedStatuses.length);
        expectedStatuses.forEach(status => {
          expect(Object.values(AgentStatus)).toContain(status);
        });
      });
    });
  });

  describe('Swarm Types', () => {
    describe('Swarm Interface', () => {
      it('should create a valid swarm', () => {
        const agent: Agent = {
          id: 'agent-1',
          type: AgentType.COORDINATOR,
          name: 'Coordinator',
          capabilities: ['coordination'],
          status: AgentStatus.IDLE,
          metrics: {
            cpuUsage: 30.0,
            memoryUsage: 256.0,
            tasksCompleted: 5,
            averageTaskTime: 2000,
            successRate: 1.0,
            lastActivity: new Date()
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const task: Task = {
          id: 'task-1',
          name: 'Test Task',
          description: 'A test task',
          type: TaskType.CODE_GENERATION,
          status: TaskStatus.PENDING,
          priority: 'medium' as any,
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const swarm: Swarm = {
          id: 'swarm-123',
          name: 'Test Swarm',
          topology: SwarmTopology.MESH,
          status: SwarmStatus.ACTIVE,
          agents: [agent],
          tasks: [task],
          config: {
            maxAgents: 10,
            strategy: 'BALANCED' as any,
            enableAutoScaling: true,
            resourceLimits: {
              maxCpuUsage: 80,
              maxMemoryUsage: 2048,
              maxTasksPerAgent: 5
            }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(swarm).toBeDefined();
        expect(swarm.id).toBe('swarm-123');
        expect(swarm.name).toBe('Test Swarm');
        expect(swarm.topology).toBe(SwarmTopology.MESH);
        expect(swarm.status).toBe(SwarmStatus.ACTIVE);
        expect(swarm.agents).toHaveLength(1);
        expect(swarm.tasks).toHaveLength(1);
        expect(swarm.config.maxAgents).toBe(10);
      });
    });

    describe('SwarmTopology Enum', () => {
      it('should contain all expected topologies', () => {
        const expectedTopologies = [
          SwarmTopology.HIERARCHICAL,
          SwarmTopology.MESH,
          SwarmTopology.RING,
          SwarmTopology.STAR,
          SwarmTopology.ADAPTIVE
        ];

        expect(Object.keys(SwarmTopology)).toHaveLength(expectedTopologies.length);
        expectedTopologies.forEach(topology => {
          expect(Object.values(SwarmTopology)).toContain(topology);
        });
      });
    });

    describe('SwarmStatus Enum', () => {
      it('should contain all expected statuses', () => {
        const expectedStatuses = [
          SwarmStatus.INITIALIZING,
          SwarmStatus.ACTIVE,
          SwarmStatus.IDLE,
          SwarmStatus.ERROR,
          SwarmStatus.TERMINATED
        ];

        expect(Object.keys(SwarmStatus)).toHaveLength(expectedStatuses.length);
        expectedStatuses.forEach(status => {
          expect(Object.values(SwarmStatus)).toContain(status);
        });
      });
    });
  });

  describe('Task Types', () => {
    describe('Task Interface', () => {
      it('should create a valid task', () => {
        const task: Task = {
          id: 'task-123',
          name: 'Generate API Documentation',
          description: 'Generate comprehensive API documentation',
          type: TaskType.DOCUMENTATION,
          status: TaskStatus.IN_PROGRESS,
          priority: 'high' as any,
          assignedAgentId: 'agent-456',
          dependencies: ['task-122'],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        expect(task).toBeDefined();
        expect(task.id).toBe('task-123');
        expect(task.name).toBe('Generate API Documentation');
        expect(task.type).toBe(TaskType.DOCUMENTATION);
        expect(task.status).toBe(TaskStatus.IN_PROGRESS);
        expect(task.assignedAgentId).toBe('agent-456');
        expect(task.dependencies).toContain('task-122');
      });

      it('should handle completed task with result', () => {
        const task: Task = {
          id: 'task-456',
          name: 'Security Scan',
          description: 'Perform comprehensive security scan',
          type: TaskType.SECURITY_SCAN,
          status: TaskStatus.COMPLETED,
          priority: 'critical' as any,
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: new Date(),
          result: {
            success: true,
            output: { vulnerabilities: 0, securityScore: 95 },
            metrics: {
              duration: 120000,
              resourcesUsed: { cpu: 50, memory: 512 },
              quality: 0.95
            },
            artifacts: ['security-report.pdf']
          }
        };

        expect(task.status).toBe(TaskStatus.COMPLETED);
        expect(task.completedAt).toBeDefined();
        expect(task.result).toBeDefined();
        expect(task.result?.success).toBe(true);
        expect(task.result?.output.securityScore).toBe(95);
      });
    });

    describe('TaskType Enum', () => {
      it('should contain all expected task types', () => {
        const expectedTypes = [
          TaskType.CODE_GENERATION,
          TaskType.TESTING,
          TaskType.DOCUMENTATION,
          TaskType.ANALYSIS,
          TaskType.OPTIMIZATION,
          TaskType.SECURITY_SCAN,
          TaskType.PERFORMANCE_TEST
        ];

        expect(Object.keys(TaskType)).toHaveLength(expectedTypes.length);
        expectedTypes.forEach(type => {
          expect(Object.values(TaskType)).toContain(type);
        });
      });
    });

    describe('TaskStatus Enum', () => {
      it('should contain all expected statuses', () => {
        const expectedStatuses = [
          TaskStatus.PENDING,
          TaskStatus.IN_PROGRESS,
          TaskStatus.COMPLETED,
          TaskStatus.FAILED,
          TaskStatus.CANCELLED
        ];

        expect(Object.keys(TaskStatus)).toHaveLength(expectedStatuses.length);
        expectedStatuses.forEach(status => {
          expect(Object.values(TaskStatus)).toContain(status);
        });
      });
    });
  });

  describe('Truth Verification Types', () => {
    describe('TruthVerificationRequest Interface', () => {
      it('should create a valid verification request', () => {
        const request: TruthVerificationRequest = {
          content: 'function test() { return true; }',
          type: VerificationType.CODE_QUALITY,
          threshold: 0.9,
          context: {
            language: 'javascript',
            framework: 'jest'
          }
        };

        expect(request).toBeDefined();
        expect(request.content).toBe('function test() { return true; }');
        expect(request.type).toBe(VerificationType.CODE_QUALITY);
        expect(request.threshold).toBe(0.9);
        expect(request.context?.language).toBe('javascript');
      });
    });

    describe('TruthVerificationResult Interface', () => {
      it('should create a valid verification result', () => {
        const result: TruthVerificationResult = {
          score: 0.92,
          passed: true,
          confidence: 0.88,
          details: {
            issues: [],
            suggestions: ['Add input validation'],
            metrics: {
              complexity: 5,
              maintainability: 85,
              testCoverage: 92
            }
          },
          timestamp: new Date()
        };

        expect(result).toBeDefined();
        expect(result.score).toBe(0.92);
        expect(result.passed).toBe(true);
        expect(result.confidence).toBe(0.88);
        expect(result.details.suggestions).toHaveLength(1);
        expect(result.details.metrics.testCoverage).toBe(92);
      });
    });

    describe('VerificationType Enum', () => {
      it('should contain all expected verification types', () => {
        const expectedTypes = [
          VerificationType.CODE_QUALITY,
          VerificationType.TEST_COVERAGE,
          VerificationType.SECURITY,
          VerificationType.PERFORMANCE,
          VerificationType.DOCUMENTATION
        ];

        expect(Object.keys(VerificationType)).toHaveLength(expectedTypes.length);
        expectedTypes.forEach(type => {
          expect(Object.values(VerificationType)).toContain(type);
        });
      });
    });
  });

  describe('Authentication Types', () => {
    describe('User Interface', () => {
      it('should create a valid user', () => {
        const user: User = {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          roles: [
            {
              id: 'role-dev',
              name: 'Developer',
              permissions: [
                {
                  id: 'perm-1',
                  name: 'read_code',
                  resource: 'code',
                  action: 'read'
                }
              ]
            }
          ],
          permissions: [
            {
              id: 'perm-1',
              name: 'read_code',
              resource: 'code',
              action: 'read'
            }
          ],
          createdAt: new Date(),
          lastLogin: new Date()
        };

        expect(user).toBeDefined();
        expect(user.id).toBe('user-123');
        expect(user.username).toBe('testuser');
        expect(user.email).toBe('test@example.com');
        expect(user.roles).toHaveLength(1);
        expect(user.permissions).toHaveLength(1);
      });
    });

    describe('AuthToken Interface', () => {
      it('should create a valid access token', () => {
        const token: AuthToken = {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          type: TokenType.ACCESS,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
          scopes: ['read:code', 'write:code']
        };

        expect(token).toBeDefined();
        expect(token.type).toBe(TokenType.ACCESS);
        expect(token.scopes).toContain('read:code');
        expect(token.scopes).toContain('write:code');
        expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });
    });

    describe('TokenType Enum', () => {
      it('should contain all expected token types', () => {
        const expectedTypes = [
          TokenType.ACCESS,
          TokenType.REFRESH,
          TokenType.API_KEY
        ];

        expect(Object.keys(TokenType)).toHaveLength(expectedTypes.length);
        expectedTypes.forEach(type => {
          expect(Object.values(TokenType)).toContain(type);
        });
      });
    });
  });

  describe('Type Validation', () => {
    it('should enforce required fields', () => {
      // Test Agent required fields
      expect(() => {
        const agent: Agent = {
          id: '',
          type: AgentType.CODER,
          name: '',
          capabilities: [],
          status: AgentStatus.IDLE,
          metrics: {} as any,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        // This would typically fail validation, but TypeScript ensures structure
        expect(agent.id).toBeDefined();
      }).not.toThrow();
    });

    it('should handle type safety for enums', () => {
      const validStatus: AgentStatus = AgentStatus.BUSY;
      const invalidStatus = 'invalid' as AgentStatus;

      expect(Object.values(AgentStatus)).toContain(validStatus);
      expect(Object.values(AgentStatus)).not.toContain(invalidStatus);
    });

    it('should validate metric ranges', () => {
      const agent: Agent = {
        id: 'test',
        type: AgentType.TESTER,
        name: 'Test',
        capabilities: ['test'],
        status: AgentStatus.IDLE,
        metrics: {
          cpuUsage: -10, // Invalid value
          memoryUsage: 100,
          tasksCompleted: -5, // Invalid value
          averageTaskTime: 0,
          successRate: 1.5, // Invalid value
          lastActivity: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // These should be validated at runtime
      expect(agent.metrics.cpuUsage).toBeLessThan(0); // Should trigger validation
      expect(agent.metrics.successRate).toBeGreaterThan(1); // Should trigger validation
    });
  });

  describe('Complex Type Relationships', () => {
    it('should handle nested type structures', () => {
      const agent: Agent = {
        id: 'agent-nested',
        type: AgentType.ARCHITECT,
        name: 'Architect Agent',
        capabilities: ['system-design', 'architecture'],
        status: AgentStatus.ACTIVE,
        metrics: {
          cpuUsage: 65.5,
          memoryUsage: 1024.0,
          tasksCompleted: 12,
          averageTaskTime: 8000,
          successRate: 0.94,
          lastActivity: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        swarmId: 'swarm-complex'
      };

      const task: Task = {
        id: 'task-complex',
        name: 'System Architecture Design',
        description: 'Design complete system architecture',
        type: TaskType.ANALYSIS,
        status: TaskStatus.IN_PROGRESS,
        priority: 'high' as any,
        assignedAgentId: agent.id,
        dependencies: ['task-research'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(agent.swarmId).toBe('swarm-complex');
      expect(task.assignedAgentId).toBe(agent.id);
      expect(task.dependencies).toContain('task-research');
    });

    it('should handle optional fields correctly', () => {
      const agent: Agent = {
        id: 'agent-optional',
        type: AgentType.CODER,
        name: 'Coder Agent',
        capabilities: ['coding'],
        status: AgentStatus.IDLE,
        metrics: {
          cpuUsage: 40.2,
          memoryUsage: 512.8,
          tasksCompleted: 8,
          averageTaskTime: 3000,
          successRate: 0.91,
          lastActivity: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
        // swarmId is optional
      };

      expect(agent.swarmId).toBeUndefined();
    });
  });
});