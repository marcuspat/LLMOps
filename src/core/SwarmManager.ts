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
  ResourceLimits
} from '../types/index.js';

/**
 * Swarm Management Service
 * Handles agent coordination, task distribution, and swarm lifecycle management
 */
export class SwarmManager {
  private swarms: Map<string, Swarm> = new Map();
  private agents: Map<string, Agent> = new Map();
  private taskQueue: Task[] = [];
  private readonly maxSwarmSize = 50;
  private readonly resourceMonitor: ResourceMonitor;

  constructor() {
    this.resourceMonitor = new ResourceMonitor();
  }

  /**
   * Create a new swarm with specified topology
   */
  async createSwarm(config: SwarmConfig): Promise<Swarm> {
    const swarm: Swarm = {
      id: this.generateId('swarm'),
      name: config.name,
      topology: config.topology,
      status: SwarmStatus.INITIALIZING,
      agents: [],
      tasks: [],
      config: {
        maxAgents: Math.min(config.maxAgents ?? 10, this.maxSwarmSize),
        strategy: config.strategy ?? SwarmStrategy.BALANCED,
        enableAutoScaling: config.enableAutoScaling ?? false,
        resourceLimits: config.resourceLimits ?? this.getDefaultResourceLimits()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.swarms.set(swarm.id, swarm);

    // Initialize swarm with agents based on topology
    await this.initializeSwarm(swarm, config.initialAgents ?? []);

    swarm.status = SwarmStatus.ACTIVE;
    swarm.updatedAt = new Date();

    return swarm;
  }

  /**
   * Add agent to swarm
   */
  async addAgent(swarmId: string, agentConfig: AgentConfig): Promise<Agent> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    if (swarm.agents.length >= swarm.config.maxAgents) {
      throw new Error(`Swarm ${swarmId} has reached maximum agent capacity`);
    }

    const agent: Agent = {
      id: this.generateId('agent'),
      type: agentConfig.type,
      name: agentConfig.name,
      capabilities: agentConfig.capabilities,
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
      updatedAt: new Date(),
      swarmId: swarmId
    };

    this.agents.set(agent.id, agent);
    swarm.agents.push(agent);
    swarm.updatedAt = new Date();

    // Optimize swarm topology if needed
    await this.optimizeSwarmTopology(swarm);

    return agent;
  }

  /**
   * Remove agent from swarm
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const swarmId = agent.swarmId;
    if (!swarmId) {
      throw new Error(`Agent ${agentId} is not assigned to a swarm`);
    }

    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    // Reassign any active tasks
    await this.reassignAgentTasks(agent);

    // Remove agent from swarm
    swarm.agents = swarm.agents.filter(a => a.id !== agentId);
    swarm.updatedAt = new Date();

    this.agents.delete(agentId);

    // Optimize swarm topology after removal
    await this.optimizeSwarmTopology(swarm);
  }

  /**
   * Submit task to swarm
   */
  async submitTask(swarmId: string, taskConfig: TaskConfig): Promise<Task> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    const task: Task = {
      id: this.generateId('task'),
      name: taskConfig.name,
      description: taskConfig.description,
      type: taskConfig.type,
      status: TaskStatus.PENDING,
      priority: taskConfig.priority,
      dependencies: taskConfig.dependencies ?? [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.taskQueue.push(task);
    swarm.tasks.push(task);
    swarm.updatedAt = new Date();

    // Attempt to assign task immediately if possible
    await this.processTaskQueue(swarmId);

    return task;
  }

  /**
   * Get swarm status and metrics
   */
  getSwarmStatus(swarmId: string): SwarmStatus | null {
    const swarm = this.swarms.get(swarmId);
    return swarm ? swarm.status : null;
  }

  /**
   * Get all active swarms
   */
  getActiveSwarms(): Swarm[] {
    return Array.from(this.swarms.values())
      .filter(swarm => swarm.status === SwarmStatus.ACTIVE);
  }

  /**
   * Scale swarm up or down
   */
  async scaleSwarm(swarmId: string, targetSize: number): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    const currentSize = swarm.agents.length;
    const diff = targetSize - currentSize;

    if (diff > 0) {
      // Scale up
      for (let i = 0; i < diff; i++) {
        const agentType = this.selectAgentTypeForScaling(swarm);
        await this.addAgent(swarmId, {
          type: agentType,
          name: `${agentType}-${Date.now()}`,
          capabilities: this.getDefaultCapabilities(agentType)
        });
      }
    } else if (diff < 0) {
      // Scale down - remove idle agents first
      const idleAgents = swarm.agents
        .filter(agent => agent.status === AgentStatus.IDLE)
        .slice(0, Math.abs(diff));

      for (const agent of idleAgents) {
        await this.removeAgent(agent.id);
      }
    }
  }

  /**
   * Destroy swarm and clean up resources
   */
  async destroySwarm(swarmId: string): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    // Remove all agents
    const agentIds = swarm.agents.map(agent => agent.id);
    for (const agentId of agentIds) {
      await this.removeAgent(agentId);
    }

    // Cancel all pending tasks
    swarm.tasks
      .filter(task => task.status === TaskStatus.PENDING)
      .forEach(task => {
        task.status = TaskStatus.CANCELLED;
        task.updatedAt = new Date();
      });

    // Remove swarm
    swarm.status = SwarmStatus.TERMINATED;
    swarm.updatedAt = new Date();
    this.swarms.delete(swarmId);
  }

