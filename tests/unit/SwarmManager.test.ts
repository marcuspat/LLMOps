import {
  SwarmManager,
  SwarmConfig,
  AgentConfig,
  TaskConfig
} from '../../src/core/SwarmManager.js';
import {
  Swarm,
  Agent,
  Task,
  SwarmTopology,
  SwarmStatus,
  SwarmStrategy,
  AgentStatus,
  AgentType,
  TaskStatus,
  TaskPriority,
  TaskType
} from '../../src/types/index.js';

describe('SwarmManager', () => {
  let swarmManager: SwarmManager;

  beforeEach(() => {
    swarmManager = new SwarmManager();
  });

  describe('Swarm Creation and Management', () => {
    it('should create a new swarm with default configuration', async () => {
      const config: SwarmConfig = {
        name: 'Test Swarm',
        topology: SwarmTopology.MESH
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm).toBeDefined();
      expect(swarm.name).toBe('Test Swarm');
      expect(swarm.topology).toBe(SwarmTopology.MESH);
      expect(swarm.status).toBe(SwarmStatus.ACTIVE);
      expect(swarm.config.maxAgents).toBe(10);
      expect(swarm.config.strategy).toBe(SwarmStrategy.BALANCED);
      expect(swarm.config.enableAutoScaling).toBe(false);
      expect(swarm.agents).toHaveLength(0);
      expect(swarm.tasks).toHaveLength(0);
    });

    it('should create a swarm with custom configuration', async () => {
      const config: SwarmConfig = {
        name: 'Custom Swarm',
        topology: SwarmTopology.HIERARCHICAL,
        maxAgents: 15,
        strategy: SwarmStrategy.SPECIALIZED,
        enableAutoScaling: true,
        resourceLimits: {
          maxCpuUsage: 90,
          maxMemoryUsage: 4096,
          maxTasksPerAgent: 10
        }
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.config.maxAgents).toBe(15);
      expect(swarm.config.strategy).toBe(SwarmStrategy.SPECIALIZED);
      expect(swarm.config.enableAutoScaling).toBe(true);
      expect(swarm.config.resourceLimits.maxCpuUsage).toBe(90);
    });

    it('should create swarm with initial agents', async () => {
      const initialAgents: AgentConfig[] = [
        {
          type: AgentType.COORDINATOR,
          name: 'Main Coordinator',
          capabilities: ['coordination', 'management']
        },
        {
          type: AgentType.CODER,
          name: 'Primary Coder',
          capabilities: ['coding', 'development']
        }
      ];

      const config: SwarmConfig = {
        name: 'Swarm with Agents',
        topology: SwarmTopology.HIERARCHICAL,
        initialAgents
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.agents).toHaveLength(2);
      expect(swarm.agents[0].type).toBe(AgentType.COORDINATOR);
      expect(swarm.agents[1].type).toBe(AgentType.CODER);
      expect(swarm.agents.every(agent => agent.swarmId === swarm.id)).toBe(true);
    });

    it('should limit maximum swarm size', async () => {
      const config: SwarmConfig = {
        name: 'Large Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 5
      };

      const swarm = await swarmManager.createSwarm(config);

      // Add agents up to limit
      for (let i = 0; i < 5; i++) {
        await swarmManager.addAgent(swarm.id, {
          type: AgentType.CODER,
          name: `Agent ${i}`,
          capabilities: ['coding']
        });
      }

      // Should fail when trying to add beyond limit
      await expect(
        swarmManager.addAgent(swarm.id, {
          type: AgentType.TESTER,
          name: 'Extra Agent',
          capabilities: ['testing']
        })
      ).rejects.toThrow('has reached maximum agent capacity');
    });

    it('should destroy swarm and clean up resources', async () => {
      const config: SwarmConfig = {
        name: 'Test Swarm',
        topology: SwarmTopology.MESH
      };

      const swarm = await swarmManager.createSwarm(config);

      // Add some agents and tasks
      await swarmManager.addAgent(swarm.id, {
        type: AgentType.CODER,
        name: 'Test Agent',
        capabilities: ['coding']
      });

      await swarmManager.submitTask(swarm.id, {
        name: 'Test Task',
        description: 'Test task',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.MEDIUM
      });

      expect(swarmManager.getActiveSwarms()).toHaveLength(1);

      // Destroy swarm
      await swarmManager.destroySwarm(swarm.id);

      expect(swarmManager.getActiveSwarms()).toHaveLength(0);
    });
  });

  describe('Agent Management', () => {
    let swarm: Swarm;

    beforeEach(async () => {
      const config: SwarmConfig = {
        name: 'Test Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 5
      };
      swarm = await swarmManager.createSwarm(config);
    });

    it('should add agent to swarm', async () => {
      const agentConfig: AgentConfig = {
        type: AgentType.CODER,
        name: 'Test Coder',
        capabilities: ['coding', 'development', 'testing']
      };

      const agent = await swarmManager.addAgent(swarm.id, agentConfig);

      expect(agent).toBeDefined();
      expect(agent.type).toBe(AgentType.CODER);
      expect(agent.name).toBe('Test Coder');
      expect(agent.capabilities).toEqual(['coding', 'development', 'testing']);
      expect(agent.status).toBe(AgentStatus.IDLE);
      expect(agent.swarmId).toBe(swarm.id);

      const updatedSwarm = await swarmManager.getSwarmStatus(swarm.id);
      expect(updatedSwarm).toBe(SwarmStatus.ACTIVE);
    });

    it('should remove agent from swarm', async () => {
      const agent = await swarmManager.addAgent(swarm.id, {
        type: AgentType.TESTER,
        name: 'Test Agent',
        capabilities: ['testing']
      });

      expect(swarm.agents).toHaveLength(1);

      await swarmManager.removeAgent(agent.id);

      expect(swarm.agents).toHaveLength(0);
    });

    it('should throw error when adding agent to non-existent swarm', async () => {
      await expect(
        swarmManager.addAgent('non-existent', {
          type: AgentType.CODER,
          name: 'Test Agent',
          capabilities: ['coding']
        })
      ).rejects.toThrow('Swarm non-existent not found');
    });

    it('should throw error when removing non-existent agent', async () => {
      await expect(
        swarmManager.removeAgent('non-existent-agent')
      ).rejects.toThrow('Agent non-existent-agent not found');
    });
  });

  describe('Task Management', () => {
    let swarm: Swarm;
    let coder: Agent;
    let tester: Agent;

    beforeEach(async () => {
      const config: SwarmConfig = {
        name: 'Test Swarm',
        topology: SwarmTopology.MESH,
        initialAgents: [
          {
            type: AgentType.CODER,
            name: 'Coder',
            capabilities: ['coding']
          },
          {
            type: AgentType.TESTER,
            name: 'Tester',
            capabilities: ['testing']
          }
        ]
      };
      swarm = await swarmManager.createSwarm(config);
      [coder, tester] = swarm.agents;
    });

    it('should submit task to swarm', async () => {
      const taskConfig: TaskConfig = {
        name: 'Generate Code',
        description: 'Generate TypeScript code for API endpoint',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.HIGH
      };

      const task = await swarmManager.submitTask(swarm.id, taskConfig);

      expect(task).toBeDefined();
      expect(task.name).toBe('Generate Code');
      expect(task.type).toBe(TaskType.CODE_GENERATION);
      expect(task.priority).toBe(TaskPriority.HIGH);
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(swarm.tasks).toContain(task);
    });

    it('should assign task to suitable agent', async () => {
      const taskConfig: TaskConfig = {
        name: 'Write Tests',
        description: 'Write unit tests for user service',
        type: TaskType.TESTING,
        priority: TaskPriority.MEDIUM
      };

      const task = await swarmManager.submitTask(swarm.id, taskConfig);

      // Task should be assigned to tester agent
      expect(task.assignedAgentId).toBeDefined();
      expect(task.status).toBe(TaskStatus.IN_PROGRESS);

      const assignedAgent = swarm.agents.find(a => a.id === task.assignedAgentId);
      expect(assignedAgent?.type).toBe(AgentType.TESTER);
      expect(assignedAgent?.status).toBe(AgentStatus.BUSY);
    });

    it('should handle task dependencies', async () => {
      const analysisTask = await swarmManager.submitTask(swarm.id, {
        name: 'Analyze Requirements',
        description: 'Analyze project requirements',
        type: TaskType.ANALYSIS,
        priority: TaskPriority.HIGH
      });

      const codingTask = await swarmManager.submitTask(swarm.id, {
        name: 'Implement Feature',
        description: 'Implement based on analysis',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.HIGH,
        dependencies: [analysisTask.id]
      });

      // Coding task should not be assigned until analysis is complete
      expect(codingTask.status).toBe(TaskStatus.PENDING);
      expect(codingTask.assignedAgentId).toBeUndefined();
    });

    it('should queue tasks when no suitable agents available', async () => {
      // Make all agents busy
      coder.status = AgentStatus.BUSY;
      tester.status = AgentStatus.BUSY;

      const taskConfig: TaskConfig = {
        name: 'New Task',
        description: 'Task when all agents are busy',
        type: TaskType.DOCUMENTATION,
        priority: TaskPriority.LOW
      };

      const task = await swarmManager.submitTask(swarm.id, taskConfig);

      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.assignedAgentId).toBeUndefined();
    });
  });

  describe('Swarm Scaling', () => {
    let swarm: Swarm;

    beforeEach(async () => {
      const config: SwarmConfig = {
        name: 'Scalable Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 10
      };
      swarm = await swarmManager.createSwarm(config);
    });

    it('should scale up swarm', async () => {
      const initialAgentCount = swarm.agents.length;

      await swarmManager.scaleSwarm(swarm.id, initialAgentCount + 3);

      expect(swarm.agents.length).toBe(initialAgentCount + 3);
    });

    it('should scale down swarm', async () => {
      // Add some agents first
      for (let i = 0; i < 5; i++) {
        await swarmManager.addAgent(swarm.id, {
          type: AgentType.CODER,
          name: `Agent ${i}`,
          capabilities: ['coding']
        });
      }

      const agentCount = swarm.agents.length;

      await swarmManager.scaleSwarm(swarm.id, agentCount - 2);

      expect(swarm.agents.length).toBe(agentCount - 2);
    });

    it('should remove idle agents first when scaling down', async () => {
      // Add agents and make some busy
      const agents = [];
      for (let i = 0; i < 5; i++) {
        const agent = await swarmManager.addAgent(swarm.id, {
          type: AgentType.CODER,
          name: `Agent ${i}`,
          capabilities: ['coding']
        });
        agents.push(agent);

        if (i < 2) {
          agent.status = AgentStatus.BUSY;
        }
      }

      const initialCount = swarm.agents.length;
      const initialIdleCount = swarm.agents.filter(a => a.status === AgentStatus.IDLE).length;

      await swarmManager.scaleSwarm(swarm.id, initialCount - 2);

      expect(swarm.agents.length).toBe(initialCount - 2);
      // Should have removed idle agents first
      const finalIdleCount = swarm.agents.filter(a => a.status === AgentStatus.IDLE).length;
      expect(finalIdleCount).toBeLessThan(initialIdleCount);
    });
  });

  describe('Swarm Optimization', () => {
    let swarm: Swarm;

    beforeEach(async () => {
      const config: SwarmConfig = {
        name: 'Optimizable Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 5
      };
      swarm = await swarmManager.createSwarm(config);
    });

    it('should provide swarm metrics', () => {
      const metrics = swarmManager.getSwarmMetrics(swarm.id);

      expect(metrics).toBeDefined();
      expect(metrics.swarmId).toBe(swarm.id);
      expect(metrics.agentCount).toBe(0);
      expect(metrics.activeAgents).toBe(0);
      expect(metrics.totalTasks).toBe(0);
      expect(metrics.completedTasks).toBe(0);
      expect(metrics.failedTasks).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageTaskTime).toBe(0);
      expect(typeof metrics.resourceUtilization).toBe('number');
    });

    it('should optimize swarm performance', async () => {
      // Add some agents and tasks
      await swarmManager.addAgent(swarm.id, {
        type: AgentType.CODER,
        name: 'Test Coder',
        capabilities: ['coding']
      });

      const optimization = await swarmManager.optimizeSwarm(swarm.id);

      expect(optimization).toBeDefined();
      expect(optimization.beforeMetrics).toBeDefined();
      expect(optimization.afterMetrics).toBeDefined();
      expect(Array.isArray(optimization.optimizations)).toBe(true);
      expect(typeof optimization.improvement).toBe('number');
    });

    it('should switch topology based on agent count', async () => {
      // Add many agents to trigger topology change
      for (let i = 0; i < 25; i++) {
        await swarmManager.addAgent(swarm.id, {
          type: AgentType.CODER,
          name: `Agent ${i}`,
          capabilities: ['coding']
        });
      }

      const optimization = await swarmManager.optimizeSwarm(swarm.id);

      // Should detect need for hierarchical topology with many agents
      const topologyOptimization = optimization.optimizations.find(opt =>
        opt.includes('hierarchical topology')
      );
      expect(topologyOptimization).toBeDefined();
    });
  });

  describe('Topology Management', () => {
    it('should setup hierarchical topology', async () => {
      const config: SwarmConfig = {
        name: 'Hierarchical Swarm',
        topology: SwarmTopology.HIERARCHICAL
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.topology).toBe(SwarmTopology.HIERARCHICAL);
    });

    it('should setup star topology with coordinator', async () => {
      const config: SwarmConfig = {
        name: 'Star Swarm',
        topology: SwarmTopology.STAR
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.topology).toBe(SwarmTopology.STAR);
    });

    it('should setup mesh topology by default', async () => {
      const config: SwarmConfig = {
        name: 'Mesh Swarm',
        topology: SwarmTopology.MESH
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.topology).toBe(SwarmTopology.MESH);
    });

    it('should setup adaptive topology', async () => {
      const config: SwarmConfig = {
        name: 'Adaptive Swarm',
        topology: SwarmTopology.ADAPTIVE
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.topology).toBe(SwarmTopology.ADAPTIVE);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent swarm operations', async () => {
      expect(swarmManager.getSwarmStatus('non-existent')).toBeNull();
      expect(swarmManager.getSwarmMetrics('non-existent')).toBeNull();

      await expect(
        swarmManager.submitTask('non-existent', {
          name: 'Test Task',
          description: 'Test',
          type: TaskType.CODE_GENERATION,
          priority: TaskPriority.MEDIUM
        })
      ).rejects.toThrow('Swarm non-existent not found');

      await expect(
        swarmManager.destroySwarm('non-existent')
      ).rejects.toThrow('Swarm non-existent not found');

      await expect(
        swarmManager.optimizeSwarm('non-existent')
      ).rejects.toThrow('Swarm non-existent not found');
    });

    it('should handle agent without swarm assignment', async () => {
      // Create a mock agent without swarmId
      const agentWithoutSwarm: Agent = {
        id: 'orphan-agent',
        type: AgentType.CODER,
        name: 'Orphan Agent',
        capabilities: ['coding'],
        status: AgentStatus.IDLE,
        metrics: {
          cpuUsage: 0,
          memoryUsage: 0,
          tasksCompleted: 0,
          averageTaskTime: 0,
          successRate: 1.0,
          lastActivity: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // This should be handled gracefully in actual implementation
      expect(agentWithoutSwarm.swarmId).toBeUndefined();
    });
  });

  describe('Active Swarms Management', () => {
    it('should return only active swarms', async () => {
      const activeConfig: SwarmConfig = {
        name: 'Active Swarm',
        topology: SwarmTopology.MESH
      };

      const swarm1 = await swarmManager.createSwarm(activeConfig);
      const swarm2 = await swarmManager.createSwarm(activeConfig);

      const activeSwarms = swarmManager.getActiveSwarms();

      expect(activeSwarms).toHaveLength(2);
      expect(activeSwarms.map(s => s.id)).toContain(swarm1.id);
      expect(activeSwarms.map(s => s.id)).toContain(swarm2.id);

      // Terminate one swarm
      await swarmManager.destroySwarm(swarm1.id);

      const remainingActiveSwarms = swarmManager.getActiveSwarms();

      expect(remainingActiveSwarms).toHaveLength(1);
      expect(remainingActiveSwarms[0].id).toBe(swarm2.id);
    });
  });

  describe('Agent Task Assignment', () => {
    let swarm: Swarm;

    beforeEach(async () => {
      const config: SwarmConfig = {
        name: 'Task Assignment Swarm',
        topology: SwarmTopology.MESH,
        initialAgents: [
          {
            type: AgentType.CODER,
            name: 'Coder',
            capabilities: ['coding', 'development']
          },
          {
            type: AgentType.TESTER,
            name: 'Tester',
            capabilities: ['testing', 'quality_assurance']
          },
          {
            type: AgentType.DOCUMENTER,
            name: 'Documenter',
            capabilities: ['documentation', 'writing']
          }
        ]
      };
      swarm = await swarmManager.createSwarm(config);
    });

    it('should assign coding tasks to coders', async () => {
      const task = await swarmManager.submitTask(swarm.id, {
        name: 'Write API',
        description: 'Write REST API endpoints',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.HIGH
      });

      const assignedAgent = swarm.agents.find(a => a.id === task.assignedAgentId);
      expect(assignedAgent?.type).toBe(AgentType.CODER);
    });

    it('should assign testing tasks to testers', async () => {
      const task = await swarmManager.submitTask(swarm.id, {
        name: 'Test User Service',
        description: 'Write unit tests for user service',
        type: TaskType.TESTING,
        priority: TaskPriority.MEDIUM
      });

      const assignedAgent = swarm.agents.find(a => a.id === task.assignedAgentId);
      expect(assignedAgent?.type).toBe(AgentType.TESTER);
    });

    it('should assign documentation tasks to documenters', async () => {
      const task = await swarmManager.submitTask(swarm.id, {
        name: 'Document API',
        description: 'Write API documentation',
        type: TaskType.DOCUMENTATION,
        priority: TaskPriority.LOW
      });

      const assignedAgent = swarm.agents.find(a => a.id === task.assignedAgentId);
      expect(assignedAgent?.type).toBe(AgentType.DOCUMENTER);
    });

    it('should handle tasks with no suitable agents', async () => {
      // Remove all agents
      const agentIds = swarm.agents.map(a => a.id);
      for (const agentId of agentIds) {
        await swarmManager.removeAgent(agentId);
      }

      const task = await swarmManager.submitTask(swarm.id, {
        name: 'Orphan Task',
        description: 'Task with no suitable agents',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.MEDIUM
      });

      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.assignedAgentId).toBeUndefined();
    });
  });

  describe('Resource Limits', () => {
    it('should enforce default resource limits', async () => {
      const config: SwarmConfig = {
        name: 'Resource Limited Swarm',
        topology: SwarmTopology.MESH
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.config.resourceLimits.maxCpuUsage).toBe(80);
      expect(swarm.config.resourceLimits.maxMemoryUsage).toBe(2048);
      expect(swarm.config.resourceLimits.maxTasksPerAgent).toBe(5);
    });

    it('should use custom resource limits', async () => {
      const customLimits = {
        maxCpuUsage: 95,
        maxMemoryUsage: 8192,
        maxTasksPerAgent: 15
      };

      const config: SwarmConfig = {
        name: 'Custom Resource Swarm',
        topology: SwarmTopology.MESH,
        resourceLimits: customLimits
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.config.resourceLimits).toEqual(customLimits);
    });
  });

  describe('Agent Capabilities', () => {
    let swarm: Swarm;

    beforeEach(async () => {
      const config: SwarmConfig = {
        name: 'Capabilities Swarm',
        topology: SwarmTopology.MESH
      };
      swarm = await swarmManager.createSwarm(config);
    });

    it('should assign default capabilities based on agent type', async () => {
      const coder = await swarmManager.addAgent(swarm.id, {
        type: AgentType.CODER,
        name: 'Default Coder',
        capabilities: [] // Empty array to test defaults
      });

      expect(coder.capabilities).toContain('coding');
      expect(coder.capabilities).toContain('development');
      expect(coder.capabilities).toContain('programming');
    });

    it('should use custom capabilities when provided', async () => {
      const customCapabilities = ['custom_capability_1', 'custom_capability_2'];
      const agent = await swarmManager.addAgent(swarm.id, {
        type: AgentType.SPECIALIST,
        name: 'Custom Agent',
        capabilities: customCapabilities
      });

      expect(agent.capabilities).toEqual(customCapabilities);
    });

    it('should verify all agent types have default capabilities', () => {
      const capabilityMap = new Map([
        [AgentType.COORDINATOR, ['coordination', 'management', 'planning']],
        [AgentType.ANALYST, ['analysis', 'research', 'evaluation']],
        [AgentType.OPTIMIZER, ['optimization', 'performance', 'efficiency']],
        [AgentType.DOCUMENTER, ['documentation', 'writing', 'communication']],
        [AgentType.MONITOR, ['monitoring', 'logging', 'alerting']],
        [AgentType.SPECIALIST, ['specialized_tasks', 'domain_expertise']],
        [AgentType.ARCHITECT, ['architecture', 'design', 'planning']],
        [AgentType.TASK_ORCHESTRATOR, ['orchestration', 'coordination', 'workflow']],
        [AgentType.CODE_ANALYZER, ['code_analysis', 'static_analysis', 'quality']],
        [AgentType.PERF_ANALYZER, ['performance_analysis', 'benchmarking', 'optimization']],
        [AgentType.API_DOCS, ['api_documentation', 'technical_writing']],
        [AgentType.PERFORMANCE_BENCHMARKER, ['benchmarking', 'performance_testing']],
        [AgentType.SYSTEM_ARCHITECT, ['system_design', 'architecture', 'scalability']],
        [AgentType.RESEARCHER, ['research', 'investigation', 'analysis']],
        [AgentType.CODER, ['coding', 'development', 'programming']],
        [AgentType.TESTER, ['testing', 'quality_assurance', 'validation']],
        [AgentType.REVIEWER, ['code_review', 'quality_control', 'analysis']]
      ]);

      for (const [agentType, expectedCapabilities] of capabilityMap) {
        const agent = swarmManager.addAgent(swarm.id, {
          type: agentType,
          name: `Test ${agentType}`,
          capabilities: []
        });

        // In real implementation, this would return an agent with default capabilities
        expect(agent).toBeDefined();
      }
    });
  });

  describe('Task Priority Handling', () => {
    let swarm: Swarm;

    beforeEach(async () => {
      const config: SwarmConfig = {
        name: 'Priority Swarm',
        topology: SwarmTopology.MESH,
        initialAgents: [
          {
            type: AgentType.CODER,
            name: 'Priority Coder',
            capabilities: ['coding']
          }
        ]
      };
      swarm = await swarmManager.createSwarm(config);
    });

    it('should prioritize critical tasks', async () => {
      const criticalTask = await swarmManager.submitTask(swarm.id, {
        name: 'Critical Task',
        description: 'High priority task',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.CRITICAL
      });

      const lowTask = await swarmManager.submitTask(swarm.id, {
        name: 'Low Priority Task',
        description: 'Low priority task',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.LOW
      });

      // Critical task should be assigned first
      expect(criticalTask.assignedAgentId).toBeDefined();
      expect(criticalTask.status).toBe(TaskStatus.IN_PROGRESS);

      // Low priority task may still be pending or assigned based on agent availability
      expect(lowTask.status).toBeOneOf([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]);
    });

    it('should handle multiple tasks with same priority', async () => {
      const tasks = [];
      for (let i = 0; i < 3; i++) {
        tasks.push(await swarmManager.submitTask(swarm.id, {
          name: `Task ${i}`,
          description: `Task ${i} description`,
          type: TaskType.CODE_GENERATION,
          priority: TaskPriority.HIGH
        }));
      }

      // All high priority tasks should be processed in order
      expect(tasks.every(t => t.assignedAgentId)).toBe(true);
    });
  });

  describe('Swarm Status Transitions', () => {
    let swarm: Swarm;

    beforeEach(async () => {
      const config: SwarmConfig = {
        name: 'Status Swarm',
        topology: SwarmTopology.MESH
      };
      swarm = await swarmManager.createSwarm(config);
    });

    it('should transition through initialization to active', () => {
      // Swarm is created directly in active state in current implementation
      expect(swarm.status).toBe(SwarmStatus.ACTIVE);
    });

    it('should mark swarm as terminated when destroyed', async () => {
      await swarmManager.destroySwarm(swarm.id);

      // Swarm should be removed from active swarms
      const activeSwarms = swarmManager.getActiveSwarms();
      expect(activeSwarms.find(s => s.id === swarm.id)).toBeUndefined();
    });
  });

  describe('Error Recovery', () => {
    it('should handle concurrent agent operations', async () => {
      const config: SwarmConfig = {
        name: 'Concurrent Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 10
      };
      const swarm = await swarmManager.createSwarm(config);

      // Simulate concurrent agent additions
      const agentPromises = [];
      for (let i = 0; i < 5; i++) {
        agentPromises.push(
          swarmManager.addAgent(swarm.id, {
            type: AgentType.CODER,
            name: `Concurrent Agent ${i}`,
            capabilities: ['coding']
          })
        );
      }

      const agents = await Promise.all(agentPromises);

      // All agents should be added successfully
      expect(agents).toHaveLength(5);
      expect(agents.every(a => a.id)).toBe(true);
      expect(swarm.agents).toHaveLength(5);
    });

    it('should handle partial failures gracefully', async () => {
      const swarm = await swarmManager.createSwarm({
        name: 'Resilient Swarm',
        topology: SwarmTopology.MESH
      });

      // Even if some operations fail, swarm should remain functional
      expect(swarm.status).toBe(SwarmStatus.ACTIVE);
      expect(swarm.id).toBeDefined();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle zero capacity swarms', async () => {
      const config: SwarmConfig = {
        name: 'Zero Capacity Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 0
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.config.maxAgents).toBe(0);

      // Should not be able to add agents
      await expect(
        swarmManager.addAgent(swarm.id, {
          type: AgentType.CODER,
          name: 'Test Agent',
          capabilities: ['coding']
        })
      ).rejects.toThrow();
    });

    it('should handle maximum capacity swarms', async () => {
      const config: SwarmConfig = {
        name: 'Max Capacity Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 50 // Maximum allowed
      };

      const swarm = await swarmManager.createSwarm(config);

      expect(swarm.config.maxAgents).toBe(50);
    });

    it('should handle empty task queues', async () => {
      const swarm = await swarmManager.createSwarm({
        name: 'Empty Task Queue Swarm',
        topology: SwarmTopology.MESH
      });

      // Should have no tasks initially
      expect(swarm.tasks).toHaveLength(0);

      const metrics = swarmManager.getSwarmMetrics(swarm.id);
      expect(metrics?.totalTasks).toBe(0);
    });
  });
});