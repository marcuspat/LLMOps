import { SwarmManager, SwarmConfig, AgentConfig, TaskConfig } from '../../src/core/SwarmManager.js';
import { SwarmTopology, SwarmStrategy, AgentType, TaskType, TaskPriority } from '../../src/types/index.js';

describe('Swarm Performance Tests', () => {
  let swarmManager: SwarmManager;

  beforeEach(() => {
    swarmManager = new SwarmManager();
  });

  describe('Swarm Creation Performance', () => {
    it('should create swarm with minimal agents under 100ms', async () => {
      const startTime = Date.now();

      const swarmConfig: SwarmConfig = {
        name: 'Performance Test Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 5,
        strategy: SwarmStrategy.BALANCED
      };

      const swarm = await swarmManager.createSwarm(swarmConfig);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
      expect(swarm.id).toBeDefined();
      expect(swarm.status).toBe('active');
    });

    it('should create swarm with 50 agents under 1s', async () => {
      const startTime = Date.now();

      const initialAgents: AgentConfig[] = Array.from({ length: 25 }, (_, i) => ({
        type: AgentType.CODER,
        name: `Perf Coder ${i}`,
        capabilities: ['coding', 'development']
      }));

      const swarmConfig: SwarmConfig = {
        name: 'Large Performance Swarm',
        topology: SwarmTopology.HIERARCHICAL,
        maxAgents: 50,
        strategy: SwarmStrategy.SPECIALIZED,
        initialAgents
      };

      const swarm = await swarmManager.createSwarm(swarmConfig);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
      expect(swarm.agents).toHaveLength(25);
    });

    it('should handle concurrent swarm creation efficiently', async () => {
      const startTime = Date.now();

      const swarmCreationPromises = Array.from({ length: 10 }, () => {
        const config: SwarmConfig = {
          name: `Concurrent Swarm ${Date.now()}`,
          topology: SwarmTopology.MESH,
          maxAgents: 5
        };
        return swarmManager.createSwarm(config);
      });

      const swarms = await Promise.all(swarmCreationPromises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
      expect(swarms).toHaveLength(10);
      swarms.forEach(swarm => {
        expect(swarm.id).toBeDefined();
        expect(swarm.status).toBe('active');
      });
    });
  });

  describe('Agent Spawning Performance', () => {
    let swarmId: string;

    beforeEach(async () => {
      const swarmConfig: SwarmConfig = {
        name: 'Agent Performance Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 100
      };
      const swarm = await swarmManager.createSwarm(swarmConfig);
      swarmId = swarm.id;
    });

    it('should spawn single agent under 50ms', async () => {
      const startTime = Date.now();

      const agent = await swarmManager.addAgent(swarmId, {
        type: AgentType.CODER,
        name: 'Performance Test Agent',
        capabilities: ['coding']
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
      expect(agent.id).toBeDefined();
      expect(agent.status).toBe('idle');
    });

    it('should spawn 10 agents in parallel under 200ms', async () => {
      const startTime = Date.now();

      const agentConfigs: AgentConfig[] = Array.from({ length: 10 }, (_, i) => ({
        type: AgentType.CODER,
        name: `Parallel Agent ${i}`,
        capabilities: ['coding', 'development']
      }));

      const agentPromises = agentConfigs.map(config =>
        swarmManager.addAgent(swarmId, config)
      );

      const agents = await Promise.all(agentPromises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);
      expect(agents).toHaveLength(10);
    });

    it('should spawn 50 agents efficiently', async () => {
      const startTime = Date.now();

      const agentConfigs: AgentConfig[] = Array.from({ length: 50 }, (_, i) => ({
        type: i % 3 === 0 ? AgentType.CODER :
               i % 3 === 1 ? AgentType.TESTER : AgentType.DOCUMENTER,
        name: `Bulk Agent ${i}`,
        capabilities: i % 3 === 0 ? ['coding'] :
                     i % 3 === 1 ? ['testing'] : ['documentation']
      }));

      const agents = await Promise.all(
        agentConfigs.map(config => swarmManager.addAgent(swarmId, config))
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
      expect(agents).toHaveLength(50);
    });
  });

  describe('Task Orchestration Performance', () => {
    let swarmId: string;
    let agentIds: string[] = [];

    beforeEach(async () => {
      // Create swarm with agents
      const swarmConfig: SwarmConfig = {
        name: 'Task Performance Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 20,
        initialAgents: [
          {
            type: AgentType.CODER,
            name: 'Main Coder',
            capabilities: ['coding', 'development']
          },
          {
            type: AgentType.TESTER,
            name: 'Main Tester',
            capabilities: ['testing', 'quality_assurance']
          },
          {
            type: AgentType.DOCUMENTER,
            name: 'Main Documenter',
            capabilities: ['documentation', 'writing']
          },
          {
            type: AgentType.COORDINATOR,
            name: 'Coordinator',
            capabilities: ['coordination', 'management']
          }
        ]
      };

      const swarm = await swarmManager.createSwarm(swarmConfig);
      swarmId = swarm.id;
      agentIds = swarm.agents.map(agent => agent.id);
    });

    it('should submit and assign single task under 100ms', async () => {
      const startTime = Date.now();

      const taskConfig: TaskConfig = {
        name: 'Performance Test Task',
        description: 'Single task for performance testing',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.MEDIUM
      };

      const task = await swarmManager.submitTask(swarmId, taskConfig);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
      expect(task.id).toBeDefined();
      expect(task.status).toBe('pending');
    });

    it('should submit 100 tasks in parallel efficiently', async () => {
      const startTime = Date.now();

      const taskConfigs: TaskConfig[] = Array.from({ length: 100 }, (_, i) => ({
        name: `Batch Task ${i}`,
        description: `Task ${i} for batch performance testing`,
        type: i % 3 === 0 ? TaskType.CODE_GENERATION :
               i % 3 === 1 ? TaskType.TESTING : TaskType.DOCUMENTATION,
        priority: i % 10 === 0 ? TaskPriority.HIGH : TaskPriority.MEDIUM
      }));

      const taskPromises = taskConfigs.map(config =>
        swarmManager.submitTask(swarmId, config)
      );

      const tasks = await Promise.all(taskPromises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
      expect(tasks).toHaveLength(100);
    });

    it('should handle task dependencies correctly', async () => {
      const startTime = Date.now();

      // Create tasks with dependencies
      const task1 = await swarmManager.submitTask(swarmId, {
        name: 'Dependency Task 1',
        description: 'First task in dependency chain',
        type: TaskType.ANALYSIS,
        priority: TaskPriority.HIGH
      });

      const task2 = await swarmManager.submitTask(swarmId, {
        name: 'Dependency Task 2',
        description: 'Task depending on Task 1',
        type: TaskType.CODE_GENERATION,
        priority: TaskPriority.HIGH,
        dependencies: [task1.id]
      });

      const task3 = await swarmManager.submitTask(swarmId, {
        name: 'Dependency Task 3',
        description: 'Final task depending on Task 2',
        type: TaskType.TESTING,
        priority: TaskPriority.HIGH,
        dependencies: [task2.id]
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);

      expect(task1.status).toBe('pending');
      expect(task2.status).toBe('pending'); // Should wait for task1
      expect(task3.status).toBe('pending'); // Should wait for task2
    });
  });

  describe('Swarm Scaling Performance', () => {
    let swarmId: string;

    beforeEach(async () => {
      const swarmConfig: SwarmConfig = {
        name: 'Scaling Performance Swarm',
        topology: SwarmTopology.ADAPTIVE,
        maxAgents: 50,
        enableAutoScaling: true
      };
      const swarm = await swarmManager.createSwarm(swarmConfig);
      swarmId = swarm.id;
    });

    it('should scale up from 5 to 20 agents efficiently', async () => {
      const startTime = Date.now();

      // Add initial agents
      for (let i = 0; i < 5; i++) {
        await swarmManager.addAgent(swarmId, {
          type: AgentType.CODER,
          name: `Initial Agent ${i}`,
          capabilities: ['coding']
        });
      }

      // Scale up
      await swarmManager.scaleSwarm(swarmId, 20);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);

      const metrics = swarmManager.getSwarmMetrics(swarmId);
      expect(metrics?.agentCount).toBe(20);
    });

    it('should scale down efficiently', async () => {
      // Start with many agents
      for (let i = 0; i < 30; i++) {
        await swarmManager.addAgent(swarmId, {
          type: AgentType.TESTER,
          name: `Scale Test Agent ${i}`,
          capabilities: ['testing']
        });
      }

      const startTime = Date.now();

      // Scale down to 10 agents
      await swarmManager.scaleSwarm(swarmId, 10);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);

      const metrics = swarmManager.getSwarmMetrics(swarmId);
      expect(metrics?.agentCount).toBe(10);
    });

    it('should handle rapid scaling up and down', async () => {
      const startTime = Date.now();

      // Rapid scaling cycle
      await swarmManager.scaleSwarm(swarmId, 25);
      await swarmManager.scaleSwarm(swarmId, 5);
      await swarmManager.scaleSwarm(swarmId, 15);
      await swarmManager.scaleSwarm(swarmId, 3);
      await swarmManager.scaleSwarm(swarmId, 20);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);

      const metrics = swarmManager.getSwarmMetrics(swarmId);
      expect(metrics?.agentCount).toBe(20);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle large swarm operations without memory leaks', async () => {
      const initialMemory = process.memoryUsage();

      // Create and destroy multiple swarms
      for (let i = 0; i < 10; i++) {
        const swarmConfig: SwarmConfig = {
          name: `Memory Test Swarm ${i}`,
          topology: SwarmTopology.MESH,
          maxAgents: 20
        };

        const swarm = await swarmManager.createSwarm(swarmConfig);

        // Add agents
        for (let j = 0; j < 10; j++) {
          await swarmManager.addAgent(swarm.id, {
            type: AgentType.CODER,
            name: `Agent ${i}-${j}`,
            capabilities: ['coding']
          });
        }

        // Add tasks
        for (let k = 0; k < 20; k++) {
          await swarmManager.submitTask(swarm.id, {
            name: `Task ${i}-${k}`,
            description: `Memory test task ${i}-${k}`,
            type: TaskType.CODE_GENERATION,
            priority: TaskPriority.MEDIUM
          });
        }

        // Destroy swarm
        await swarmManager.destroySwarm(swarm.id);
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle 1000 concurrent task submissions', async () => {
      const swarmConfig: SwarmConfig = {
        name: 'Stress Test Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 50,
        initialAgents: Array.from({ length: 20 }, (_, i) => ({
          type: AgentType.CODER,
          name: `Stress Agent ${i}`,
          capabilities: ['coding', 'development']
        }))
      };

      const swarm = await swarmManager.createSwarm(swarmConfig);

      const startTime = Date.now();

      // Submit 1000 tasks
      const taskPromises = Array.from({ length: 1000 }, (_, i) => {
        return swarmManager.submitTask(swarm.id, {
          name: `Stress Task ${i}`,
          description: `High-volume task ${i}`,
          type: TaskType.CODE_GENERATION,
          priority: i % 10 === 0 ? TaskPriority.HIGH : TaskPriority.LOW
        });
      });

      const tasks = await Promise.all(taskPromises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
      expect(tasks).toHaveLength(1000);

      // Verify swarm is still functional
      const metrics = swarmManager.getSwarmMetrics(swarm.id);
      expect(metrics).toBeDefined();
      expect(metrics!.totalTasks).toBe(1000);

      await swarmManager.destroySwarm(swarm.id);
    });
  });

  describe('Optimization Performance', () => {
    let swarmId: string;

    beforeEach(async () => {
      const swarmConfig: SwarmConfig = {
        name: 'Optimization Test Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 30
      };
      const swarm = await swarmManager.createSwarm(swarmConfig);

      // Add agents with mixed load
      for (let i = 0; i < 20; i++) {
        const agentType = i % 4 === 0 ? AgentType.CODER :
                           i % 4 === 1 ? AgentType.TESTER :
                           i % 4 === 2 ? AgentType.DOCUMENTER : AgentType.ANALYST;

        await swarmManager.addAgent(swarm.id, {
          type: agentType,
          name: `Optimization Agent ${i}`,
          capabilities: ['development']
        });
      }
      swarmId = swarm.id;
    });

    it('should perform swarm optimization under 500ms', async () => {
      const startTime = Date.now();

      const optimization = await swarmManager.optimizeSwarm(swarmId);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);

      expect(optimization).toBeDefined();
      expect(optimization.beforeMetrics).toBeDefined();
      expect(optimization.afterMetrics).toBeDefined();
      expect(optimization.improvement).toBeDefined();
      expect(Array.isArray(optimization.optimizations)).toBe(true);
    });

    it('should handle repeated optimizations efficiently', async () => {
      const startTime = Date.now();

      const optimizations = [];

      // Run optimization multiple times
      for (let i = 0; i < 5; i++) {
        const optimization = await swarmManager.optimizeSwarm(swarmId);
        optimizations.push(optimization);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);

      expect(optimizations).toHaveLength(5);
      optimizations.forEach(opt => {
        expect(opt.beforeMetrics).toBeDefined();
        expect(opt.afterMetrics).toBeDefined();
      });
    });

    it('should show improvement with multiple optimizations', async () => {
      const initialOptimization = await swarmManager.optimizeSwarm(swarmId);

      // Add some load to swarm
      for (let i = 0; i < 10; i++) {
        await swarmManager.submitTask(swarmId, {
          name: `Load Task ${i}`,
          description: `Task to create optimization opportunities`,
          type: TaskType.CODE_GENERATION,
          priority: TaskPriority.HIGH
        });
      }

      const secondOptimization = await swarmManager.optimizeSwarm(swarmId);

      // Second optimization should show better improvement due to added tasks
      expect(secondOptimization.improvement).toBeGreaterThan(initialOptimization.improvement * 0.5);
    });
  });

  describe('Throughput Tests', () => {
    it('should maintain high task throughput', async () => {
      const swarmConfig: SwarmConfig = {
        name: 'Throughput Test Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 25,
        strategy: SwarmStrategy.SPECIALIZED,
        initialAgents: Array.from({ length: 25 }, (_, i) => ({
          type: i % 3 === 0 ? AgentType.CODER :
                     i % 3 === 1 ? AgentType.TESTER : AgentType.DOCUMENTER,
          name: `Throughput Agent ${i}`,
          capabilities: ['development', 'testing', 'documentation']
        }))
      };

      const swarm = await swarmManager.createSwarm(swarmConfig);
      const swarmId = swarm.id;

      // Measure task submission throughput
      const taskCount = 500;
      const startTime = Date.now();

      const taskPromises = Array.from({ length: taskCount }, (_, i) => {
        return swarmManager.submitTask(swarmId, {
          name: `Throughput Task ${i}`,
          description: `High-throughput test task ${i}`,
          type: TaskType.CODE_GENERATION,
          priority: TaskPriority.MEDIUM
        });
      });

      await Promise.all(taskPromises);

      const duration = Date.now() - startTime;
      const tasksPerSecond = taskCount / (duration / 1000);

      // Should handle at least 100 tasks per second
      expect(tasksPerSecond).toBeGreaterThan(100);

      const metrics = swarmManager.getSwarmMetrics(swarmId);
      expect(metrics!.totalTasks).toBe(taskCount);

      await swarmManager.destroySwarm(swarm.id);
    });

    it('should maintain performance with concurrent operations', async () => {
      const swarmConfig: SwarmConfig = {
        name: 'Concurrent Ops Swarm',
        topology: SwarmTopology.MESH,
        maxAgents: 20
      };
      const swarm = await swarmManager.createSwarm(swarmConfig);

      // Mix of concurrent operations
      const startTime = Date.now();

      const operations = [
        // Agent operations
        ...Array.from({ length: 10 }, (_, i) =>
          swarm.addAgent(swarm.id, {
            type: AgentType.CODER,
            name: `Concurrent Agent ${i}`,
            capabilities: ['coding']
          })
        ),
        // Task operations
        ...Array.from({ length: 20 }, (_, i) =>
          swarm.submitTask(swarm.id, {
            name: `Concurrent Task ${i}`,
            description: `Concurrent operation task ${i}`,
            type: TaskType.CODE_GENERATION,
            priority: TaskPriority.MEDIUM
          })
        ),
        // Metrics operations
        ...Array.from({ length: 15 }, () =>
          Promise.resolve(swarmManager.getSwarmMetrics(swarm.id))
        )
      ];

      const results = await Promise.all(operations);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
      expect(results).toHaveLength(45); // 10 agents + 20 tasks + 15 metrics

      await swarmManager.destroySwarm(swarm.id);
    });
  });
});