import {
  PerformanceMetrics,
  CpuMetrics,
  MemoryMetrics,
  NetworkMetrics,
  AgentMetrics,
  WebSocketMessage,
  MessageType
} from '../types/index.js';
import { EventEmitter } from 'events';

/**
 * Performance Monitoring and Metrics Collection System
 * Real-time monitoring of system, agent, and application performance
 */
export class PerformanceMonitoring extends EventEmitter {
  private static instance: PerformanceMonitoring;
  private metrics: PerformanceMetrics[] = [];
  private agentMetrics: Map<string, AgentPerformanceData> = new Map();
  private customMetrics: Map<string, CustomMetric[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;
  private monitoringActive = false;
  private collectionInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.thresholds = this.getDefaultThresholds();
  }

  public static getInstance(): PerformanceMonitoring {
    if (!PerformanceMonitoring.instance) {
      PerformanceMonitoring.instance = new PerformanceMonitoring();
    }
    return PerformanceMonitoring.instance;
  }

  /**
   * Start performance monitoring with specified interval
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringActive) {
      console.log('Performance monitoring already active');
      return;
    }

    this.monitoringActive = true;
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    this.emit('monitoringStarted', { interval: intervalMs });
    console.log(`Performance monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.monitoringActive) {
      return;
    }

    this.monitoringActive = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    this.emit('monitoringStopped', { timestamp: new Date() });
    console.log('Performance monitoring stopped');
  }

  /**
   * Manually trigger metrics collection
   */
  public async collectMetrics(): Promise<PerformanceMetrics> {
    const metrics = await this.gatherSystemMetrics();
    this.metrics.push(metrics);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(metrics);

    // Emit real-time metrics update
    const message: WebSocketMessage = {
      type: MessageType.PERFORMANCE_UPDATE,
      id: this.generateId('metrics'),
      payload: metrics,
      timestamp: new Date()
    };

    this.emit('metricsCollected', message);

    return metrics;
  }

  /**
   * Register agent for performance tracking
   */
  public registerAgent(agentId: string, agentName: string): void {
    this.agentMetrics.set(agentId, {
      agentId,
      agentName,
      metrics: [],
      taskHistory: [],
      averageResponseTime: 0,
      successRate: 1.0,
      resourceEfficiency: 1.0
    });

    this.emit('agentRegistered', { agentId, agentName });
  }

  /**
   * Update agent performance metrics
   */
  public updateAgentMetrics(agentId: string, metrics: AgentMetrics): void {
    const agentData = this.agentMetrics.get(agentId);
    if (!agentData) {
      console.warn(`Agent ${agentId} not registered for performance tracking`);
      return;
    }

    const agentPerformance: AgentPerformanceSnapshot = {
      timestamp: new Date(),
      ...metrics
    };

    agentData.metrics.push(agentPerformance);

    // Keep only last 100 metrics per agent
    if (agentData.metrics.length > 100) {
      agentData.metrics = agentData.metrics.slice(-100);
    }

    // Update calculated metrics
    this.updateAgentCalculatedMetrics(agentId);

    this.emit('agentMetricsUpdated', { agentId, metrics });
  }

  /**
   * Record task execution for agent performance tracking
   */
  public recordTaskExecution(
    agentId: string,
    taskId: string,
    duration: number,
    success: boolean,
    resourceUsage?: Record<string, number>
  ): void {
    const agentData = this.agentMetrics.get(agentId);
    if (!agentData) {
      return;
    }

    const taskRecord: TaskExecutionRecord = {
      taskId,
      startTime: new Date(Date.now() - duration),
      endTime: new Date(),
      duration,
      success,
      resourceUsage: resourceUsage || {}
    };

    agentData.taskHistory.push(taskRecord);

    // Keep only last 50 tasks
    if (agentData.taskHistory.length > 50) {
      agentData.taskHistory = agentData.taskHistory.slice(-50);
    }

    // Update average metrics
    this.updateAgentCalculatedMetrics(agentId);

    this.emit('taskExecutionRecorded', { agentId, taskRecord });
  }

  /**
   * Add custom metric for tracking
   */
  public addCustomMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    const metric: CustomMetric = {
      name,
      value,
      timestamp: new Date(),
      tags: tags || {}
    };

    if (!this.customMetrics.has(name)) {
      this.customMetrics.set(name, []);
    }

    const metrics = this.customMetrics.get(name)!;
    metrics.push(metric);

    // Keep only last 500 metrics per custom metric
    if (metrics.length > 500) {
      metrics.splice(0, metrics.length - 500);
    }