  /**
   * Get swarm performance metrics
   */
  getSwarmMetrics(swarmId: string): SwarmMetrics | null {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return null;
    }

    const agents = swarm.agents;
    const totalTasks = swarm.tasks.length;
    const completedTasks = swarm.tasks.filter(task => task.status === TaskStatus.COMPLETED).length;
    const failedTasks = swarm.tasks.filter(task => task.status === TaskStatus.FAILED).length;

    return {
      swarmId,
      agentCount: agents.length,
      activeAgents: agents.filter(agent => agent.status === AgentStatus.BUSY).length,
      totalTasks,
      completedTasks,
      failedTasks,
      successRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
      averageTaskTime: this.calculateAverageTaskTime(swarm.tasks),
      resourceUtilization: this.resourceMonitor.getSwarmResourceUtilization(swarmId)
    };
  }

  /**
   * Optimize swarm performance
   */
  async optimizeSwarm(swarmId: string): Promise<OptimizationResult> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    const optimizations: string[] = [];
    const beforeMetrics = this.getSwarmMetrics(swarmId)!;

    // Analyze and optimize topology
    const topologyOptimization = await this.optimizeSwarmTopology(swarm);
    if (topologyOptimization.changed) {
      optimizations.push(topologyOptimization.reason);
    }

    // Rebalance task distribution
    const taskRebalancing = await this.rebalanceTasks(swarm);
    if (taskRebalancing.rebalanced) {
      optimizations.push(taskRebalancing.reason);
    }

    // Optimize resource allocation
    const resourceOptimization = await this.optimizeResourceAllocation(swarm);
    if (resourceOptimization.optimized) {
      optimizations.push(resourceOptimization.reason);
    }

    const afterMetrics = this.getSwarmMetrics(swarmId)!;

    return {
      optimizations,
      beforeMetrics,
      afterMetrics,
      improvement: this.calculateImprovement(beforeMetrics, afterMetrics)
    };
  }

  // Private methods

  private async initializeSwarm(swarm: Swarm, initialAgents: AgentConfig[]): Promise<void> {
    for (const agentConfig of initialAgents) {
      const agent: Agent = {
        id: this.generateId('agent'),
        type: agentConfig.type,
        name: agentConfig.name,
        capabilities: agentConfig.capabilities,
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
        updatedAt: new Date(),
        swarmId: swarm.id
      };

      this.agents.set(agent.id, agent);
      swarm.agents.push(agent);
    }

    // Apply topology-specific initialization
    await this.applyTopology(swarm);
  }

  private async applyTopology(swarm: Swarm): Promise<void> {
    switch (swarm.topology) {
      case SwarmTopology.HIERARCHICAL:
        await this.setupHierarchicalTopology(swarm);
        break;
      case SwarmTopology.MESH:
        await this.setupMeshTopology(swarm);
        break;
      case SwarmTopology.RING:
        await this.setupRingTopology(swarm);
        break;
      case SwarmTopology.STAR:
        await this.setupStarTopology(swarm);
        break;
      case SwarmTopology.ADAPTIVE:
        await this.setupAdaptiveTopology(swarm);
        break;
    }
  }

  private async setupHierarchicalTopology(swarm: Swarm): Promise<void> {
    // Find coordinator agents
    const coordinators = swarm.agents.filter(agent => agent.type === AgentType.COORDINATOR);

    if (coordinators.length === 0 && swarm.agents.length > 0) {
      // Promote first agent to coordinator
      swarm.agents[0].type = AgentType.COORDINATOR;
    }
  }

  private async setupMeshTopology(swarm: Swarm): Promise<void> {
    // All agents can communicate directly - no special setup needed
    // This is the default behavior
  }

  private async setupRingTopology(swarm: Swarm): Promise<void> {
    // Setup ring communication pattern
    // Implementation would establish agent-to-agent connections in a ring
  }

  private async setupStarTopology(swarm: Swarm): Promise<void> {
    // Setup star communication pattern with central coordinator
    const coordinators = swarm.agents.filter(agent => agent.type === AgentType.COORDINATOR);

    if (coordinators.length === 0 && swarm.agents.length > 0) {
      // Make first agent the central coordinator
      swarm.agents[0].type = AgentType.COORDINATOR;
    }
  }

  private async setupAdaptiveTopology(swarm: Swarm): Promise<void> {
    // Start with mesh topology and adapt based on performance
    await this.setupMeshTopology(swarm);
  }

  private async optimizeSwarmTopology(swarm: Swarm): Promise<TopologyOptimization> {
    // Simple optimization logic - can be enhanced with ML
    const currentTopology = swarm.topology;
    const agentCount = swarm.agents.length;

    let optimalTopology = currentTopology;
    let changed = false;
    let reason = '';

    if (agentCount > 20 && currentTopology === SwarmTopology.MESH) {
      optimalTopology = SwarmTopology.HIERARCHICAL;
      changed = true;
      reason = `Switched to hierarchical topology for ${agentCount} agents`;
    } else if (agentCount <= 5 && currentTopology === SwarmTopology.HIERARCHICAL) {
      optimalTopology = SwarmTopology.MESH;
      changed = true;
      reason = `Switched to mesh topology for small agent count`;
    }

    if (changed) {
      swarm.topology = optimalTopology;
      await this.applyTopology(swarm);
      swarm.updatedAt = new Date();
    }

    return { changed, reason };
  }

  private async processTaskQueue(swarmId: string): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return;

    const availableAgents = swarm.agents.filter(agent => agent.status === AgentStatus.IDLE);
    const pendingTasks = this.taskQueue.filter(task =>
      task.status === TaskStatus.PENDING &&
      this.areDependenciesMet(task, swarm.tasks)
    );

    for (const task of pendingTasks) {
      const suitableAgent = this.findBestAgent(task, availableAgents);

      if (suitableAgent) {
        await this.assignTaskToAgent(task, suitableAgent);
        suitableAgent.status = AgentStatus.BUSY;
      }
    }
  }

  private findBestAgent(task: Task, availableAgents: Agent[]): Agent | null {
    if (availableAgents.length === 0) return null;

    // Simple matching logic - can be enhanced with ML
    const suitableAgents = availableAgents.filter(agent =>
      this.isAgentSuitableForTask(agent, task)
    );

    if (suitableAgents.length === 0) return null;

    // Select agent with lowest current load
    return suitableAgents.reduce((best, agent) =>
      agent.metrics.cpuUsage < best.metrics.cpuUsage ? agent : best
    );
  }

  private isAgentSuitableForTask(agent: Agent, task: Task): boolean {
    // Simple suitability check
    const taskAgentMap: Record<string, AgentType[]> = {
      'code_generation': [AgentType.CODER, AgentType.DEVELOPER],
      'testing': [AgentType.TESTER, AgentType.CODER],
      'documentation': [AgentType.DOCUMENTER, AgentType.API_DOCS],
      'analysis': [AgentType.ANALYST, AgentType.CODE_ANALYZER],
      'optimization': [AgentType.OPTIMIZER, AgentType.PERF_ANALYZER],
      'security_scan': [AgentType.MONITOR, AgentType.SPECIALIST],
      'performance_test': [AgentType.PERFORMANCE_BENCHMARKER, AgentType.TESTER]
    };

    const suitableTypes = taskAgentMap[task.type] || [];
    return suitableTypes.includes(agent.type);
  }

  private async assignTaskToAgent(task: Task, agent: Agent): Promise<void> {
    task.status = TaskStatus.IN_PROGRESS;
    task.assignedAgentId = agent.id;
    task.updatedAt = new Date();

    agent.status = AgentStatus.BUSY;
    agent.updatedAt = new Date();
  }

  private areDependenciesMet(task: Task, allTasks: Task[]): boolean {
    return task.dependencies.every(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask && depTask.status === TaskStatus.COMPLETED;
    });
  }

  private async reassignAgentTasks(agent: Agent): Promise<void> {
    const swarm = agent.swarmId ? this.swarms.get(agent.swarmId) : null;
    if (!swarm) return;

    const agentTasks = swarm.tasks.filter(task => task.assignedAgentId === agent.id);

    for (const task of agentTasks) {
      if (task.status === TaskStatus.IN_PROGRESS) {
        task.status = TaskStatus.PENDING;
        task.assignedAgentId = undefined;
        task.updatedAt = new Date();
      }
    }

    // Try to reassign tasks to other agents
    await this.processTaskQueue(swarm.id);
  }

  private selectAgentTypeForScaling(swarm: Swarm): AgentType {
    // Simple logic - can be enhanced with ML
    const typeCount = new Map<AgentType, number>();

    swarm.agents.forEach(agent => {
      typeCount.set(agent.type, (typeCount.get(agent.type) || 0) + 1);
    });

    // Select type with lowest count
    let minType = AgentType.CODER;
    let minCount = Infinity;

    for (const [type, count] of typeCount.entries()) {
      if (count < minCount) {
        minCount = count;
        minType = type;
      }
    }

    return minType;
  }

  private getDefaultCapabilities(agentType: AgentType): string[] {
    const capabilityMap: Record<AgentType, string[]> = {
      [AgentType.COORDINATOR]: ['coordination', 'management', 'planning'],
      [AgentType.ANALYST]: ['analysis', 'research', 'evaluation'],
      [AgentType.OPTIMIZER]: ['optimization', 'performance', 'efficiency'],
      [AgentType.DOCUMENTER]: ['documentation', 'writing', 'communication'],
      [AgentType.MONITOR]: ['monitoring', 'logging', 'alerting'],
      [AgentType.SPECIALIST]: ['specialized_tasks', 'domain_expertise'],
      [AgentType.ARCHITECT]: ['architecture', 'design', 'planning'],
      [AgentType.TASK_ORCHESTRATOR]: ['orchestration', 'coordination', 'workflow'],
      [AgentType.CODE_ANALYZER]: ['code_analysis', 'static_analysis', 'quality'],
      [AgentType.PERF_ANALYZER]: ['performance_analysis', 'benchmarking', 'optimization'],
      [AgentType.API_DOCS]: ['api_documentation', 'technical_writing'],
      [AgentType.PERFORMANCE_BENCHMARKER]: ['benchmarking', 'performance_testing'],
      [AgentType.SYSTEM_ARCHITECT]: ['system_design', 'architecture', 'scalability'],
      [AgentType.RESEARCHER]: ['research', 'investigation', 'analysis'],
      [AgentType.CODER]: ['coding', 'development', 'programming'],
      [AgentType.TESTER]: ['testing', 'quality_assurance', 'validation'],
      [AgentType.REVIEWER]: ['code_review', 'quality_control', 'analysis']
    };

    return capabilityMap[agentType] || ['general'];
  }

  private getDefaultResourceLimits(): ResourceLimits {
    return {
      maxCpuUsage: 80,
      maxMemoryUsage: 2048,
      maxTasksPerAgent: 5
    };
  }

  private async rebalanceTasks(swarm: Swarm): Promise<{ rebalanced: boolean; reason: string }> {
    // Simple task rebalancing logic
    const busyAgents = swarm.agents.filter(agent => agent.status === AgentStatus.BUSY);
    const idleAgents = swarm.agents.filter(agent => agent.status === AgentStatus.IDLE);

    if (busyAgents.length > idleAgents.length * 2) {
      return {
        rebalanced: true,
        reason: 'Detected load imbalance - triggering task redistribution'
      };
    }

    return { rebalanced: false, reason: '' };
  }

  private async optimizeResourceAllocation(swarm: Swarm): Promise<{ optimized: boolean; reason: string }> {
    // Resource optimization logic
    const overloadedAgents = swarm.agents.filter(agent =>
      agent.metrics.cpuUsage > swarm.config.resourceLimits.maxCpuUsage
    );

    if (overloadedAgents.length > 0) {
      return {
        optimized: true,
        reason: `Optimized resources for ${overloadedAgents.length} overloaded agents`
      };
    }

    return { optimized: false, reason: '' };
  }

  private calculateAverageTaskTime(tasks: Task[]): number {
    const completedTasks = tasks.filter(task =>
      task.status === TaskStatus.COMPLETED && task.result
    );

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) =>
      sum + (task.result?.metrics?.duration || 0), 0
    );

    return totalTime / completedTasks.length;
  }

  private calculateImprovement(before: SwarmMetrics, after: SwarmMetrics): number {
    // Simple improvement calculation
    const successRateImprovement = after.successRate - before.successRate;
    const taskTimeImprovement = before.averageTaskTime - after.averageTaskTime;
    const resourceImprovement = before.resourceUtilization - after.resourceUtilization;

    return (successRateImprovement + taskTimeImprovement + resourceImprovement) / 3;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting classes and interfaces

class ResourceMonitor {
  getSwarmResourceUtilization(swarmId: string): number {
    // Placeholder implementation
    return Math.random() * 100;
  }
}

interface SwarmConfig {
  name: string;
  topology: SwarmTopology;
  maxAgents?: number;
  strategy?: SwarmStrategy;
  enableAutoScaling?: boolean;
  resourceLimits?: ResourceLimits;
  initialAgents?: AgentConfig[];
}

interface AgentConfig {
  type: AgentType;
  name: string;
  capabilities: string[];
}

interface TaskConfig {
  name: string;
  description: string;
  type: string;
  priority: TaskPriority;
  dependencies?: string[];
}

interface SwarmMetrics {
  swarmId: string;
  agentCount: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  averageTaskTime: number;
  resourceUtilization: number;
}

interface OptimizationResult {
  optimizations: string[];
  beforeMetrics: SwarmMetrics;
  afterMetrics: SwarmMetrics;
  improvement: number;
}

interface TopologyOptimization {
  changed: boolean;
  reason: string;
}