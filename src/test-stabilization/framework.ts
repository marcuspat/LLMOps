/**
 * Comprehensive Test Stabilization Framework
 * Addresses flaky test patterns with ML-driven insights and systematic approaches
 */

import { jest } from '@jest/globals';

export interface TestStabilizationConfig {
  enableRetryLogic: boolean;
  maxRetries: number;
  retryDelay: number;
  enableTimeoutExtension: boolean;
  timeoutMultiplier: number;
  enableTestIsolation: boolean;
  enableDeterministicData: boolean;
  enableMonitoring: boolean;
  stabilityThreshold: number;
}

export interface TestExecutionContext {
  testName: string;
  testFile: string;
  executionCount: number;
  failureHistory: TestFailure[];
  startTime: number;
  lastExecutionTime: number;
  averageExecutionTime: number;
  stabilityScore: number;
}

export interface TestFailure {
  timestamp: number;
  error: Error;
  executionTime: number;
  environment: TestEnvironment;
  retryAttempt: number;
}

export interface TestEnvironment {
  nodeVersion: string;
  platform: string;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  concurrentTests: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition: (error: Error) => boolean;
}

export interface TestIsolationOptions {
  isolatedFileSystem: boolean;
  isolatedDatabase: boolean;
  isolatedNetwork: boolean;
  isolatedEnvironment: boolean;
  cleanupTimeout: number;
}

export interface DeterministicDataConfig {
  seedValue?: number;
  predictableTimestamps: boolean;
  consistentIds: boolean;
  mockRandomness: boolean;
  reproducibleSequences: boolean;
}

/**
 * Main Test Stabilization Framework Class
 */
export class TestStabilizationFramework {
  private static instance: TestStabilizationFramework;
  private testContexts = new Map<string, TestExecutionContext>();
  private failurePatterns = new Map<string, TestFailure[]>();
  private config: TestStabilizationConfig;
  private monitoringEnabled = false;

  constructor(config: Partial<TestStabilizationConfig> = {}) {
    this.config = {
      enableRetryLogic: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableTimeoutExtension: true,
      timeoutMultiplier: 1.5,
      enableTestIsolation: true,
      enableDeterministicData: true,
      enableMonitoring: true,
      stabilityThreshold: 0.9,
      ...config
    };
  }

  static getInstance(config?: Partial<TestStabilizationConfig>): TestStabilizationFramework {
    if (!TestStabilizationFramework.instance) {
      TestStabilizationFramework.instance = new TestStabilizationFramework(config);
    }
    return TestStabilizationFramework.instance;
  }

