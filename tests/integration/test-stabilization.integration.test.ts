/**
 * Test Stabilization Integration Tests
 *
 * Comprehensive integration tests demonstrating the stabilization framework
 * working with the existing test suite to reduce flaky test rate.
 */

import {
  TestStabilizationSuite,
  TestExecutionMonitor,
  StabilityScoreCalculator,
  TestStabilizationValidator,
  withStabilization,
  stabilizedTest,
  setupGlobalStabilization,
  StabilizationUtils
} from '../../src/test-stabilization';

// Set up global stabilization for these integration tests
setupGlobalStabilization({
  globalTimeout: 60000,
  enableGlobalCleanup: true,
  enableAutoMonitoring: true
});

describe('Test Stabilization Framework Integration', () => {
  let stabilizationSuite: TestStabilizationSuite;

  beforeAll(() => {
    stabilizationSuite = new TestStabilizationSuite({
      framework: {
        defaultRetryStrategy: 'adaptive',
        enableAutoMocking: true,
        enableDeterministicData: true
      },
      monitoring: {
        enableAlerts: true,
        enableRealTimeMonitoring: true,
        alertThresholds: {
          stability: 0.8,
          reliability: 0.85,
          performance: 0.7
        }
      }
    });
  });

  afterAll(async () => {
    await stabilizationSuite.cleanup();
  });

  describe('Framework Initialization', () => {
    test('should initialize stabilization framework successfully', async () => {
      expect(stabilizationSuite).toBeDefined();

      const metrics = await stabilizationSuite.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalTests).toBeGreaterThanOrEqual(0);
    });

    test('should configure stabilization settings', async () => {
      stabilizationSuite.configure({
        framework: {
          defaultTimeout: 10000,
          defaultRetryStrategy: 'exponential'
        },
        monitoring: {
          alertThresholds: {
            stability: 0.9,
            reliability: 0.95
          }
        }
      });

      const session = await stabilizationSuite.getCurrentSession();
      expect(session).toBeDefined();
    });
  });

  describe('Retry Logic Integration', () => {
    test('should retry flaky tests with exponential backoff', async () => {
      let attemptCount = 0;

      const flakyTestFunction = async (): Promise<string> => {
        attemptCount++;

        // Simulate flaky behavior - fails first 2 attempts
        if (attemptCount < 3) {
          throw new Error(`Simulated flaky failure (attempt ${attemptCount})`);
        }

        return 'success';
      };

      const result = await stabilizationSuite.stabilizeTest(
        'flaky-retry-test',
        flakyTestFunction,
        {
          maxRetries: 3,
          isolationMode: 'moderate'
        }
      );

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    test('should apply adaptive timeout management', async () => {
      const executionTimes: number[] = [1000, 1500, 1200, 1800, 1400];

      const adaptiveTimeoutTest = async (): Promise<number> => {
        const historicalTime = executionTimes[Math.floor(Math.random() * executionTimes.length)];
        const adaptiveTimeout = StabilizationUtils.calculateAdaptiveTimeout(
          historicalTime,
          executionTimes,
          2.5,
          10000
        );

        expect(adaptiveTimeout).toBeGreaterThan(historicalTime);
        expect(adaptiveTimeout).toBeLessThanOrEqual(10000);

        // Simulate execution within adaptive timeout
        await new Promise(resolve => setTimeout(resolve, historicalTime * 0.8));

        return adaptiveTimeout;
      };

      const result = await stabilizationSuite.stabilizeTest(
        'adaptive-timeout-test',
        adaptiveTimeoutTest,
        { timeoutMode: 'adaptive' }
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(10000);
    });
  });

  describe('Test Isolation Integration', () => {
    test('should generate deterministic test data', async () => {
      const dataTest = async () => {
        // Generate deterministic user data
        const user1 = StabilizationUtils.generateTestData(
          (random) => ({
            id: random.nextInt(1000),
            name: random.nextString('test-user'),
            email: random.nextEmail(),
            createdAt: random.nextDate(new Date('2024-01-01'))
          }),
          'fixed-seed-1'
        );

        // Generate another user with same seed - should be identical
        const user2 = StabilizationUtils.generateTestData(
          (random) => ({
            id: random.nextInt(1000),
            name: random.nextString('test-user'),
            email: random.nextEmail(),
            createdAt: random.nextDate(new Date('2024-01-01'))
          }),
          'fixed-seed-1'
        );

        // Verify deterministic generation
        expect(user1.id).toBe(user2.id);
        expect(user1.name).toBe(user2.name);
        expect(user1.email).toBe(user2.email);
        expect(user1.createdAt.getTime()).toBe(user2.createdAt.getTime());

        // Generate with different seed - should be different
        const user3 = StabilizationUtils.generateTestData(
          (random) => ({
            id: random.nextInt(1000),
            name: random.nextString('test-user'),
            email: random.nextEmail(),
            createdAt: random.nextDate(new Date('2024-01-01'))
          }),
          'fixed-seed-2'
        );

        expect(user3.id).not.toBe(user1.id);

        return { user1, user2, user3 };
      };

      const result = await stabilizationSuite.stabilizeTest(
        'deterministic-data-test',
        dataTest,
        { isolationMode: 'strict' }
      );

      expect(result.user1).toBeDefined();
      expect(result.user2).toBeDefined();
      expect(result.user3).toBeDefined();
      expect(result.user1.id).toBe(result.user2.id);
      expect(result.user1.id).not.toBe(result.user3.id);
    });

    test('should wait for conditions with timeout', async () => {
      const conditionTest = async () => {
        let counter = 0;
        const targetValue = 5;

        // Wait for condition to be met
        await StabilizationUtils.waitForCondition(
          () => {
            counter++;
            return counter >= targetValue;
          },
          { timeout: 5000, interval: 500 }
        );

        expect(counter).toBeGreaterThanOrEqual(targetValue);
        return counter;
      };

      const result = await stabilizationSuite.stabilizeTest(
        'wait-condition-test',
        conditionTest
      );

      expect(result).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Monitoring Integration', () => {
    test('should track test execution metrics', async () => {
      const monitoringTest = async () => {
        // Simulate test with some execution time
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get current metrics
        const metrics = await stabilizationSuite.getMetrics();

        expect(metrics).toBeDefined();
        expect(metrics.totalTests).toBeGreaterThanOrEqual(0);

        return metrics;
      };

      const result = await stabilizationSuite.stabilizeTest(
        'monitoring-test',
        monitoringTest
      );

      expect(result.totalTests).toBeGreaterThanOrEqual(0);
      expect(result.sessionDuration).toBeGreaterThan(0);
    });

    test('should generate comprehensive reports', async () => {
      const reportTest = async () => {
        // Execute a few tests to generate data
        await stabilizationSuite.stabilizeTest('sample-test-1', async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return 'test-1-result';
        });

        await stabilizationSuite.stabilizeTest('sample-test-2', async () => {
          await new Promise(resolve => setTimeout(resolve, 750));
          return 'test-2-result';
        });

        // Generate report
        const report = await stabilizationSuite.generateReport();

        expect(report).toBeDefined();
        expect(report.id).toBeDefined();
        expect(report.generatedAt).toBeDefined();
        expect(report.summary).toBeDefined();
        expect(report.flakyTests).toBeDefined();
        expect(report.recommendations).toBeDefined();

        return report;
      };

      const result = await stabilizationSuite.stabilizeTest(
        'report-generation-test',
        reportTest
      );

      expect(result.summary.totalTests).toBeGreaterThanOrEqual(0);
      expect(result.summary.overallStabilityScore).toBeDefined();
      expect(Array.isArray(result.flakyTests)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Mocking Integration', () => {
    test('should create and use mock responses', async () => {
      const mockingTest = async () => {
        // Create mock response
        const mockResponse = StabilizationUtils.createMockResponse(
          { id: 123, name: 'Test User', status: 'active' },
          200
        );

        expect(mockResponse.status).toBe(200);
        expect(mockResponse.ok).toBe(true);

        const data = await mockResponse.json();
        expect(data.id).toBe(123);
        expect(data.name).toBe('Test User');
        expect(data.status).toBe('active');

        return mockResponse;
      };

      const result = await stabilizationSuite.stabilizeTest(
        'mock-response-test',
        mockingTest,
        { enableAutoMocking: true }
      );

      expect(result.status).toBe(200);
      expect(result.ok).toBe(true);
    });
  });

  describe('Decorator Integration', () => {
    test('should apply @withStabilization decorator', async () => {
      class TestService {
        @withStabilization({ maxRetries: 2 })
        async decoratedMethod(shouldFail: boolean = false): Promise<string> {
          if (shouldFail) {
            throw new Error('Decorated method failed');
          }
          return 'decorated-success';
        }
      }

      const service = new TestService();

      // Test successful execution
      const successResult = await service.decoratedMethod(false);
      expect(successResult).toBe('decorated-success');
    });

    test('should use stabilizedTest helper function', async () => {
      const stabilizedTestMethod = stabilizedTest(
        'stabilized-helper-test',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return 'helper-stabilized-success';
        },
        { maxRetries: 1 }
      );

      const result = await stabilizedTestMethod();
      expect(result).toBe('helper-stabilized-success');
    });
  });

  describe('Performance Validation', () => {
    test('should validate performance improvements', async () => {
      const performanceTest = async () => {
        const startTime = Date.now();

        // Simulate test execution with stabilization overhead
        await new Promise(resolve => setTimeout(resolve, 1000));

        const executionTime = Date.now() - startTime;

        // Stabilization should not add excessive overhead
        expect(executionTime).toBeLessThan(5000); // Allow 5s max

        return executionTime;
      };

      const result = await stabilizationSuite.stabilizeTest(
        'performance-validation-test',
        performanceTest
      );

      expect(result).toBeGreaterThan(1000); // At least 1s for our simulated work
      expect(result).toBeLessThan(5000); // But not too much overhead
    });

    test('should handle concurrent stabilized tests', async () => {
      const concurrentTest = async (testId: number) => {
        await stabilizationSuite.stabilizeTest(
          `concurrent-test-${testId}`,
          async () => {
            // Simulate concurrent work
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
            return `result-${testId}`;
          }
        );
      };

      // Run multiple tests concurrently
      const testIds = [1, 2, 3, 4, 5];
      const startTime = Date.now();

      const results = await Promise.all(testIds.map(id => concurrentTest(id)));

      const totalTime = Date.now() - startTime;

      // Concurrent execution should be faster than sequential
      expect(totalTime).toBeLessThan(3000); // Less than 3 seconds total
      expect(results.length).toBe(testIds.length);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle and recover from errors gracefully', async () => {
      const errorHandlingTest = async () => {
        try {
          await stabilizationSuite.stabilizeTest(
            'error-handling-test',
            async () => {
              throw new Error('Simulated test error');
            },
            { maxRetries: 2 }
          );

          // Should not reach here
          expect(true).toBe(false);

        } catch (error) {
          // Should catch and handle the error
          expect(error).toBeDefined();
          expect((error as Error).message).toContain('Simulated test error');

          return 'error-handled-correctly';
        }
      };

      const result = await stabilizationSuite.stabilizeTest(
        'error-handling-wrapper-test',
        errorHandlingTest
      );

      expect(result).toBe('error-handled-correctly');
    });

    test('should cleanup resources properly', async () => {
      const cleanupTest = async () => {
        // Create temporary resources
        const tempData = new Map<string, any>();
        tempData.set('test-key', 'test-value');

        // Simulate test execution
        await new Promise(resolve => setTimeout(resolve, 100));

        // Cleanup
        tempData.clear();

        // Verify cleanup
        expect(tempData.size).toBe(0);

        return 'cleanup-successful';
      };

      const result = await stabilizationSuite.stabilizeTest(
        'cleanup-test',
        cleanupTest,
        { isolationMode: 'strict' }
      );

      expect(result).toBe('cleanup-successful');
    });
  });

  describe('Comprehensive Validation', () => {
    test('should run full validation suite', async () => {
      const validationTest = async () => {
        const validator = new TestStabilizationValidator();

        // This would normally run the full validation suite
        // For integration testing, we'll just verify it can be instantiated and configured
        expect(validator).toBeDefined();

        // Test that we can call runValidation (will use simulated data in test environment)
        const validationResult = await validator.runValidation();

        expect(validationResult).toBeDefined();
        expect(validationResult.baselineMetrics).toBeDefined();
        expect(validationResult.stabilizedMetrics).toBeDefined();
        expect(validationResult.improvementAnalysis).toBeDefined();
        expect(validationResult.recommendations).toBeDefined();
        expect(Array.isArray(validationResult.recommendations)).toBe(true);

        return validationResult;
      };

      const result = await stabilizationSuite.stabilizeTest(
        'validation-suite-test',
        validationTest
      );

      expect(result.baselineMetrics.totalTests).toBeGreaterThan(0);
      expect(result.stabilizedMetrics.totalTests).toBeGreaterThan(0);
      expect(result.improvementAnalysis.flakyTestReduction).toBeGreaterThanOrEqual(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    }, 60000); // Extended timeout for comprehensive validation
  });

  describe('Data Export and Analysis', () => {
    test('should export data in multiple formats', async () => {
      const exportTest = async () => {
        // Generate some test data first
        await stabilizationSuite.stabilizeTest('export-data-test', async () => {
          return 'test-data-for-export';
        });

        // Test JSON export
        const jsonExport = await stabilizationSuite.exportData('json');
        expect(jsonExport).toBeDefined();
        expect(() => JSON.parse(jsonExport)).not.toThrow();

        // Test CSV export
        const csvExport = await stabilizationSuite.exportData('csv');
        expect(csvExport).toBeDefined();
        expect(csvExport).toContain('Test Name');
        expect(csvExport).toContain('Status');
        expect(csvExport).toContain('Duration');

        // Test HTML export
        const htmlExport = await stabilizationSuite.exportData('html');
        expect(htmlExport).toBeDefined();
        expect(htmlExport).toContain('<!DOCTYPE html>');
        expect(htmlExport).toContain('<title>Test Stability Report</title>');

        return {
          jsonLength: jsonExport.length,
          csvLength: csvExport.length,
          htmlLength: htmlExport.length
        };
      };

      const result = await stabilizationSuite.stabilizeTest(
        'data-export-test',
        exportTest
      );

      expect(result.jsonLength).toBeGreaterThan(0);
      expect(result.csvLength).toBeGreaterThan(0);
      expect(result.htmlLength).toBeGreaterThan(0);
      expect(result.htmlLength).toBeGreaterThan(result.jsonLength); // HTML should be larger
    });
  });
});

// Integration test for the stabilization framework against actual test files
describe('Real Test Integration', () => {
  let stabilizationSuite: TestStabilizationSuite;

  beforeAll(() => {
    stabilizationSuite = new TestStabilizationSuite({
      framework: {
        defaultRetryStrategy: 'adaptive',
        enableAutoMocking: true,
        enableDeterministicData: true
      }
    });
  });

  afterAll(async () => {
    await stabilizationSuite.cleanup();
  });

  test('should stabilize integration tests from existing test suite', async () => {
    // Test the stabilization framework against patterns found in existing tests
    const integrationTest = async () => {
      // Simulate API integration test pattern (from api.test.ts)
      await stabilizationSuite.stabilizeTest('api-integration-simulation', async () => {
        // Simulate API call with potential flakiness
        const shouldFail = Math.random() < 0.3; // 30% chance of failure

        if (shouldFail) {
          throw new Error('API connection timeout');
        }

        return { status: 200, data: { message: 'API call successful' } };
      }, {
        maxRetries: 3,
        enableAutoMocking: true
      });

      // Simulate E2E workflow test pattern (from turbo-flow-workflows.test.ts)
      await stabilizationSuite.stabilizeTest('e2e-workflow-simulation', async () => {
        // Simulate workflow steps that might have timing issues
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));

        // Simulate potential race condition
        const step2Success = Math.random() > 0.2; // 80% success rate

        if (!step2Success) {
          throw new Error('Workflow step 2 failed - race condition');
        }

        return { workflowCompleted: true, steps: ['step1', 'step2', 'step3'] };
      }, {
        maxRetries: 2,
        timeoutMode: 'adaptive',
        isolationMode: 'strict'
      });

      return 'integration-tests-stabilized';
    };

    const result = await stabilizationSuite.stabilizeTest(
      'real-integration-test',
      integrationTest
    );

    expect(result).toBe('integration-tests-stabilized');

    // Verify metrics show stabilization was applied
    const metrics = await stabilizationSuite.getMetrics();
    expect(metrics.totalTests).toBeGreaterThan(0);
  }, 45000); // Extended timeout for integration simulation
});