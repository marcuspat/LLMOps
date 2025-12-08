/**
 * ML Test Suite
 * Comprehensive testing framework for machine learning models, training pipelines, and inference services
 */

import { EventEmitter } from 'events';
import {
  MLModel,
  TrainingConfig,
  PredictionRequest,
  PredictionResponse,
  ModelPerformance,
  MLPipelineEvent,
  MLPipelineEventType
} from '../../types/ml.js';
import { Logger } from 'winston';
import { ModelTester } from './ModelTester.js';
import { TrainingPipelineTester } from './TrainingPipelineTester.js';
import { InferenceServiceTester } from './InferenceServiceTester.js';
import { DataPipelineTester } from './DataPipelineTester.js';
import { IntegrationTester } from './IntegrationTester.js';
import { PerformanceTester } from './PerformanceTester.js';
import { SecurityTester } from './SecurityTester.js';
import { TestReportGenerator } from './TestReportGenerator.js';

export interface MLTestSuiteConfig {
  testCategories: TestCategory[];
  testEnvironments: TestEnvironment[];
  parallelExecution: boolean;
  timeout: number;
  retryPolicy: RetryPolicy;
  reporting: TestReportingConfig;
  benchmarks: TestBenchmarks;
}

export interface TestCategory {
  name: string;
  enabled: boolean;
  tests: TestCase[];
  dependencies: string[];
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: TestType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  parameters: any;
  expectedResults: ExpectedResult[];
  tags: string[];
}

export enum TestType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  END_TO_END = 'end_to_end',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  REGRESSION = 'regression',
  STRESS = 'stress',
  COMPATIBILITY = 'compatibility'
}

export interface ExpectedResult {
  metric: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'regex';
  value: any;
  tolerance?: number;
}

export interface TestEnvironment {
  name: string;
  type: 'development' | 'staging' | 'production';
  configuration: any;
  resources: TestResources;
}

export interface TestResources {
  cpu: number;
  memory: number;
  gpu?: number;
  storage: number;
  network: number;
}

export interface RetryPolicy {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

export interface TestReportingConfig {
  formats: string[];
  destinations: ReportDestination[];
  templates: ReportTemplate[];
  notifications: NotificationConfig;
}

export interface ReportDestination {
  type: 'file' | 'database' | 'api' | 'email' | 'slack';
  config: any;
}

export interface ReportTemplate {
  name: string;
  format: 'html' | 'json' | 'pdf' | 'markdown';
  template: string;
}

export interface NotificationConfig {
  onSuccess: boolean;
  onFailure: boolean;
  channels: string[];
  recipients: string[];
}

export interface TestBenchmarks {
  enabled: boolean;
  baseline: Record<string, number>;
  regression: number;
  improvement: number;
}

export interface TestSuiteResult {
  suiteName: string;
  environment: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  testResults: TestResult[];
  summary: TestSummary;
  coverage: TestCoverage;
  benchmarks: BenchmarkResults;
}

export interface TestResult {
  testCase: TestCase;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  startTime: Date;
  endTime: Date;
  duration: number;
  actualResults: Record<string, any>;
  expectedResults: ExpectedResult[];
  passed: boolean;
  error?: Error;
  logs: string[];
  metrics: Record<string, number>;
  artifacts: TestArtifact[];
}

export interface TestArtifact {
  name: string;
  type: 'log' | 'screenshot' | 'metrics' | 'model' | 'data' | 'report';
  path: string;
  size: number;
  description: string;
}

export interface TestSummary {
  passRate: number;
  averageDuration: number;
  totalDuration: number;
  criticalFailures: number;
  warnings: number;
  recommendations: string[];
}

export interface TestCoverage {
  codeCoverage: number;
  testCoverage: number;
  featureCoverage: Record<string, number>;
  modelCoverage: Record<string, number>;
}

export interface BenchmarkResults {
  baseline: Record<string, number>;
  current: Record<string, number>;
  improvements: Record<string, number>;
  regressions: Record<string, number>;
}

export class MLTestSuite extends EventEmitter {
  private config: MLTestSuiteConfig;
  private logger: Logger;
  private modelTester: ModelTester;
  private trainingPipelineTester: TrainingPipelineTester;
  private inferenceServiceTester: InferenceServiceTester;
  private dataPipelineTester: DataPipelineTester;
  private integrationTester: IntegrationTester;
  private performanceTester: PerformanceTester;
  private securityTester: SecurityTester;
  private testReportGenerator: TestReportGenerator;