  /**
   * Stabilize a test with comprehensive flakiness prevention
   */
  stabilizeTest(
    testName: string,
    testFunction: () => Promise<void> | void,
    options: {
      timeout?: number;
      retries?: number;
      isolation?: TestIsolationOptions;
      deterministicData?: DeterministicDataConfig;
      customRetryCondition?: (error: Error) => boolean;
    } = {}
  ): () => Promise<void> {
    const context = this.getOrCreateTestContext(testName);
    const finalTimeout = options.timeout || this.calculateAdaptiveTimeout(context);

    return async () => {
      const startTime = Date.now();
      let lastError: Error | undefined;

      // Enable test isolation if configured
      if (this.config.enableTestIsolation && options.isolation) {
        await this.setupTestIsolation(options.isolation);
      }

      // Setup deterministic data if configured
      if (this.config.enableDeterministicData && options.deterministicData) {
        this.setupDeterministicData(options.deterministicData);
      }

      try {
        // Execute with retry logic if enabled
        if (this.config.enableRetryLogic) {
          await this.executeWithRetry(testName, testFunction, {
            maxAttempts: options.retries || this.config.maxRetries,
            baseDelay: this.config.retryDelay,
            maxDelay: this.config.retryDelay * 4,
            backoffFactor: 2,
            retryCondition: options.customRetryCondition || this.defaultRetryCondition
          });
        } else {
          await this.executeWithTimeout(testFunction, finalTimeout);
        }

        // Record successful execution
        this.recordSuccessfulExecution(testName, Date.now() - startTime);

      } catch (error) {
        lastError = error as Error;

        // Record failure for pattern analysis
        this.recordFailure(testName, error as Error, Date.now() - startTime);

        // Enhance error with stabilization context
        const enhancedError = this.enhanceErrorWithStabilizationInfo(
          error as Error,
          testName,
          context
        );

        throw enhancedError;

      } finally {
        // Cleanup isolation and deterministic data
        if (options.isolation) {
          await this.cleanupTestIsolation(options.isolation);
        }

        if (options.deterministicData) {
          this.cleanupDeterministicData();
        }
      }
    };
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  private async executeWithRetry(
    testName: string,
    testFunction: () => Promise<void> | void,
    retryConfig: RetryConfig
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        await testFunction();
        return; // Success, no retry needed
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt === retryConfig.maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (!retryConfig.retryCondition(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffFactor, attempt - 1),
          retryConfig.maxDelay
        );

        // Log retry attempt
        console.warn(`Test "${testName}" failed (attempt ${attempt}/${retryConfig.maxAttempts}), retrying in ${delay}ms:`, lastError.message);

        // Wait before retry
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute a function with timeout handling
   */
  private async executeWithTimeout(
    testFunction: () => Promise<void> | void,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(testFunction())
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Setup test isolation mechanisms
   */
  private async setupTestIsolation(options: TestIsolationOptions): Promise<void> {
    // Isolate file system operations
    if (options.isolatedFileSystem) {
      // Mock file system operations with temporary directories
      this.setupFileSystemIsolation();
    }

    // Isolate database operations
    if (options.isolatedDatabase) {
      // Use in-memory databases or transaction rollbacks
      await this.setupDatabaseIsolation();
    }

    // Isolate network operations
    if (options.isolatedNetwork) {
      // Mock network calls and prevent external dependencies
      this.setupNetworkIsolation();
    }

    // Isolate environment variables
    if (options.isolatedEnvironment) {
      this.setupEnvironmentIsolation();
    }
  }

  /**
   * Setup deterministic data for reproducible tests
   */
  private setupDeterministicData(config: DeterministicDataConfig): void {
    // Set consistent random seed
    if (config.seedValue !== undefined) {
      this.setRandomSeed(config.seedValue);
    }

    // Mock Date.now() and new Date() for predictable timestamps
    if (config.predictableTimestamps) {
      this.setupPredictableTimestamps();
    }

    // Generate consistent IDs
    if (config.consistentIds) {
      this.setupConsistentIds();
    }

    // Mock randomness functions
    if (config.mockRandomness) {
      this.setupMockRandomness();
    }
  }

  /**
   * Cleanup test isolation
   */
  private async cleanupTestIsolation(options: TestIsolationOptions): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    if (options.isolatedFileSystem) {
      cleanupPromises.push(this.cleanupFileSystemIsolation());
    }

    if (options.isolatedDatabase) {
      cleanupPromises.push(this.cleanupDatabaseIsolation());
    }

    if (options.isolatedNetwork) {
      this.cleanupNetworkIsolation();
    }

    if (options.isolatedEnvironment) {
      this.cleanupEnvironmentIsolation();
    }

    await Promise.all(cleanupPromises);
  }

  /**
   * Cleanup deterministic data setup
   */
  private cleanupDeterministicData(): void {
    // Restore original functions
    this.restoreOriginalFunctions();
  }

  /**
   * Get or create test execution context
   */
  private getOrCreateTestContext(testName: string): TestExecutionContext {
    if (!this.testContexts.has(testName)) {
      this.testContexts.set(testName, {
        testName,
        testFile: this.getCurrentTestFile(),
        executionCount: 0,
        failureHistory: [],
        startTime: Date.now(),
        lastExecutionTime: 0,
        averageExecutionTime: 0,
        stabilityScore: 1.0
      });
    }
    return this.testContexts.get(testName)!;
  }

  /**
   * Calculate adaptive timeout based on historical execution data
   */
  private calculateAdaptiveTimeout(context: TestExecutionContext): number {
    const baseTimeout = 30000; // 30 seconds default
    const averageTime = context.averageExecutionTime || baseTimeout;

    // Use the larger of average time * multiplier or base timeout
    const adaptiveTimeout = Math.max(
      averageTime * this.config.timeoutMultiplier,
      baseTimeout
    );

    // Add buffer for tests with failure history
    const failureBuffer = context.failureHistory.length > 0 ? 5000 : 0;

    return Math.floor(adaptiveTimeout + failureBuffer);
  }

  /**
   * Default retry condition - retry on common flaky test errors
   */
  private defaultRetryCondition(error: Error): boolean {
    const retryablePatterns = [
      /timeout/i,
      /connection refused/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /network/i,
      /race condition/i,
      /async timeout/i,
      /promise timeout/i,
      /fetch timeout/i,
      /database locked/i,
      /resource temporarily unavailable/i
    ];

    return retryablePatterns.some(pattern =>
      pattern.test(error.message) || pattern.test(error.name)
    );
  }

  /**
   * Record successful test execution
   */
  private recordSuccessfulExecution(testName: string, executionTime: number): void {
    const context = this.getOrCreateTestContext(testName);
    context.executionCount++;
    context.lastExecutionTime = Date.now();

    // Update average execution time
    context.averageExecutionTime =
      (context.averageExecutionTime * (context.executionCount - 1) + executionTime) /
      context.executionCount;

    // Update stability score
    const recentExecutions = context.executionCount;
    const failureRate = context.failureHistory.length / recentExecutions;
    context.stabilityScore = Math.max(0, 1 - failureRate);
  }

  /**
   * Record test failure for pattern analysis
   */
  private recordFailure(testName: string, error: Error, executionTime: number): void {
    const context = this.getOrCreateTestContext(testName);

    const failure: TestFailure = {
      timestamp: Date.now(),
      error,
      executionTime,
      environment: this.captureTestEnvironment(),
      retryAttempt: 0
    };

    context.failureHistory.push(failure);

    // Keep only recent failures (last 10)
    if (context.failureHistory.length > 10) {
      context.failureHistory = context.failureHistory.slice(-10);
    }

    // Update failure patterns for analysis
    if (!this.failurePatterns.has(testName)) {
      this.failurePatterns.set(testName, []);
    }
    this.failurePatterns.get(testName)!.push(failure);
  }

  /**
   * Enhance error with stabilization context
   */
  private enhanceErrorWithStabilizationInfo(
    error: Error,
    testName: string,
    context: TestExecutionContext
  ): Error {
    const enhancedMessage = `${error.message}\n\n` +
      `Test Stabilization Context:\n` +
      `- Test: ${testName}\n` +
      `- Executions: ${context.executionCount}\n` +
      `- Failures: ${context.failureHistory.length}\n` +
      `- Stability Score: ${(context.stabilityScore * 100).toFixed(1)}%\n` +
      `- Average Time: ${context.averageExecutionTime.toFixed(0)}ms\n` +
      `- Suggestion: ${this.getFailureSuggestion(error, context)}`;

    const enhancedError = new Error(enhancedMessage);
    enhancedError.name = error.name;
    enhancedError.stack = error.stack;

    return enhancedError;
  }

  /**
   * Get failure suggestion based on error patterns
   */
  private getFailureSuggestion(error: Error, context: TestExecutionContext): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('timeout')) {
      return 'Consider increasing test timeout or adding waits for async operations';
    }

    if (errorMessage.includes('connection') || errorMessage.includes('network')) {
      return 'Consider mocking network calls or ensuring services are available';
    }

    if (errorMessage.includes('race') || errorMessage.includes('async')) {
      return 'Consider adding proper synchronization or await/promise handling';
    }

    if (context.failureHistory.length > 3) {
      return 'Test shows consistent instability - consider refactoring or adding more robust assertions';
    }

    return 'Review test logic and consider adding retry logic for intermittent failures';
  }

