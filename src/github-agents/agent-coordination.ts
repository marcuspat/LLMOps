import { EventEmitter } from 'events';
import { GitHubWebhookHandler } from './webhook-handlers';

/**
 * Agent coordination system for GitHub agents
 * Handles inter-agent communication, task distribution, and shared state management
 */
export class GitHubAgentCoordinator extends EventEmitter {
  private agents: Map<string, GitHubAgent> = new Map();
  private sharedState: Map<string, any> = new Map();
  private taskQueue: AgentTask[] = [];
  private activeAgents: Set<string> = new Set();
  private metrics: AgentMetrics = {
    tasksProcessed: 0,
    tasksSuccessful: 0,
    tasksFailed: 0,
    averageProcessingTime: 0
  };

  constructor(private config: AgentCoordinatorConfig) {
    super();
    this.setupEventHandlers();
  }

  /**
   * Register a new agent with the coordinator
   */
  async registerAgent(agent: GitHubAgent): Promise<void> {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} is already registered`);
    }

    this.agents.set(agent.id, agent);
    this.activeAgents.add(agent.id);

    // Set up agent event listeners
    agent.on('task:started', (task) => this.handleTaskStarted(agent.id, task));
    agent.on('task:completed', (task) => this.handleTaskCompleted(agent.id, task));
    agent.on('task:failed', (task, error) => this.handleTaskFailed(agent.id, task, error));
    agent.on('state:changed', (state) => this.handleAgentStateChanged(agent.id, state));

    console.log(`Agent ${agent.id} (${agent.name}) registered successfully`);
    this.emit('agent:registered', agent);
  }

  /**
   * Unregister an agent from the coordinator
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} is not registered`);
    }

    // Remove event listeners
    agent.removeAllListeners();

    this.agents.delete(agentId);
    this.activeAgents.delete(agentId);

    console.log(`Agent ${agentId} unregistered successfully`);
    this.emit('agent:unregistered', agentId);
  }

  /**
   * Distribute a task to the appropriate agent(s)
   */
  async distributeTask(task: AgentTask): Promise<string[]> {
    const suitableAgents = this.findSuitableAgents(task);

    if (suitableAgents.length === 0) {
      throw new Error(`No suitable agents found for task type: ${task.type}`);
    }

    const assignedAgents: string[] = [];

    for (const agentId of suitableAgents) {
      const agent = this.agents.get(agentId);
      if (agent && this.isAgentAvailable(agentId)) {
        try {
          await agent.assignTask(task);
          assignedAgents.push(agentId);

          // Update shared state with task assignment
          this.updateSharedState(`task:${task.id}:agent`, agentId);
          this.updateSharedState(`agent:${agentId}:current_task`, task);

          console.log(`Task ${task.id} assigned to agent ${agentId}`);
        } catch (error) {
          console.error(`Failed to assign task ${task.id} to agent ${agentId}:`, error);
        }
      }
    }

    if (assignedAgents.length === 0) {
      // Queue the task if no agents are available
      this.taskQueue.push(task);
      console.log(`Task ${task.id} queued - no available agents`);
    }

    this.emit('task:distributed', task, assignedAgents);
    return assignedAgents;
  }

  /**
   * Find agents suitable for a specific task
   */
  private findSuitableAgents(task: AgentTask): string[] {
    const suitableAgents: string[] = [];

    for (const [agentId, agent] of this.agents) {
      if (agent.capabilities.includes(task.type) &&
          agent.status === 'idle' &&
          this.isAgentAvailable(agentId)) {
        suitableAgents.push(agentId);
      }
    }

    // Sort by workload (less busy agents first)
    suitableAgents.sort((a, b) => {
      const workloadA = this.getAgentWorkload(a);
      const workloadB = this.getAgentWorkload(b);
      return workloadA - workloadB;
    });

    return suitableAgents;
  }

  /**
   * Check if an agent is available for new tasks
   */
  private isAgentAvailable(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    return agent.status === 'idle' &&
           !agent.isOverloaded() &&
           agent.isHealthy();
  }

  /**
   * Get current workload of an agent
   */
  private getAgentWorkload(agentId: string): number {
    const agent = this.agents.get(agentId);
    if (!agent) return 0;

    return agent.getCurrentWorkload();
  }

  /**
   * Update shared state across agents
   */
  updateSharedState(key: string, value: any): void {
    const oldValue = this.sharedState.get(key);
    this.sharedState.set(key, value);

    this.emit('state:updated', key, value, oldValue);

    // Notify agents that subscribe to this state key
    this.notifyStateSubscribers(key, value);
  }

  /**
   * Get shared state value
   */
  getSharedState(key: string): any {
    return this.sharedState.get(key);
  }

  /**
   * Setup event handlers for the coordinator
   */
  private setupEventHandlers(): void {
    this.on('agent:registered', (agent) => {
      this.handleAgentRegistration(agent);
    });

    this.on('task:distributed', (task, agents) => {
      this.updateMetrics('tasksDistributed', 1);
    });

    // Periodic health checks
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Periodic task queue processing
    setInterval(() => {
      this.processTaskQueue();
    }, this.config.taskQueueInterval);
  }

  /**
   * Handle agent registration
   */
  private handleAgentRegistration(agent: GitHubAgent): void {
    // Initialize agent-specific shared state
    this.updateSharedState(`agent:${agent.id}:status`, agent.status);
    this.updateSharedState(`agent:${agent.id}:workload`, 0);
    this.updateSharedState(`agent:${agent.id}:last_activity`, new Date());
  }

  /**
   * Handle task started event
   */
  private handleTaskStarted(agentId: string, task: AgentTask): void {
    this.updateSharedState(`task:${task.id}:status`, 'started');
    this.updateSharedState(`task:${task.id}:started_at`, new Date());
    this.updateSharedState(`agent:${agentId}:last_activity`, new Date());

    console.log(`Task ${task.id} started by agent ${agentId}`);
  }

  /**
   * Handle task completed event
   */
  private handleTaskCompleted(agentId: string, task: AgentTask): void {
    const processingTime = Date.now() - task.startedAt;

    this.updateSharedState(`task:${task.id}:status`, 'completed');
    this.updateSharedState(`task:${task.id}:completed_at`, new Date());
    this.updateSharedState(`task:${task.id}:processing_time`, processingTime);

    // Clean up agent state
    this.updateSharedState(`agent:${agentId}:current_task`, null);

    // Update metrics
    this.metrics.tasksProcessed++;
    this.metrics.tasksSuccessful++;
    this.updateAverageProcessingTime(processingTime);

    console.log(`Task ${task.id} completed by agent ${agentId} in ${processingTime}ms`);
    this.emit('task:completed', task, agentId);
  }

  /**
   * Handle task failed event
   */
  private handleTaskFailed(agentId: string, task: AgentTask, error: Error): void {
    this.updateSharedState(`task:${task.id}:status`, 'failed');
    this.updateSharedState(`task:${task.id}:failed_at`, new Date());
    this.updateSharedState(`task:${task.id}:error`, error.message);

    // Clean up agent state
    this.updateSharedState(`agent:${agentId}:current_task`, null);

    // Update metrics
    this.metrics.tasksProcessed++;
    this.metrics.tasksFailed++;

    console.error(`Task ${task.id} failed by agent ${agentId}:`, error);
    this.emit('task:failed', task, agentId, error);
  }

  /**
   * Handle agent state change event
   */
  private handleAgentStateChanged(agentId: string, state: any): void {
    this.updateSharedState(`agent:${agentId}:status`, state.status);

    if (state.status === 'idle' && this.taskQueue.length > 0) {
      // Try to assign queued tasks to now-idle agent
      this.processTaskQueue();
    }
  }

  /**
   * Notify agents that subscribe to state changes
   */
  private notifyStateSubscribers(key: string, value: any): void {
    for (const [agentId, agent] of this.agents) {
      if (agent.subscribesTo(key)) {
        agent.onStateChange(key, value);
      }
    }
  }

  /**
   * Perform health checks on all agents
   */
  private async performHealthChecks(): Promise<void> {
    for (const [agentId, agent] of this.agents) {
      try {
        const isHealthy = await agent.healthCheck();

        if (!isHealthy) {
          console.warn(`Agent ${agentId} failed health check`);
          this.emit('agent:unhealthy', agentId);
        }
      } catch (error) {
        console.error(`Health check failed for agent ${agentId}:`, error);
        this.emit('agent:health_check_failed', agentId, error);
      }
    }
  }

  /**
   * Process queued tasks
   */
  private async processTaskQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    const tasksToProcess = [...this.taskQueue];
    this.taskQueue = [];

    for (const task of tasksToProcess) {
      try {
        await this.distributeTask(task);
      } catch (error) {
        console.error(`Failed to distribute queued task ${task.id}:`, error);
        // Re-queue the task if it still failed
        this.taskQueue.push(task);
      }
    }
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const totalTasks = this.metrics.tasksProcessed;
    const currentAverage = this.metrics.averageProcessingTime;

    this.metrics.averageProcessingTime =
      (currentAverage * (totalTasks - 1) + processingTime) / totalTasks;
  }

  /**
   * Get current metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  /**
   * Get agent status overview
   */
  getAgentStatus(): AgentStatusOverview {
    const status: AgentStatusOverview = {
      total: this.agents.size,
      active: this.activeAgents.size,
      idle: 0,
      busy: 0,
      unhealthy: 0
    };

    for (const [agentId, agent] of this.agents) {
      switch (agent.status) {
        case 'idle':
          status.idle++;
          break;
        case 'busy':
          status.busy++;
          break;
        case 'unhealthy':
          status.unhealthy++;
          break;
      }
    }

    return status;
  }

  /**
   * Gracefully shutdown all agents
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down GitHub agent coordinator...');

    // Stop accepting new tasks
    this.activeAgents.clear();

    // Wait for current tasks to complete or timeout
    const shutdownTimeout = this.config.shutdownTimeout;
    const startTime = Date.now();

    while (this.hasActiveTasks() && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Force shutdown remaining agents
    for (const [agentId, agent] of this.agents) {
      try {
        await agent.shutdown();
        console.log(`Agent ${agentId} shutdown successfully`);
      } catch (error) {
        console.error(`Error shutting down agent ${agentId}:`, error);
      }
    }

    this.agents.clear();
    this.taskQueue = [];
    console.log('GitHub agent coordinator shutdown complete');
  }

  private hasActiveTasks(): boolean {
    for (const agent of this.agents.values()) {
      if (agent.status === 'busy') return true;
    }
    return false;
  }
}

// Agent interface
export interface GitHubAgent extends EventEmitter {
  id: string;
  name: string;
  capabilities: string[];
  status: 'idle' | 'busy' | 'unhealthy';

  assignTask(task: AgentTask): Promise<void>;
  getCurrentWorkload(): number;
  isOverloaded(): boolean;
  isHealthy(): boolean;
  healthCheck(): Promise<boolean>;
  subscribesTo(key: string): boolean;
  onStateChange(key: string, value: any): void;
  shutdown(): Promise<void>;
}

// Task interface
export interface AgentTask {
  id: string;
  type: string;
  priority: number;
  data: any;
  startedAt: number;
  timeout?: number;
}

// Metrics interface
export interface AgentMetrics {
  tasksProcessed: number;
  tasksSuccessful: number;
  tasksFailed: number;
  averageProcessingTime: number;
}

// Status overview interface
export interface AgentStatusOverview {
  total: number;
  active: number;
  idle: number;
  busy: number;
  unhealthy: number;
}

// Configuration interface
export interface AgentCoordinatorConfig {
  healthCheckInterval: number;
  taskQueueInterval: number;
  shutdownTimeout: number;
  maxConcurrentTasks: number;
}