  // Test execution state
  private activeSuites: Map<string, Promise<TestSuiteResult>> = new Map();
  private testHistory: TestSuiteResult[] = [];
  private isRunning: boolean = false;

  constructor(config: MLTestSuiteConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    this.modelTester = new ModelTester(logger);
    this.trainingPipelineTester = new TrainingPipelineTester(logger);
    this.inferenceServiceTester = new InferenceServiceTester(logger);
    this.dataPipelineTester = new DataPipelineTester(logger);
    this.integrationTester = new IntegrationTester(logger);
    this.performanceTester = new PerformanceTester(logger);
    this.securityTester = new SecurityTester(logger);
    this.testReportGenerator = new TestReportGenerator(config.reporting, logger);

    this.setupEventHandlers();
  }

  /**
   * Initialize the test suite
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing ML Test Suite...');

    try {
      // Initialize all test components
      await this.modelTester.initialize();
      await this.trainingPipelineTester.initialize();
      await this.inferenceServiceTester.initialize();
      await this.dataPipelineTester.initialize();
      await this.integrationTester.initialize();
      await this.performanceTester.initialize();
      await this.securityTester.initialize();
      await this.testReportGenerator.initialize();

      // Load test history if available
      await this.loadTestHistory();

      this.logger.info('ML Test Suite initialized successfully');
      this.emit('initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize ML Test Suite:', error);
      throw error;
    }
  }

  /**
   * Run a complete test suite
   */
  async runTestSuite(
    suiteName: string,
    environment: string = 'development',
    categories?: string[]
  ): Promise<TestSuiteResult> {
    const suiteId = this.generateSuiteId();
    this.logger.info(`Running test suite ${suiteName} in ${environment} environment`);

    try {
      if (this.isRunning && !this.config.parallelExecution) {
        throw new Error('Another test suite is already running');
      }

      // Get test environment
      const testEnvironment = this.config.testEnvironments.find(e => e.name === environment);
      if (!testEnvironment) {
        throw new Error(`Test environment ${environment} not found`);
      }

      // Start test suite execution
      const suitePromise = this.executeTestSuite(suiteName, testEnvironment, categories);
      this.activeSuites.set(suiteId, suitePromise);

      const result = await suitePromise;
      this.activeSuites.delete(suiteId);

      // Store result in history
      this.testHistory.push(result);
      await this.saveTestHistory();

      // Generate and distribute reports
      await this.generateTestReports(result);

      this.logger.info(`Test suite ${suiteName} completed: ${result.passedTests}/${result.totalTests} passed`);
      this.emit('suite_completed', { suiteId, suiteName, result });

      return result;

    } catch (error) {
      this.activeSuites.delete(suiteId);
      this.logger.error(`Test suite ${suiteName} failed:`, error);
      throw error;
    }
  }

  /**
   * Run specific test categories
   */
  async runTestCategories(
    categories: string[],
    environment: string = 'development'
  ): Promise<TestSuiteResult> {
    return this.runTestSuite(`custom_${Date.now()}`, environment, categories);
  }

  /**
   * Run a specific test
   */
  async runSingleTest(
    testId: string,
    environment: string = 'development'
  ): Promise<TestResult> {
    this.logger.info(`Running single test ${testId}`);

    try {
      const testEnvironment = this.config.testEnvironments.find(e => e.name === environment);
      if (!testEnvironment) {
        throw new Error(`Test environment ${environment} not found`);
      }

      // Find the test case
      const testCase = this.findTestCase(testId);
      if (!testCase) {
        throw new Error(`Test case ${testId} not found`);
      }

      // Execute the test
      const result = await this.executeTestCase(testCase, testEnvironment);

      this.emit('test_completed', { testId, result });
      return result;

    } catch (error) {
      this.logger.error(`Single test ${testId} failed:`, error);
      throw error;
    }
  }

