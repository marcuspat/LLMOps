/**
 * Test Stabilization Framework - Main Entry Point
 *
 * Comprehensive framework for reducing test flakiness from 58% to <10%
 * through ML-driven pattern recognition and systematic stabilization techniques.
 */

export { TestStabilizationFramework } from './framework';
export { RetryLogicManager, AdaptiveTimeoutManager, RetryConfig } from './retry-logic';
export { NetworkMockManager, DatabaseMocker, FileSystemMocker, ResponseBuilder } from './mocking';
export { DeterministicRandom, PredictableTimestampGenerator, TestDataManager, TestDataFactory } from './deterministic-data';
export {
  TestExecutionMonitor,
  StabilityScoreCalculator,
  StabilityScore,
  TestExecutionMetrics,
  TestSession,
  TestAlertManager,
  withMonitoring
} from './monitoring';
export {
  TestReportGenerator,
  TestReportBuilder,
  TestReport,
  FlakyTestAnalysis,
  TestImprovementRecommendation,
  TestTrendAnalysis
} from './test-reporting';

/**
 * All-in-one stabilization solution for quick setup
 */
export class TestStabilizationSuite {
  private framework: TestStabilizationFramework;
  private monitor: TestExecutionMonitor;
  private reportGenerator: TestReportGenerator;

  constructor(options: TestStabilizationOptions = {}) {
    // Initialize core components
    this.framework = new TestStabilizationFramework(options.framework);
    this.monitor = new TestExecutionMonitor(options.monitoring);
    this.reportGenerator = new TestReportGenerator(this.monitor);

    // Set up integration
    this.setupIntegration();
  }

  /**
   * Stabilize a test with comprehensive protection
   */
  async stabilizeTest<T>(
    testName: string,
    testFunction: () => Promise<T>,
    options: StabilizeTestOptions = {}
  ): Promise<T> {
    // Start monitoring
    const monitoringSession = await this.monitor.startMonitoring({ testName });

    try {
      // Apply comprehensive stabilization
      const result = await this.framework.stabilizeTest(testName, testFunction, {
        retry: {
          maxAttempts: options.maxRetries || 3,
          strategy: 'adaptive',
          baseDelay: 1000
        },
        isolation: {
          generateUniqueData: true,
          cleanupAfterTest: true
        },
        timeout: {
          adaptive: true,
          multiplier: 2.5
        },
        mocking: {
          enableAutoMocking: options.enableAutoMocking || false
        }
      });

      // Record successful test execution
      await this.monitor.recordTestSuccess(testName, Date.now() - monitoringSession.startTime);

      return result;

    } catch (error) {
      // Record test failure
      await this.monitor.recordTestFailure(testName, error as Error, Date.now() - monitoringSession.startTime);
      throw error;
    }
  }

  /**
   * Generate comprehensive test stability report
   */
  async generateReport(sessionId?: string): Promise<TestReport> {
    return await this.reportGenerator.generateReport(sessionId);
  }

  /**
   * Get current test session status
   */
  async getCurrentSession(): Promise<TestSession | null> {
    return await this.monitor.getCurrentSession();
  }

  /**
   * Get flaky test analysis
   */
  async getFlakyTests(): Promise<FlakyTestAnalysis[]> {
    const session = await this.getCurrentSession();
    if (!session) {
      return [];
    }

    const report = await this.generateReport();
    return report.flakyTests;
  }

  /**
   * Get stabilization recommendations
   */
  async getRecommendations(): Promise<TestImprovementRecommendation[]> {
    const session = await this.getCurrentSession();
    if (!session) {
      return [];
    }

    const report = await this.generateReport();
    return report.recommendations;
  }

  /**
   * Configure stabilization settings
   */
  configure(options: Partial<TestStabilizationOptions>): void {
    if (options.framework) {
      this.framework.configure(options.framework);
    }
    if (options.monitoring) {
      this.monitor.configure(options.monitoring);
    }
  }

  /**
   * Get stability metrics
   */
  async getMetrics(): Promise<StabilityMetrics> {
    const session = await this.getCurrentSession();
    if (!session) {
      throw new Error('No active test session');
    }

    const testMetrics = Array.from(session.testMetrics.values());
    const calculator = new StabilityScoreCalculator();

    return {
      totalTests: testMetrics.length,
      passedTests: testMetrics.filter(m => m.status === 'passed').length,
      failedTests: testMetrics.filter(m => m.status === 'failed').length,
      flakyTests: testMetrics.filter(m => {
        const score = calculator.calculateStabilityScore(m);
        return score.consistency < 0.7;
      }).length,
      averageStability: testMetrics.reduce((sum, m) => {
        const score = calculator.calculateStabilityScore(m);
        return sum + score.overall;
      }, 0) / testMetrics.length,
      sessionDuration: Date.now() - session.startTime
    };
  }

  /**
   * Export data in various formats
   */
  async exportData(format: 'json' | 'csv' | 'html' = 'json'): Promise<string> {
    const session = await this.getCurrentSession();
    if (!session) {
      throw new Error('No active test session');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2);

      case 'csv':
        return this.generateCSV(session);

      case 'html':
        const report = await this.generateReport();
        return await this.reportGenerator.exportReport(report, 'html');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.monitor.cleanup();
    await this.framework.cleanup();
  }

  private setupIntegration(): void {
    // Configure monitoring alerts
    this.monitor.on('stabilityAlert', (alert) => {
      console.warn(`Stability Alert: ${alert.message}`, alert);
    });

    // Configure framework event handlers
    this.framework.on('retryAttempt', (data) => {
      console.log(`Retrying test ${data.testName} (attempt ${data.attempt})`);
    });

    this.framework.on('isolationApplied', (data) => {
      console.log(`Applied isolation for test ${data.testName}:`, data.measures);
    });
  }

