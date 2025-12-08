/**
 * Test Execution Monitoring and Stability Scoring System
 * Provides comprehensive monitoring, analysis, and stability scoring for test executions
 */

import { TestExecutionContext, TestFailure, TestEnvironment } from './framework.js';

export interface MonitoringConfig {
  enableRealTimeMonitoring: boolean;
  enablePerformanceTracking: boolean;
  enableStabilityScoring: boolean;
  enablePatternAnalysis: boolean;
  reportingInterval: number;
  scoreUpdateInterval: number;
  alertThresholds: {
    stabilityThreshold: number;
    failureRateThreshold: number;
    performanceThreshold: number;
    consecutiveFailuresThreshold: number;
  };
}

export interface TestExecutionRecord {
  id: string;
  testName: string;
  testFile: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  error?: Error;
  environment: TestEnvironment;
  retryCount: number;
  memoryUsage: {
    initial: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    final: NodeJS.MemoryUsage;
  };
  cpuUsage: {
    initial: NodeJS.CpuUsage;
    peak: NodeJS.CpuUsage;
    final: NodeJS.CpuUsage;
  };
  metadata: {
    testSuite?: string;
    testType?: string;
    tags?: string[];
    priority?: string;
  };
}

export interface StabilityScore {
  testName: string;
  overallScore: number;
  components: {
    consistency: number;
    reliability: number;
    performance: number;
    predictability: number;
  };
  trend: 'improving' | 'declining' | 'stable';
  recommendations: string[];
  lastUpdated: Date;
}

export interface PerformanceMetrics {
  testName: string;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  memoryPeak: number;
  memoryLeak: boolean;
  cpuPeak: number;
  performanceRegression: boolean;
}

export interface FlakyTestAnalysis {
  testName: string;
  flakinessScore: number;
  failurePatterns: string[];
  rootCauses: string[];
  affectedTests: string[];
  environmentFactors: string[];
  recommendations: string[];
  confidence: number;
}