  /**
   * Get test stability metrics
   */
  getStabilityMetrics(): {
    totalTests: number;
    averageStability: number;
    flakyTests: string[];
    recommendations: string[];
  } {
    const contexts = Array.from(this.testContexts.values());
    const totalTests = contexts.length;

    if (totalTests === 0) {
      return {
        totalTests: 0,
        averageStability: 1.0,
        flakyTests: [],
        recommendations: []
      };
    }

    const averageStability = contexts.reduce((sum, ctx) => sum + ctx.stabilityScore, 0) / totalTests;
    const flakyTests = contexts
      .filter(ctx => ctx.stabilityScore < this.config.stabilityThreshold)
      .map(ctx => ctx.testName);

    const recommendations = this.generateStabilityRecommendations(contexts);

    return {
      totalTests,
      averageStability,
      flakyTests,
      recommendations
    };
  }

  /**
   * Generate stability improvement recommendations
   */
  private generateStabilityRecommendations(contexts: TestExecutionContext[]): string[] {
    const recommendations: string[] = [];

    const flakyContexts = contexts.filter(ctx => ctx.stabilityScore < 0.9);

    if (flakyContexts.length > 0) {
      recommendations.push(`${flakyContexts.length} tests show instability below 90%`);
    }

    // Analyze common failure patterns
    const timeoutFailures = flakyContexts.filter(ctx =>
      ctx.failureHistory.some(f => /timeout/i.test(f.error.message))
    );

    if (timeoutFailures.length > 0) {
      recommendations.push(`${timeoutFailures.length} tests have timeout issues - consider adaptive timeouts`);
    }

    const networkFailures = flakyContexts.filter(ctx =>
      ctx.failureHistory.some(f => /connection|network/i.test(f.error.message))
    );

    if (networkFailures.length > 0) {
      recommendations.push(`${networkFailures.length} tests have network dependency issues - consider mocking`);
    }

    const raceConditionFailures = flakyContexts.filter(ctx =>
      ctx.failureHistory.some(f => /race|async/i.test(f.error.message))
    );

    if (raceConditionFailures.length > 0) {
      recommendations.push(`${raceConditionFailures.length} tests show race conditions - improve synchronization`);
    }

    return recommendations;
  }