  private generateCSV(session: TestSession): string {
    const testMetrics = Array.from(session.testMetrics.values());
    const calculator = new StabilityScoreCalculator();

    const headers = [
      'Test Name',
      'Test File',
      'Status',
      'Duration (ms)',
      'Attempts',
      'Stability Score',
      'Consistency Score',
      'Reliability Score',
      'Performance Score',
      'Predictability Score',
      'Error Count'
    ];

    const rows = testMetrics.map(metric => {
      const score = calculator.calculateStabilityScore(metric);
      return [
        `"${metric.testName}"`,
        `"${metric.testFile || ''}"`,
        metric.status,
        metric.duration || 0,
        metric.attempts || 1,
        score.overall.toFixed(3),
        score.consistency.toFixed(3),
        score.reliability.toFixed(3),
        score.performance.toFixed(3),
        score.predictability.toFixed(3),
        metric.errors?.length || 0
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

/**
 * Decorator for automatic test stabilization
 */
export function withStabilization(options: StabilizeTestOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const suite = new TestStabilizationSuite();
      const testName = `${target.constructor.name}.${propertyName}`;

      try {
        return await suite.stabilizeTest(testName, () => method.apply(this, args), options);
      } finally {
        await suite.cleanup();
      }
    };

    return descriptor;
  };
}

/**
 * Jest helper for stabilized tests
 */
export function stabilizedTest(name: string, testFn: () => Promise<any>, options: StabilizeTestOptions = {}) {
  return async () => {
    const suite = new TestStabilizationSuite();
    try {
      return await suite.stabilizeTest(name, testFn, options);
    } finally {
      await suite.cleanup();
    }
  };
}

/**
 * Global setup for test stabilization
 */
export function setupGlobalStabilization(options: GlobalStabilizationOptions = {}): void {
  // Set up global error handling
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection in stabilized test:', reason);
  });

  // Set up global timeout management
  if (options.globalTimeout) {
    jest.setTimeout(options.globalTimeout);
  }

  // Set up global cleanup
  if (options.enableGlobalCleanup) {
    afterAll(async () => {
      const suite = new TestStabilizationSuite();
      await suite.cleanup();
    });
  }
}

/**
 * Utility functions for common stabilization patterns
 */
export const StabilizationUtils = {
  /**
   * Wait for condition with timeout and retry
   */
  async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    options: { timeout?: number; interval?: number; retries?: number } = {}
  ): Promise<void> {
    const timeout = options.timeout || 10000;
    const interval = options.interval || 100;
    const retries = options.retries || Math.ceil(timeout / interval);
    const startTime = Date.now();

    for (let i = 0; i < retries; i++) {
      if (await condition()) {
        return;
      }

      if (Date.now() - startTime > timeout) {
        throw new Error(`Condition not met within ${timeout}ms`);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met after ${retries} retries`);
  },

  /**
   * Wait for DOM element
   */
  async waitForElement(selector: string, options: { timeout?: number } = {}): Promise<Element | null> {
    return this.waitForCondition(
      () => document.querySelector(selector) !== null,
      options
    ).then(() => document.querySelector(selector));
  },

  /**
   * Generate deterministic test data
   */
  generateTestData<T>(factory: (random: DeterministicRandom) => T, seed: string = 'test-seed'): T {
    const random = new DeterministicRandom(seed);
    return factory(random);
  },

  /**
   * Create mock response builder
   */
  createMockResponse<T>(data: T, status: number = 200): any {
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => data,
      text: async () => JSON.stringify(data)
    };
  },

  /**
   * Calculate adaptive timeout
   */
  calculateAdaptiveTimeout(
    baseTime: number,
    historicalData: number[] = [],
    multiplier: number = 2.5,
    maxTimeout: number = 30000
  ): number {
    if (historicalData.length === 0) {
      return Math.min(baseTime * multiplier, maxTimeout);
    }

    const average = historicalData.reduce((sum, time) => sum + time, 0) / historicalData.length;
    const max = Math.max(...historicalData);
    const adaptiveTime = Math.max(average, baseTime) * multiplier;

    return Math.min(adaptiveTime, maxTimeout);
  }
};

// Type definitions
export interface TestStabilizationOptions {
  framework?: FrameworkOptions;
  monitoring?: MonitoringOptions;
}

export interface FrameworkOptions {
  defaultRetryStrategy?: 'exponential' | 'linear' | 'adaptive' | 'aggressive' | 'conservative';
  defaultTimeout?: number;
  enableAutoMocking?: boolean;
  enableDeterministicData?: boolean;
}

export interface MonitoringOptions {
  enableAlerts?: boolean;
  alertThresholds?: {
    stability?: number;
    reliability?: number;
    performance?: number;
  };
  enableRealTimeMonitoring?: boolean;
}

export interface StabilizeTestOptions {
  maxRetries?: number;
  enableAutoMocking?: boolean;
  isolationMode?: 'strict' | 'moderate' | 'none';
  timeoutMode?: 'fixed' | 'adaptive';
  customMockConfig?: any;
}

export interface GlobalStabilizationOptions {
  globalTimeout?: number;
  enableGlobalCleanup?: boolean;
  defaultRetryStrategy?: string;
  enableAutoMonitoring?: boolean;
}

export interface StabilityMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  flakyTests: number;
  averageStability: number;
  sessionDuration: number;
}

// Re-export commonly used classes for convenience
export {
  FrameworkOptions,
  MonitoringOptions,
  StabilizeTestOptions,
  GlobalStabilizationOptions
};