export interface MonitoringAlert {
  id: string;
  type: 'stability' | 'performance' | 'pattern' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  testName?: string;
  message: string;
  details: any;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Test Execution Monitor
 */
export class TestExecutionMonitor {
  private static instance: TestExecutionMonitor;
  private config: MonitoringConfig;
  private executions = new Map<string, TestExecutionRecord>();
  private stabilityScores = new Map<string, StabilityScore>();
  private performanceMetrics = new Map<string, PerformanceMetrics>();
  private alerts: MonitoringAlert[] = [];
  private listeners = new Map<string, (event: any) => void>();
  private monitoringActive = false;
  private performanceTracker: any;
  private memoryTracker: any;
  private cpuTracker: any;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: true,
      enablePerformanceTracking: true,
      enableStabilityScoring: true,
      enablePatternAnalysis: true,
      reportingInterval: 60000, // 1 minute
      scoreUpdateInterval: 30000, // 30 seconds
      alertThresholds: {
        stabilityThreshold: 0.8,
        failureRateThreshold: 0.2,
        performanceThreshold: 5000, // 5 seconds
        consecutiveFailuresThreshold: 3
      },
      ...config
    };
  }

  static getInstance(config?: Partial<MonitoringConfig>): TestExecutionMonitor {
    if (!TestExecutionMonitor.instance) {
      TestExecutionMonitor.instance = new TestExecutionMonitor(config);
    }
    return TestExecutionMonitor.instance;
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (this.monitoringActive) {
      return;
    }

    this.monitoringActive = true;

    if (this.config.enableRealTimeMonitoring) {
      this.setupRealTimeMonitoring();
    }

    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceTracking();
    }

    this.emitEvent('monitoring:started', {
      timestamp: new Date(),
      config: this.config
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.monitoringActive) {
      return;
    }

    this.monitoringActive = false;

    if (this.performanceTracker) {
      clearInterval(this.performanceTracker);
    }

    if (this.memoryTracker) {
      clearInterval(this.memoryTracker);
    }

    if (this.cpuTracker) {
      clearInterval(this.cpuTracker);
    }

    this.emitEvent('monitoring:stopped', {
      timestamp: new Date(),
      stats: this.getMonitoringStats()
    });
  }

  /**
   * Start monitoring a test execution
   */
  startTestExecution(
    testName: string,
    testFile: string,
    metadata?: TestExecutionRecord['metadata']
  ): string {
    const executionId = `${testName}_${Date.now()}`;
    const environment = this.captureEnvironment();

    const execution: TestExecutionRecord = {
      id: executionId,
      testName,
      testFile,
      startTime: Date.now(),
      status: 'running',
      environment,
      retryCount: 0,
      memoryUsage: {
        initial: environment.memoryUsage,
        peak: environment.memoryUsage,
        final: environment.memoryUsage
      },
      cpuUsage: {
        initial: environment.cpuUsage,
        peak: environment.cpuUsage,
        final: environment.cpuUsage
      },
      metadata: metadata || {}
    };

    this.executions.set(executionId, execution);

    this.emitEvent('test:started', {
      executionId,
      testName,
      testFile,
      metadata
    });

    return executionId;
  }

  /**
   * Complete test execution
   */
  completeTestExecution(
    executionId: string,
    status: TestExecutionRecord['status'],
    error?: Error
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      console.warn(`Execution not found: ${executionId}`);
      return;
    }

    execution.endTime = Date.now();
    execution.duration = execution.endTime - execution.startTime;
    execution.status = status;

    if (error) {
      execution.error = error;
    }

    // Update final resource usage
    execution.memoryUsage.final = process.memoryUsage();
    execution.cpuUsage.final = process.cpuUsage();

    // Update performance metrics
    this.updatePerformanceMetrics(execution);

    // Update stability score
    if (this.config.enableStabilityScoring) {
      this.updateStabilityScore(execution.testName);
    }

    // Check for alerts
    this.checkForAlerts(execution);

    this.executions.set(executionId, execution);

    this.emitEvent('test:completed', {
      executionId,
      testName: execution.testName,
      status,
      duration: execution.duration,
      error: error?.message
    });
  }

  /**
   * Get test execution history
   */
  getExecutionHistory(
    testName?: string,
    limit?: number,
    filter?: {
      status?: TestExecutionRecord['status'];
      timeRange?: { start: Date; end: Date };
    }
  ): TestExecutionRecord[] {
    let executions = Array.from(this.executions.values());

    // Filter by test name
    if (testName) {
      executions = executions.filter(exec => exec.testName === testName);
    }

    // Filter by status
    if (filter?.status) {
      executions = executions.filter(exec => exec.status === filter.status);
    }

    // Filter by time range
    if (filter?.timeRange) {
      executions = executions.filter(exec =>
        exec.startTime >= filter.timeRange.start.getTime() &&
        exec.startTime <= filter.timeRange.end.getTime()
      );
    }

    // Sort by start time (most recent first)
    executions.sort((a, b) => b.startTime - a.startTime);

    // Apply limit
    if (limit && limit > 0) {
      executions = executions.slice(0, limit);
    }

    return executions;
  }

  /**
   * Get stability score for a test
   */
  getStabilityScore(testName: string): StabilityScore | null {
    return this.stabilityScores.get(testName) || null;
  }

  /**
   * Get performance metrics for a test
   */
  getPerformanceMetrics(testName: string): PerformanceMetrics | null {
    return this.performanceMetrics.get(testName) || null;
  }

  /**
   * Analyze flaky test patterns
   */
  analyzeFlakyTests(): FlakyTestAnalysis[] {
    const analyses: FlakyTestAnalysis[] = [];
    const testNames = new Set<string>();

    // Collect all test names
    for (const execution of this.executions.values()) {
      testNames.add(execution.testName);
    }

    for (const testName of testNames) {
      const analysis = this.analyzeTestFlakiness(testName);
      if (analysis.flakinessScore > 0.1) { // Only include tests with some flakiness
        analyses.push(analysis);
      }
    }

    return analyses.sort((a, b) => b.flakinessScore - a.flakinessScore);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    totalTests: number;
    statusCounts: Record<string, number>;
    avgDuration: number;
    activeAlerts: number;
    monitoringActive: boolean;
    stabilityScores: number;
    performanceMetrics: number;
  } {
    const executions = Array.from(this.executions.values());
    const totalTests = executions.length;

    const statusCounts = executions.reduce((counts, exec) => {
      counts[exec.status] = (counts[exec.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const avgDuration = executions
      .filter(exec => exec.duration !== undefined)
      .reduce((sum, exec) => sum + exec.duration!, 0) /
      Math.max(1, executions.filter(exec => exec.duration !== undefined).length);

    const activeAlerts = this.alerts.filter(alert => !alert.acknowledged).length;

    return {
      totalTests,
      statusCounts,
      avgDuration,
      activeAlerts,
      monitoringActive: this.monitoringActive,
      stabilityScores: this.stabilityScores.size,
      performanceMetrics: this.performanceMetrics.size
    };
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, callback: (event: any) => void): string {
    const listenerId = `${event}_${Date.now()}_${Math.random()}`;
    this.listeners.set(listenerId, callback);
    return listenerId;
  }

  /**
   * Remove event listener
   */
  removeEventListener(listenerId: string): void {
    this.listeners.delete(listenerId);
  }

  /**
   * Get alerts
   */
  getAlerts(filter?: {
    type?: MonitoringAlert['type'];
    severity?: MonitoringAlert['severity'];
    acknowledged?: boolean;
  }): MonitoringAlert[] {
    let alerts = this.alerts;

    if (filter?.type) {
      alerts = alerts.filter(alert => alert.type === filter.type);
    }

    if (filter?.severity) {
      alerts = alerts.filter(alert => alert.severity === filter.severity);
    }

    if (filter?.acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === filter.acknowledged);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emitEvent('alert:acknowledged', { alertId, alert });
    }
  }

  /**
   * Setup real-time monitoring
   */
  private setupRealTimeMonitoring(): void {
    setInterval(() => {
      if (!this.monitoringActive) return;

      this.emitEvent('monitoring:stats', {
        timestamp: new Date(),
        stats: this.getMonitoringStats()
      });
    }, this.config.reportingInterval);
  }

  /**
   * Setup performance tracking
   */
  private setupPerformanceTracking(): void {
    this.performanceTracker = setInterval(() => {
      this.updateAllPerformanceMetrics();
    }, this.config.scoreUpdateInterval);

    this.memoryTracker = setInterval(() => {
      this.checkMemoryLeaks();
    }, 10000); // Every 10 seconds

    this.cpuTracker = setInterval(() => {
      this.checkCPUUsage();
    }, 5000); // Every 5 seconds
  }

  /**
   * Update performance metrics for execution
   */
  private updatePerformanceMetrics(execution: TestExecutionRecord): void {
    const existing = this.performanceMetrics.get(execution.testName);
    const history = this.getExecutionHistory(execution.testName, 50);
    const durations = history
      .filter(exec => exec.duration !== undefined)
      .map(exec => exec.duration!)
      .sort((a, b) => a - b);

    if (durations.length === 0) return;

    const avgDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];

    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const p95Duration = durations[p95Index] || maxDuration;
    const p99Duration = durations[p99Index] || maxDuration;

    const metrics: PerformanceMetrics = {
      testName: execution.testName,
      avgExecutionTime: avgDuration,
      minExecutionTime: minDuration,
      maxExecutionTime: maxDuration,
      p95ExecutionTime: p95Duration,
      p99ExecutionTime: p99Duration,
      memoryPeak: execution.memoryUsage.peak.heapUsed,
      memoryLeak: this.detectMemoryLeak(execution.testName),
      cpuPeak: this.calculateCPUPeak(execution),
      performanceRegression: existing ? avgDuration > existing.avgExecutionTime * 1.2 : false
    };

    this.performanceMetrics.set(execution.testName, metrics);
  }

  /**
   * Update all performance metrics
   */
  private updateAllPerformanceMetrics(): void {
    for (const execution of this.executions.values()) {
      if (execution.status === 'completed' || execution.status === 'passed') {
        this.updatePerformanceMetrics(execution);
      }
    }
  }

  /**
   * Update stability score for test
   */
  private updateStabilityScore(testName: string): void {
    const history = this.getExecutionHistory(testName, 50);
    const existingScore = this.stabilityScores.get(testName);

    if (history.length === 0) {
      return;
    }

    const totalRuns = history.length;
    const passedRuns = history.filter(exec => exec.status === 'passed').length;
    const failedRuns = history.filter(exec => exec.status === 'failed').length;

    // Calculate component scores
    const consistency = this.calculateConsistencyScore(history);
    const reliability = passedRuns / totalRuns;
    const performance = this.calculatePerformanceScore(testName);
    const predictability = this.calculatePredictabilityScore(history);

    // Calculate overall score
    const overallScore = (consistency * 0.3) + (reliability * 0.4) + (performance * 0.2) + (predictability * 0.1);

    // Determine trend
    let trend: StabilityScore['trend'] = 'stable';
    if (existingScore && existingScore.components.reliability > 0) {
      if (reliability > existingScore.components.reliability + 0.1) {
        trend = 'improving';
      } else if (reliability < existingScore.components.reliability - 0.1) {
        trend = 'declining';
      }
    }

    // Generate recommendations
    const recommendations = this.generateStabilityRecommendations(testName, history, overallScore);

    const score: StabilityScore = {
      testName,
      overallScore,
      components: {
        consistency,
        reliability,
        performance,
        predictability
      },
      trend,
      recommendations,
      lastUpdated: new Date()
    };

    this.stabilityScores.set(testName, score);
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(history: TestExecutionRecord[]): number {
    if (history.length < 3) return 1.0;

    const durations = history
      .filter(exec => exec.duration !== undefined)
      .map(exec => exec.duration!)
      .sort((a, b) => a - b);

    if (durations.length < 3) return 1.0;

    // Calculate variance (lower variance = higher consistency)
    const mean = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
    const variance = durations.reduce((sum, duration) => sum + Math.pow(duration - mean, 2), 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);

    // Convert to score (lower standard deviation = higher score)
    const coefficientOfVariation = standardDeviation / mean;
    return Math.max(0, 1 - coefficientOfVariation);
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(testName: string): number {
    const metrics = this.performanceMetrics.get(testName);
    if (!metrics) return 1.0;

    const targetTime = 3000; // 3 seconds target
    const score = Math.max(0, 1 - (metrics.avgExecutionTime / targetTime));
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate predictability score
   */
  private calculatePredictabilityScore(history: TestExecutionRecord[]): number {
    if (history.length < 5) return 0.5;

    const recent = history.slice(-10);
    const failureRate = recent.filter(exec => exec.status === 'failed').length / recent.length;

    // High predictability when failure rate is consistently low
    if (failureRate === 0) return 1.0;
    if (failureRate > 0.5) return 0.0;

    return Math.max(0, 1 - (failureRate * 2));
  }

  /**
   * Analyze test flakiness
   */
  private analyzeTestFlakiness(testName: string): FlakyTestAnalysis {
    const history = this.getExecutionHistory(testName, 20);
    const failures = history.filter(exec => exec.status === 'failed');

    const flakinessScore = failures.length / history.length;

    // Analyze failure patterns
    const failurePatterns = this.analyzeFailurePatterns(failures);

    // Identify root causes
    const rootCauses = this.identifyRootCauses(failures);

    // Check environmental factors
    const environmentFactors = this.analyzeEnvironmentalFactors(history);

    // Generate recommendations
    const recommendations = this.generateFlakyTestRecommendations(
      testName,
      history,
      failurePatterns,
      rootCauses
    );

    return {
      testName,
      flakinessScore,
      failurePatterns,
      rootCauses,
      affectedTests: [testName],
      environmentFactors,
      recommendations,
      confidence: Math.min(0.95, history.length / 10) // Confidence based on sample size
    };
  }

  /**
   * Analyze failure patterns
   */
  private analyzeFailurePatterns(failures: TestExecutionRecord[]): string[] {
    const patterns: string[] = [];
    const errorMessages = failures.map(f => (f.error?.message || '').toLowerCase());

    // Common failure patterns
    if (errorMessages.some(msg => msg.includes('timeout'))) {
      patterns.push('timeout_errors');
    }

    if (errorMessages.some(msg => msg.includes('connection') || msg.includes('network'))) {
      patterns.push('network_connectivity_issues');
    }

    if (errorMessages.some(msg => msg.includes('memory') || msg.includes('heap'))) {
      patterns.push('memory_issues');
    }

    if (errorMessages.some(msg => msg.includes('race') || msg.includes('async'))) {
      patterns.push('race_conditions');
    }

    if (errorMessages.some(msg => msg.includes('undefined') || msg.includes('null'))) {
      patterns.push('null_undefined_errors');
    }

    return patterns;
  }

  /**
   * Identify root causes
   */
  private identifyRootCauses(failures: TestExecutionRecord[]): string[] {
    const causes: string[] = [];

    // Analyze timing patterns
    const durations = failures.map(f => f.duration || 0);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);

    if (maxDuration > avgDuration * 3) {
      causes.push('inconsistent_execution_times');
    }

    // Analyze retry patterns
    const consecutiveFailures = this.findConsecutiveFailures(failures);
    if (consecutiveFailures >= 3) {
      causes.push('persistent_failure_mode');
    }

    // Analyze environment changes
    const environmentChanges = this.analyzeEnvironmentChanges(failures);
    if (environmentChanges.length > 0) {
      causes.push('environmental_variability');
    }

    return causes;
  }

  /**
   * Analyze environmental factors
   */
  private analyzeEnvironmentalFactors(history: TestExecutionRecord[]): string[] {
    const factors: string[] = [];
    const memoryUsages = history.map(h => h.memoryUsage.peak.heapUsed);

    if (Math.max(...memoryUsages) > 500 * 1024 * 1024) { // 500MB
      factors.push('high_memory_usage');
    }

    const durations = history.filter(h => h.duration !== undefined).map(h => h.duration!);
    if (durations.some(d => d > 30000)) { // 30 seconds
      factors.push('slow_execution');
    }

    return factors;
  }

  /**
   * Check for alerts
   */
  private checkForAlerts(execution: TestExecutionRecord): void {
    const score = this.stabilityScores.get(execution.testName);

    // Stability alerts
    if (score && score.overallScore < this.config.alertThresholds.stabilityThreshold) {
      this.createAlert('stability', 'high', execution.testName,
        `Test stability score (${score.overallScore.toFixed(2)}) below threshold (${this.config.alertThresholds.stabilityThreshold})`,
        { score, testName: execution.testName }
      );
    }

    // Performance alerts
    const metrics = this.performanceMetrics.get(execution.testName);
    if (metrics && metrics.avgExecutionTime > this.config.alertThresholds.performanceThreshold) {
      this.createAlert('performance', 'medium', execution.testName,
        `Test execution time (${metrics.avgExecutionTime.toFixed(0)}ms) above threshold (${this.config.alertThresholds.performanceThreshold}ms)`,
        { metrics, testName: execution.testName }
      );
    }

    // Consecutive failure alerts
    const consecutiveFailures = this.findConsecutiveFailures(
      this.getExecutionHistory(execution.testName, 5)
    );
    if (consecutiveFailures >= this.config.alertThresholds.consecutiveFailuresThreshold) {
      this.createAlert('pattern', 'critical', execution.testName,
        `Test has ${consecutiveFailures} consecutive failures`,
        { consecutiveFailures, testName: execution.testName }
      );
    }
  }

  /**
   * Create alert
   */
  private createAlert(
    type: MonitoringAlert['type'],
    severity: MonitoringAlert['severity'],
    testName: string,
    message: string,
    details: any
  ): void {
    const alert: MonitoringAlert = {
      id: this.generateAlertId(),
      type,
      severity,
      testName,
      message,
      details,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.push(alert);

    // Keep only recent alerts (last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    this.emitEvent('alert:created', alert);
  }

  /**
   * Generate stability recommendations
   */
  private generateStabilityRecommendations(
    testName: string,
    history: TestExecutionRecord[],
    score: number
  ): string[] {
    const recommendations: string[] = [];

    if (score < 0.8) {
      recommendations.push('Consider adding retry logic or test isolation');
    }

    const failures = history.filter(h => h.status === 'failed');
    const timeoutFailures = failures.filter(f =>
      f.error?.message?.toLowerCase().includes('timeout')
    );

    if (timeoutFailures.length > failures.length * 0.5) {
      recommendations.push('Increase test timeout or optimize async operations');
    }

    const networkFailures = failures.filter(f =>
      f.error?.message?.toLowerCase().includes('connection') ||
      f.error?.message?.toLowerCase().includes('network')
    );

    if (networkFailures.length > 0) {
      recommendations.push('Mock network calls or ensure service availability');
    }

    return recommendations;
  }

  /**
   * Generate flaky test recommendations
   */
  private generateFlakyTestRecommendations(
    testName: string,
    history: TestExecutionRecord[],
    failurePatterns: string[],
    rootCauses: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Pattern-based recommendations
    if (failurePatterns.includes('timeout_errors')) {
      recommendations.push('Implement adaptive timeouts based on historical data');
    }

    if (failurePatterns.includes('network_connectivity_issues')) {
      recommendations.push('Use service mocking or retry logic for network-dependent tests');
    }

    if (failurePatterns.includes('race_conditions')) {
      recommendations.push('Add proper synchronization and test isolation');
    }

    // Root cause-based recommendations
    if (rootCauses.includes('inconsistent_execution_times')) {
      recommendations.push('Investigate performance bottlenecks and optimize test execution');
    }

    if (rootCauses.includes('environmental_variability')) {
      recommendations.push('Use deterministic test data and mock external dependencies');
    }

    return recommendations;
  }

  /**
   * Detect memory leaks
   */
  private detectMemoryLeak(testName: string): boolean {
    const history = this.getExecutionHistory(testName, 10);
    const memoryUsages = history.map(h => h.memoryUsage.peak.heapUsed);

    if (memoryUsages.length < 5) return false;

    // Check if memory usage is consistently increasing
    let increasingCount = 0;
    for (let i = 1; i < memoryUsages.length; i++) {
      if (memoryUsages[i] > memoryUsages[i - 1]) {
        increasingCount++;
      }
    }

    return increasingCount > memoryUsages.length * 0.7;
  }

  /**
   * Calculate CPU peak usage
   */
  private calculateCPUPeak(execution: TestExecutionRecord): number {
    const cpuUsage = execution.cpuUsage;
    const userTime = cpuUsage.final.user - cpuUsage.initial.user;
    const systemTime = cpuUsage.final.system - cpuUsage.initial.system;
    return userTime + systemTime;
  }

  /**
   * Check memory leaks
   */
  private checkMemoryLeaks(): void {
    // Implementation for memory leak detection
    const currentUsage = process.memoryUsage();

    if (currentUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
      this.createAlert('system', 'medium', undefined,
        `High memory usage detected: ${(currentUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`,
        { memoryUsage: currentUsage }
      );
    }
  }

  /**
   * Check CPU usage
   */
  private checkCPUUsage(): void {
    // Implementation for CPU usage monitoring
    const cpuUsage = process.cpuUsage();
    const currentLoad = cpuUsage.user + cpuUsage.system;

    // Alert on high CPU usage (simplified check)
    if (currentLoad > 1000000) { // 1 second of CPU time
      this.createAlert('system', 'low', undefined,
        'High CPU usage detected',
        { cpuUsage: currentLoad }
      );
    }
  }

  /**
   * Find consecutive failures
   */
  private findConsecutiveFailures(history: TestExecutionRecord[]): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const execution of history) {
      if (execution.status === 'failed') {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  /**
   * Analyze environment changes
   */
  private analyzeEnvironmentChanges(history: TestExecutionRecord[]): string[] {
    // Simplified environment change detection
    const changes: string[] = [];

    // Check for memory usage patterns
    const memoryUsages = history.map(h => h.memoryUsage.peak.heapUsed);
    const memoryVariance = this.calculateVariance(memoryUsages);

    if (memoryVariance > 0.3) {
      changes.push('memory_usage_variance');
    }

    return changes;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Capture current environment
   */
  private captureEnvironment(): TestEnvironment {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      concurrentTests: this.executions.size
    };
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit event
   */
  private emitEvent(event: string, data: any): void {
    for (const [id, listener] of this.listeners.entries()) {
      try {
        listener({ type: event, data, timestamp: new Date() });
      } catch (error) {
        console.warn(`Error in event listener ${id}:`, error);
      }
    }
  }
}

/**
 * Monitoring Decorators
 */
export function withMonitoring(config?: Partial<MonitoringConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const monitor = TestExecutionMonitor.getInstance(config);

    descriptor.value = async function (...args: any[]) {
      const testName = `${target.constructor.name}.${propertyKey}`;
      const testFile = this.testFile || 'unknown';

      const executionId = monitor.startTestExecution(testName, testFile, {
        testSuite: target.constructor.name,
        testType: 'unit' // Could be configured
      });

      try {
        const result = await originalMethod.apply(this, args);
        monitor.completeTestExecution(executionId, 'passed');
        return result;
      } catch (error) {
        monitor.completeTestExecution(executionId, 'failed', error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Global monitoring setup
 */
export function setupGlobalMonitoring(config?: Partial<MonitoringConfig>): TestExecutionMonitor {
  const monitor = TestExecutionMonitor.getInstance(config);
  monitor.startMonitoring();
  return monitor;
}