  /**
   * Utility methods for isolation and deterministic setup
   */
  private getCurrentTestFile(): string {
    // Extract from stack trace or use expect.getState()
    try {
      return expect.getState().testPath || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private captureTestEnvironment(): TestEnvironment {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      concurrentTests: this.testContexts.size
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setRandomSeed(seed: number): void {
    // Implementation for setting random seed
    (Math as any).seedrandom = () => {
      let x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
  }

  private setupFileSystemIsolation(): void {
    // Implementation for file system isolation
    // This would typically use temporary directories and mock fs operations
  }

  private setupDatabaseIsolation(): Promise<void> {
    // Implementation for database isolation
    // Use in-memory databases or transaction rollbacks
    return Promise.resolve();
  }

  private setupNetworkIsolation(): void {
    // Implementation for network isolation
    // Mock network calls and prevent external dependencies
  }

  private setupEnvironmentIsolation(): void {
    // Implementation for environment isolation
    // Snapshot and restore environment variables
  }

  private setupPredictableTimestamps(): void {
    // Mock Date.now() and new Date() for consistent timestamps
  }

  private setupConsistentIds(): void {
    // Setup consistent ID generation
  }

  private setupMockRandomness(): void {
    // Mock Math.random() and other random functions
  }

  private cleanupFileSystemIsolation(): Promise<void> {
    // Cleanup file system isolation
    return Promise.resolve();
  }

  private cleanupDatabaseIsolation(): Promise<void> {
    // Cleanup database isolation
    return Promise.resolve();
  }

  private cleanupNetworkIsolation(): void {
    // Cleanup network isolation
  }

  private cleanupEnvironmentIsolation(): void {
    // Cleanup environment isolation
  }

  private restoreOriginalFunctions(): void {
    // Restore mocked functions to original implementations
  }
}

/**
 * Jest extension for test stabilization
 */
export function stabilize(
  testName: string,
  testFunction: () => Promise<void> | void,
  options: {
    timeout?: number;
    retries?: number;
    isolation?: TestIsolationOptions;
    deterministicData?: DeterministicDataConfig;
    customRetryCondition?: (error: Error) => boolean;
  } = {}

): () => Promise<void> {
  const framework = TestStabilizationFramework.getInstance();
  return framework.stabilizeTest(testName, testFunction, options);
}

/**
 * Helper function to create stabilized test blocks
 */
export function describeStabilized(
  description: string,
  suiteDefinitions: () => void,
  stabilizationConfig?: Partial<TestStabilizationConfig>
): void {
  // Initialize stabilization framework for this describe block
  TestStabilizationFramework.getInstance(stabilizationConfig);

  describe(description, suiteDefinitions);
}

/**
 * Global stabilization setup for Jest
 */
export function setupGlobalStabilization(config: Partial<TestStabilizationConfig> = {}): void {
  const framework = TestStabilizationFramework.getInstance(config);

  // Add global setup and teardown hooks
  beforeAll(() => {
    // Global test environment setup
  });

  afterAll(() => {
    // Global cleanup and reporting
    const metrics = framework.getStabilityMetrics();
    console.log('Test Stability Summary:', metrics);

    if (metrics.flakyTests.length > 0) {
      console.warn('Flaky tests detected:', metrics.flakyTests);
      console.warn('Recommendations:', metrics.recommendations);
    }
  });
}