    this.emit('customMetricAdded', { name, metric });
  }

  /**
   * Get performance metrics for specified time range
   */
  public getMetrics(timeRange?: {
    start: Date;
    end: Date;
  }): PerformanceMetrics[] {
    if (!timeRange) {
      return this.metrics;
    }

    return this.metrics.filter(metric =>
      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );
  }

  /**
   * Get agent performance data
   */
  public getAgentMetrics(agentId?: string): Map<string, AgentPerformanceData> | AgentPerformanceData | null {
    if (agentId) {
      return this.agentMetrics.get(agentId) || null;
    }
    return this.agentMetrics;
  }

  /**
   * Get custom metrics
   */
  public getCustomMetrics(name?: string): Map<string, CustomMetric[]> | CustomMetric[] {
    if (name) {
      return this.customMetrics.get(name) || [];
    }
    return this.customMetrics;
  }

  /**
   * Get performance alerts
   */
  public getAlerts(severity?: 'low' | 'medium' | 'high' | 'critical'): PerformanceAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return this.alerts;
  }

  /**
   * Set performance thresholds for alerting
   */
  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.emit('thresholdsUpdated', this.thresholds);
  }

  /**
   * Generate performance report
   */
  public generatePerformanceReport(timeRange?: {
    start: Date;
    end: Date;
  }): PerformanceReport {
    const metrics = this.getMetrics(timeRange);
    const agentData = Array.from(this.agentMetrics.values());

    return {
      timeRange: timeRange || {
        start: metrics[0]?.timestamp || new Date(),
        end: metrics[metrics.length - 1]?.timestamp || new Date()
      },
      systemMetrics: this.analyzeSystemMetrics(metrics),
      agentPerformance: this.analyzeAgentPerformance(agentData),
      alerts: this.getAlerts().filter(alert =>
        !timeRange || (alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end)
      ),
      recommendations: this.generatePerformanceRecommendations(metrics, agentData)
    };
  }

  /**
   * Run performance benchmarks
   */
  public async runBenchmarks(config?: BenchmarkConfig): Promise<BenchmarkResults> {
    const benchmarks = config?.benchmarks || this.getDefaultBenchmarks();
    const results: BenchmarkResults = {
      timestamp: new Date(),
      config: config || {},
      results: []
    };

    for (const benchmark of benchmarks) {
      try {
        const result = await this.executeBenchmark(benchmark);
        results.results.push(result);
      } catch (error) {
        results.results.push({
          name: benchmark.name,
          score: 0,
          duration: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.emit('benchmarksCompleted', results);
    return results;
  }

  /**
   * Analyze performance bottlenecks
   */
  public analyzeBottlenecks(timeRange?: {
    start: Date;
    end: Date;
  }): BottleneckAnalysis {
    const metrics = this.getMetrics(timeRange);
    const agentData = Array.from(this.agentMetrics.values());

    const bottlenecks: PerformanceBottleneck[] = [];

    // Analyze CPU bottlenecks
    const highCpuMetrics = metrics.filter(m => m.cpu.usage > this.thresholds.cpu.maxUsage);
    if (highCpuMetrics.length > 0) {
      bottlenecks.push({
        type: 'cpu',
        severity: this.calculateBottleneckSeverity(highCpuMetrics.length, metrics.length),
        description: `${highCpuMetrics.length} instances of high CPU usage detected`,
        affectedComponents: ['system'],
        recommendations: ['Consider scaling up resources', 'Optimize CPU-intensive operations']
      });
    }

    // Analyze memory bottlenecks
    const highMemoryMetrics = metrics.filter(m => m.memory.percentage > this.thresholds.memory.maxPercentage);
    if (highMemoryMetrics.length > 0) {
      bottlenecks.push({
        type: 'memory',
        severity: this.calculateBottleneckSeverity(highMemoryMetrics.length, metrics.length),
        description: `${highMemoryMetrics.length} instances of high memory usage detected`,
        affectedComponents: ['system'],
        recommendations: ['Check for memory leaks', 'Consider increasing available memory']
      });
    }

    // Analyze agent performance bottlenecks
    for (const agent of agentData) {
      if (agent.averageResponseTime > this.thresholds.agent.maxResponseTime) {
        bottlenecks.push({
          type: 'agent_performance',
          severity: 'medium',
          description: `Agent ${agent.agentName} has high average response time`,
          affectedComponents: [agent.agentId],
          recommendations: ['Optimize agent task execution', 'Review agent resource allocation']
        });
      }
    }

    return {
      timestamp: new Date(),
      bottlenecks,
      overallHealth: this.calculateOverallHealth(bottlenecks),
      priorityActions: this.getPriorityActions(bottlenecks)
    };
  }

  // Private methods

  private async gatherSystemMetrics(): Promise<PerformanceMetrics> {
    const cpuMetrics = await this.getCpuMetrics();
    const memoryMetrics = await this.getMemoryMetrics();
    const networkMetrics = await this.getNetworkMetrics();

    return {
      timestamp: new Date(),
      cpu: cpuMetrics,
      memory: memoryMetrics,
      network: networkMetrics,
      custom: this.getCurrentCustomMetrics()
    };
  }

  private async getCpuMetrics(): Promise<CpuMetrics> {
    // This would use system libraries to get actual CPU metrics
    // For now, return simulated data
    return {
      usage: Math.random() * 100,
      loadAverage: [
        Math.random() * 2,
        Math.random() * 2,
        Math.random() * 2
      ],
      cores: 4 // Would detect actual core count
    };
  }

  private async getMemoryMetrics(): Promise<MemoryMetrics> {
    // This would use system libraries to get actual memory metrics
    const total = 8000; // MB
    const used = Math.random() * total * 0.8;
    const free = total - used;

    return {
      used,
      free,
      total,
      percentage: (used / total) * 100
    };
  }

  private async getNetworkMetrics(): Promise<NetworkMetrics> {
    // This would use system libraries to get actual network metrics
    // For now, return simulated incremental data
    return {
      bytesIn: Math.floor(Math.random() * 1000000),
      bytesOut: Math.floor(Math.random() * 1000000),
      packetsIn: Math.floor(Math.random() * 10000),
      packetsOut: Math.floor(Math.random() * 10000)
    };
  }

  private getCurrentCustomMetrics(): Record<string, number> {
    const custom: Record<string, number> = {};

    for (const [name, metrics] of this.customMetrics.entries()) {
      if (metrics.length > 0) {
        custom[name] = metrics[metrics.length - 1].value;
      }
    }

    return custom;
  }

  private updateAgentCalculatedMetrics(agentId: string): void {
    const agentData = this.agentMetrics.get(agentId);
    if (!agentData) return;

    const tasks = agentData.taskHistory;
    const recentTasks = tasks.slice(-10); // Last 10 tasks

    if (recentTasks.length > 0) {
      // Calculate average response time
      agentData.averageResponseTime = recentTasks.reduce((sum, task) => sum + task.duration, 0) / recentTasks.length;

      // Calculate success rate
      const successfulTasks = recentTasks.filter(task => task.success).length;
      agentData.successRate = successfulTasks / recentTasks.length;

      // Calculate resource efficiency (simplified)
      const avgResourceUsage = recentTasks.reduce((sum, task) => {
        const totalUsage = Object.values(task.resourceUsage).reduce((a, b) => a + b, 0);
        return sum + totalUsage;
      }, 0) / recentTasks.length;

      agentData.resourceEfficiency = Math.max(0, 1 - (avgResourceUsage / 100)); // Normalize to 0-1
    }
  }

  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Check CPU threshold
    if (metrics.cpu.usage > this.thresholds.cpu.maxUsage) {
      alerts.push({
        id: this.generateId('alert'),
        type: 'cpu_high',
        severity: this.getAlertSeverity(metrics.cpu.usage, this.thresholds.cpu.maxUsage),
        message: `CPU usage (${metrics.cpu.usage.toFixed(1)}%) exceeds threshold (${this.thresholds.cpu.maxUsage}%)`,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check memory threshold
    if (metrics.memory.percentage > this.thresholds.memory.maxPercentage) {
      alerts.push({
        id: this.generateId('alert'),
        type: 'memory_high',
        severity: this.getAlertSeverity(metrics.memory.percentage, this.thresholds.memory.maxPercentage),
        message: `Memory usage (${metrics.memory.percentage.toFixed(1)}%) exceeds threshold (${this.thresholds.memory.maxPercentage}%)`,
        timestamp: new Date(),
        resolved: false
      });
    }

    // Add new alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.emit('performanceAlert', alert);
    });

    // Clean old resolved alerts
    this.alerts = this.alerts.filter(alert =>
      !alert.resolved && (Date.now() - alert.timestamp.getTime()) < 24 * 60 * 60 * 1000 // 24 hours
    );
  }

  private getAlertSeverity(value: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const excess = value - threshold;
    const excessPercentage = (excess / threshold) * 100;

    if (excessPercentage > 50) return 'critical';
    if (excessPercentage > 25) return 'high';
    if (excessPercentage > 10) return 'medium';
    return 'low';
  }

  private analyzeSystemMetrics(metrics: PerformanceMetrics[]): SystemMetricsAnalysis {
    if (metrics.length === 0) {
      return {
        averageCpuUsage: 0,
        averageMemoryUsage: 0,
        peakCpuUsage: 0,
        peakMemoryUsage: 0,
        uptime: 0
      };
    }

    const cpuUsages = metrics.map(m => m.cpu.usage);
    const memoryUsages = metrics.map(m => m.memory.percentage);

    return {
      averageCpuUsage: cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length,
      averageMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      peakCpuUsage: Math.max(...cpuUsages),
      peakMemoryUsage: Math.max(...memoryUsages),
      uptime: metrics.length > 1 ? metrics[metrics.length - 1].timestamp.getTime() - metrics[0].timestamp.getTime() : 0
    };
  }

  private analyzeAgentPerformance(agentData: AgentPerformanceData[]): AgentPerformanceAnalysis {
    if (agentData.length === 0) {
      return {
        totalAgents: 0,
        activeAgents: 0,
        averageResponseTime: 0,
        overallSuccessRate: 0,
        topPerformers: [],
        needsAttention: []
      };
    }

    const activeAgents = agentData.filter(agent => agent.taskHistory.length > 0);
    const responseTimes = activeAgents.map(agent => agent.averageResponseTime);
    const successRates = activeAgents.map(agent => agent.successRate);

    const sortedByEfficiency = [...activeAgents].sort((a, b) => b.resourceEfficiency - a.resourceEfficiency);
    const sortedByResponseTime = [...activeAgents].sort((a, b) => a.averageResponseTime - b.averageResponseTime);

    return {
      totalAgents: agentData.length,
      activeAgents: activeAgents.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      overallSuccessRate: successRates.reduce((a, b) => a + b, 0) / successRates.length,
      topPerformers: sortedByEfficiency.slice(0, 3).map(agent => agent.agentId),
      needsAttention: sortedByResponseTime.slice(-3).map(agent => agent.agentId)
    };
  }

  private generatePerformanceRecommendations(
    metrics: PerformanceMetrics[],
    agentData: AgentPerformanceData[]
  ): string[] {
    const recommendations: string[] = [];

    const systemAnalysis = this.analyzeSystemMetrics(metrics);

    if (systemAnalysis.averageCpuUsage > 70) {
      recommendations.push('Consider scaling up resources to handle high CPU usage');
    }

    if (systemAnalysis.averageMemoryUsage > 80) {
      recommendations.push('Monitor for memory leaks and consider increasing available memory');
    }

    const slowAgents = agentData.filter(agent => agent.averageResponseTime > 5000);
    if (slowAgents.length > 0) {
      recommendations.push(`${slowAgents.length} agents show slow response times - consider optimization`);
    }

    const lowSuccessRateAgents = agentData.filter(agent => agent.successRate < 0.9);
    if (lowSuccessRateAgents.length > 0) {
      recommendations.push(`${lowSuccessRateAgents.length} agents have low success rates - review error handling`);
    }

    return recommendations;
  }

  private async executeBenchmark(benchmark: Benchmark): Promise<BenchmarkResult> {
    const startTime = Date.now();

    switch (benchmark.type) {
      case 'cpu':
        return this.runCpuBenchmark(benchmark);
      case 'memory':
        return this.runMemoryBenchmark(benchmark);
      case 'network':
        return this.runNetworkBenchmark(benchmark);
      default:
        throw new Error(`Unknown benchmark type: ${benchmark.type}`);
    }
  }

  private async runCpuBenchmark(benchmark: Benchmark): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const iterations = benchmark.config?.iterations || 1000000;

    // Perform CPU-intensive task
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }

    const duration = Date.now() - startTime;
    const score = iterations / duration; // Operations per millisecond

    return {
      name: benchmark.name,
      score,
      duration,
      success: true
    };
  }

  private async runMemoryBenchmark(benchmark: Benchmark): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const size = benchmark.config?.size || 1000000;

    // Allocate and manipulate memory
    const array = new Array(size);
    for (let i = 0; i < size; i++) {
      array[i] = Math.random() * 1000;
    }

    // Sort the array
    array.sort((a, b) => a - b);

    const duration = Date.now() - startTime;
    const score = size / duration; // Elements per millisecond

    return {
      name: benchmark.name,
      score,
      duration,
      success: true
    };
  }

  private async runNetworkBenchmark(benchmark: Benchmark): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const url = benchmark.config?.url || 'https://httpbin.org/get';

    try {
      const response = await fetch(url);
      await response.text();

      const duration = Date.now() - startTime;
      const score = 1000 / duration; // Requests per second

      return {
        name: benchmark.name,
        score,
        duration,
        success: true
      };
    } catch (error) {
      return {
        name: benchmark.name,
        score: 0,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getDefaultBenchmarks(): Benchmark[] {
    return [
      {
        name: 'CPU Performance',
        type: 'cpu',
        config: { iterations: 1000000 }
      },
      {
        name: 'Memory Performance',
        type: 'memory',
        config: { size: 1000000 }
      },
      {
        name: 'Network Performance',
        type: 'network',
        config: { url: 'https://httpbin.org/get' }
      }
    ];
  }

  private calculateBottleneckSeverity(occurrences: number, total: number): 'low' | 'medium' | 'high' {
    const percentage = (occurrences / total) * 100;
    if (percentage > 20) return 'high';
    if (percentage > 10) return 'medium';
    return 'low';
  }

  private calculateOverallHealth(bottlenecks: PerformanceBottleneck[]): number {
    if (bottlenecks.length === 0) return 100;

    const severityWeights = { low: 1, medium: 2, high: 3 };
    const totalWeight = bottlenecks.reduce((sum, b) => sum + severityWeights[b.severity], 0);

    return Math.max(0, 100 - (totalWeight * 10));
  }

  private getPriorityActions(bottlenecks: PerformanceBottleneck[]): string[] {
    return bottlenecks
      .filter(b => b.severity === 'high')
      .flatMap(b => b.recommendations)
      .slice(0, 5); // Top 5 priority actions
  }

  private getDefaultThresholds(): PerformanceThresholds {
    return {
      cpu: { maxUsage: 80, maxLoadAverage: 2.0 },
      memory: { maxPercentage: 85, maxUsedMB: 6000 },
      network: { maxBytesPerSecond: 1000000 },
      agent: { maxResponseTime: 5000, minSuccessRate: 0.9 }
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Type definitions
interface AgentPerformanceData {
  agentId: string;
  agentName: string;
  metrics: AgentPerformanceSnapshot[];
  taskHistory: TaskExecutionRecord[];
  averageResponseTime: number;
  successRate: number;
  resourceEfficiency: number;
}

interface AgentPerformanceSnapshot extends AgentMetrics {
  timestamp: Date;
}

interface TaskExecutionRecord {
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  resourceUsage: Record<string, number>;
}

interface CustomMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
}

interface PerformanceAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface PerformanceThresholds {
  cpu: {
    maxUsage: number;
    maxLoadAverage: number;
  };
  memory: {
    maxPercentage: number;
    maxUsedMB: number;
  };
  network: {
    maxBytesPerSecond: number;
  };
  agent: {
    maxResponseTime: number;
    minSuccessRate: number;
  };
}

interface PerformanceReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  systemMetrics: SystemMetricsAnalysis;
  agentPerformance: AgentPerformanceAnalysis;
  alerts: PerformanceAlert[];
  recommendations: string[];
}

interface SystemMetricsAnalysis {
  averageCpuUsage: number;
  averageMemoryUsage: number;
  peakCpuUsage: number;
  peakMemoryUsage: number;
  uptime: number;
}

interface AgentPerformanceAnalysis {
  totalAgents: number;
  activeAgents: number;
  averageResponseTime: number;
  overallSuccessRate: number;
  topPerformers: string[];
  needsAttention: string[];
}

interface BenchmarkConfig {
  benchmarks?: Benchmark[];
  timeout?: number;
  iterations?: number;
}

interface Benchmark {
  name: string;
  type: 'cpu' | 'memory' | 'network' | 'custom';
  config?: Record<string, any>;
}

interface BenchmarkResults {
  timestamp: Date;
  config: BenchmarkConfig;
  results: BenchmarkResult[];
}

interface BenchmarkResult {
  name: string;
  score: number;
  duration: number;
  success: boolean;
  error?: string;
}

interface BottleneckAnalysis {
  timestamp: Date;
  bottlenecks: PerformanceBottleneck[];
  overallHealth: number;
  priorityActions: string[];
}

interface PerformanceBottleneck {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedComponents: string[];
  recommendations: string[];
}