  /**
   * Run performance benchmarks
   */
  async runBenchmarks(
    benchmarkSuite: string = 'default',
    environment: string = 'development'
  ): Promise<BenchmarkResults> {
    this.logger.info(`Running performance benchmarks ${benchmarkSuite}`);

    try {
      const testEnvironment = this.config.testEnvironments.find(e => e.name === environment);
      if (!testEnvironment) {
        throw new Error(`Test environment ${environment} not found`);
      }

      const results = await this.performanceTester.runBenchmarks(benchmarkSuite, testEnvironment);

      this.emit('benchmarks_completed', { benchmarkSuite, results });
      return results;

    } catch (error) {
      this.logger.error(`Performance benchmarks ${benchmarkSuite} failed:`, error);
      throw error;
    }
  }

  /**
   * Get test suite status
   */
  getTestSuiteStatus(): {
    isRunning: boolean;
    activeSuites: string[];
    lastExecution?: Date;
    totalExecutions: number;
  } {
    return {
      isRunning: this.isRunning,
      activeSuites: Array.from(this.activeSuites.keys()),
      lastExecution: this.testHistory.length > 0 ? this.testHistory[this.testHistory.length - 1].endTime : undefined,
      totalExecutions: this.testHistory.length
    };
  }

  /**
   * Get test execution history
   */
  getTestHistory(limit?: number): TestSuiteResult[] {
    const history = [...this.testHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get test coverage report
   */
  async getCoverageReport(): Promise<TestCoverage> {
    try {
      const coverageData = await Promise.all([
        this.modelTester.getCoverage(),
        this.trainingPipelineTester.getCoverage(),
        this.inferenceServiceTester.getCoverage(),
        this.dataPipelineTester.getCoverage()
      ]);

      return {
        codeCoverage: 0, // Would be calculated from actual code coverage tools
        testCoverage: coverageData.reduce((sum, c) => sum + c.testCoverage, 0) / coverageData.length,
        featureCoverage: {},
        modelCoverage: {}
      };

    } catch (error) {
      this.logger.error('Failed to generate coverage report:', error);
      throw error;
    }
  }

  /**
   * Generate test reports
   */
  async generateTestReports(result: TestSuiteResult): Promise<void> {
    try {
      await this.testReportGenerator.generateReports(result);

      this.emit('reports_generated', { result });

    } catch (error) {
      this.logger.error('Failed to generate test reports:', error);
    }
  }

  /**
   * Shutdown the test suite
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ML Test Suite...');

    try {
      // Wait for active test suites to complete
      const activeSuites = Array.from(this.activeSuites.values());
      if (activeSuites.length > 0) {
        this.logger.info(`Waiting for ${activeSuites.length} active test suites to complete...`);
        await Promise.allSettled(activeSuites);
      }

      // Shutdown all test components
      await this.modelTester.shutdown();
      await this.trainingPipelineTester.shutdown();
      await this.inferenceServiceTester.shutdown();
      await this.dataPipelineTester.shutdown();
      await this.integrationTester.shutdown();
      await this.performanceTester.shutdown();
      await this.securityTester.shutdown();
      await this.testReportGenerator.shutdown();

      // Save final test history
      await this.saveTestHistory();

      this.logger.info('ML Test Suite shutdown complete');

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  // Private helper methods

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      this.logger.error('ML Test Suite error:', error);
    });

    this.modelTester.on('test_completed', (result) => {
      this.emit('model_test_completed', result);
    });

    this.trainingPipelineTester.on('test_completed', (result) => {
      this.emit('training_test_completed', result);
    });

    this.inferenceServiceTester.on('test_completed', (result) => {
      this.emit('inference_test_completed', result);
    });
  }

  private async executeTestSuite(
    suiteName: string,
    environment: TestEnvironment,
    categories?: string[]
  ): Promise<TestSuiteResult> {
    const startTime = new Date();
    this.isRunning = true;

    try {
      // Collect all test cases to run
      const testCases = this.collectTestCases(categories);

      this.logger.info(`Executing ${testCases.length} test cases`);

      const testResults: TestResult[] = [];
      const testGroups = this.groupTestCasesByType(testCases);

      // Execute test groups
      for (const [testType, tests] of testGroups) {
        const groupResults = await this.executeTestGroup(testType, tests, environment);
        testResults.push(...groupResults);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      // Calculate suite results
      const totalTests = testResults.length;
      const passedTests = testResults.filter(t => t.status === 'passed').length;
      const failedTests = testResults.filter(t => t.status === 'failed').length;
      const skippedTests = testResults.filter(t => t.status === 'skipped').length;

      const summary = this.calculateTestSummary(testResults);
      const coverage = await this.calculateTestCoverage(testResults);
      const benchmarks = await this.calculateBenchmarks(testResults);

      const result: TestSuiteResult = {
        suiteName,
        environment: environment.name,
        startTime,
        endTime,
        duration,
        totalTests,
        passedTests,
        failedTests,
        skippedTests,
        testResults,
        summary,
        coverage,
        benchmarks
      };

      this.isRunning = false;
      return result;

    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  private collectTestCases(categories?: string[]): TestCase[] {
    const allTests: TestCase[] = [];

    for (const category of this.config.testCategories) {
      if (category.enabled && (!categories || categories.includes(category.name))) {
        allTests.push(...category.tests);
      }
    }

    // Sort tests by priority
    return allTests.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private groupTestCasesByType(testCases: TestCase[]): Map<TestType, TestCase[]> {
    const groups = new Map<TestType, TestCase[]>();

    for (const testCase of testCases) {
      if (!groups.has(testCase.type)) {
        groups.set(testCase.type, []);
      }
      groups.get(testCase.type)!.push(testCase);
    }

    return groups;
  }

  private async executeTestGroup(
    testType: TestType,
    tests: TestCase[],
    environment: TestEnvironment
  ): Promise<TestResult[]> {
    let tester: any;

    // Select appropriate tester
    switch (testType) {
      case TestType.UNIT:
        tester = this.modelTester;
        break;
      case TestType.INTEGRATION:
        tester = this.integrationTester;
        break;
      case TestType.END_TO_END:
        tester = this.integrationTester;
        break;
      case TestType.PERFORMANCE:
        tester = this.performanceTester;
        break;
      case TestType.SECURITY:
        tester = this.securityTester;
        break;
      default:
        this.logger.warn(`No tester available for test type ${testType}`);
        return [];
    }

    // Execute tests in parallel if configured
    if (this.config.parallelExecution) {
      const promises = tests.map(test => this.executeTestCaseWithRetry(test, environment, tester));
      return await Promise.all(promises);
    } else {
      const results: TestResult[] = [];
      for (const test of tests) {
        const result = await this.executeTestCaseWithRetry(test, environment, tester);
        results.push(result);
      }
      return results;
    }
  }

  private async executeTestCaseWithRetry(
    testCase: TestCase,
    environment: TestEnvironment,
    tester: any
  ): Promise<TestResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retryPolicy.maxRetries; attempt++) {
      try {
        return await this.executeTestCase(testCase, environment, tester);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.retryPolicy.maxRetries && this.config.retryPolicy.enabled) {
          const delay = this.config.retryPolicy.retryDelay * Math.pow(this.config.retryPolicy.backoffMultiplier, attempt);
          this.logger.warn(`Test ${testCase.id} failed, retrying in ${delay}ms (attempt ${attempt + 1})`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    return this.createErrorResult(testCase, lastError!);
  }

  private async executeTestCase(
    testCase: TestCase,
    environment: TestEnvironment,
    tester: any
  ): Promise<TestResult> {
    const startTime = new Date();

    try {
      this.logger.debug(`Executing test case ${testCase.id}: ${testCase.name}`);

      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Test timeout after ${testCase.timeout}ms`)), testCase.timeout);
      });

      // Execute the test
      const testPromise = tester.executeTest(testCase, environment);

      // Race between test execution and timeout
      const result = await Promise.race([testPromise, timeoutPromise]) as TestResult;

      const endTime = new Date();
      result.startTime = startTime;
      result.endTime = endTime;
      result.duration = endTime.getTime() - startTime.getTime();

      return result;

    } catch (error) {
      return this.createErrorResult(testCase, error as Error);
    }
  }

  private createErrorResult(testCase: TestCase, error: Error): TestResult {
    return {
      testCase,
      status: 'error',
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      actualResults: {},
      expectedResults: testCase.expectedResults,
      passed: false,
      error,
      logs: [error.message],
      metrics: {},
      artifacts: []
    };
  }

  private calculateTestSummary(results: TestResult[]): TestSummary {
    const passedTests = results.filter(r => r.status === 'passed').length;
    const totalTests = results.length;
    const passRate = totalTests > 0 ? passedTests / totalTests : 0;
    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const criticalFailures = results.filter(r =>
      r.status === 'failed' && r.testCase.priority === 'critical'
    ).length;
    const warnings = results.filter(r =>
      r.status === 'failed' && r.testCase.priority === 'medium'
    ).length;

    const recommendations = this.generateRecommendations(results);

    return {
      passRate,
      averageDuration,
      totalDuration,
      criticalFailures,
      warnings,
      recommendations
    };
  }

  private async calculateTestCoverage(results: TestResult[]): Promise<TestCoverage> {
    // This would calculate actual test coverage
    return {
      codeCoverage: 0,
      testCoverage: results.length,
      featureCoverage: {},
      modelCoverage: {}
    };
  }

  private async calculateBenchmarks(results: TestResult[]): Promise<BenchmarkResults> {
    if (!this.config.benchmarks.enabled) {
      return {
        baseline: {},
        current: {},
        improvements: {},
        regressions: {}
      };
    }

    const baseline = this.config.benchmarks.baseline;
    const current: Record<string, number> = {};

    // Calculate current metrics from test results
    for (const result of results) {
      for (const [metric, value] of Object.entries(result.metrics)) {
        current[metric] = value;
      }
    }

    const improvements: Record<string, number> = {};
    const regressions: Record<string, number> = {};

    for (const [metric, currentValue] of Object.entries(current)) {
      const baselineValue = baseline[metric];
      if (baselineValue !== undefined) {
        const delta = currentValue - baselineValue;
        if (delta > this.config.benchmarks.improvement) {
          improvements[metric] = delta;
        } else if (delta < -this.config.benchmarks.regression) {
          regressions[metric] = delta;
        }
      }
    }

    return {
      baseline,
      current,
      improvements,
      regressions
    };
  }

  private generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];

    const failedTests = results.filter(r => r.status === 'failed');
    const criticalFailures = failedTests.filter(t => t.testCase.priority === 'critical');

    if (criticalFailures.length > 0) {
      recommendations.push(`Address ${criticalFailures.length} critical test failures immediately`);
    }

    if (failedTests.length > results.length * 0.1) {
      recommendations.push('High failure rate detected - review test environment and test data');
    }

    const slowTests = results.filter(r => r.duration > 10000); // > 10 seconds
    if (slowTests.length > 0) {
      recommendations.push(`${slowTests.length} tests are slow - consider optimization`);
    }

    return recommendations;
  }

  private findTestCase(testId: string): TestCase | undefined {
    for (const category of this.config.testCategories) {
      const test = category.tests.find(t => t.id === testId);
      if (test) return test;
    }
    return undefined;
  }

  private async loadTestHistory(): Promise<void> {
    // Load test history from storage
    // Implementation would depend on storage system
  }

  private async saveTestHistory(): Promise<void> {
    // Save test history to storage
    // Implementation would depend on storage system
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateSuiteId(): string {
    return `suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}