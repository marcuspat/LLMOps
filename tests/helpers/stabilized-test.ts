/**
 * Stabilized Test Helper
 *
 * Provides decorators and wrapper functions to make tests stable:
 * - Automatic retry logic
 * - Fake timer management
 * - Resource cleanup
 * - Async race condition prevention
 * - Deterministic behavior
 */

import { jest } from '@jest/globals';
import TestStabilization from '../setup/test-stabilization';

// Stabilization options interface
export interface StabilizedTestOptions {
  maxRetries?: number;
  retryDelay?: number;
  useFakeTimers?: boolean;
  autoAdvanceTimers?: boolean;
  timeout?: number;
  isolation?: 'none' | 'strict' | 'moderate';
  retryIf?: (error: any) => boolean;
  beforeTest?: () => Promise<void> | void;
  afterTest?: () => Promise<void> | void;
  onRetry?: (attempt: number, error: any) => Promise<void> | void;
}

// Default stabilization options
const DEFAULT_OPTIONS: Required<StabilizedTestOptions> = {
  maxRetries: 3,
  retryDelay: 100,
  useFakeTimers: true,
  autoAdvanceTimers: false,
  timeout: 30000,
  isolation: 'moderate',
  retryIf: () => true,
  beforeTest: async () => {},
  afterTest: async () => {},
  onRetry: async () => {}
};

/**
 * Decorator for stabilizing test methods
 */
export function stabilizedTest(options: StabilizedTestOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      await executeStabilized(
        () => originalMethod.apply(this, args),
        `${target.constructor.name}.${propertyKey}`,
        opts
      );
    };

    return descriptor;
  };
}

/**
 * Wrapper function for stabilizing test functions
 */
export function stabilizeTest(
  testName: string,
  testFn: () => Promise<any> | any,
  options: StabilizedTestOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async () => {
    await executeStabilized(testFn, testName, opts);
  };
}

/**
 * Execute a test function with stabilization
 */
async function executeStabilized(
  testFn: () => Promise<any> | any,
  testName: string,
  options: Required<StabilizedTestOptions>
) {
  let lastError: any;
  let attempt = 0;

  // Setup isolation based on level
  await setupIsolation(options.isolation);

  while (attempt <= options.maxRetries) {
    try {
      // Run before test hook
      await options.beforeTest();

      // Setup fake timers if requested
      if (options.useFakeTimers) {
        jest.useFakeTimers({
          advanceTimers: options.autoAdvanceTimers,
          doNotFake: ['nextTick', 'setImmediate']
        });
      }

      // Execute test with timeout
      const result = await TestStabilization.async.withTimeout(
        testFn(),
        options.timeout,
        new Error(`Test "${testName}" timed out after ${options.timeout}ms`)
      );

      // Run after test hook
      await options.afterTest();

      return result;

    } catch (error) {
      lastError = error;
      attempt++;

      // Clean up on failure
      await cleanupIsolation(options.isolation);

      // Check if we should retry
      if (attempt > options.maxRetries || !options.retryIf(error)) {
        throw enhanceErrorWithAttemptInfo(error, testName, attempt, options.maxRetries);
      }

      // Call retry hook
      await options.onRetry(attempt, error);

      // Wait before retry
      if (options.retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, options.retryDelay));
      }
    }
  }

  throw lastError;
}

/**
 * Setup isolation level
 */
async function setupIsolation(level: 'none' | 'strict' | 'moderate') {
  switch (level) {
    case 'strict':
      // Clear all mocks and modules
      jest.clearAllMocks();
      jest.resetModules();

      // Reset timers
      TestStabilization.clearAllTimers();

      // Clean up any registered resources
      TestStabilization.registerCleanup(async () => {
        // Will be called in afterEach
      });
      break;

    case 'moderate':
      // Clear mocks but keep some state for performance
      jest.clearAllMocks();
      break;

    case 'none':
      // No special isolation
      break;
  }
}

/**
 * Cleanup isolation
 */
async function cleanupIsolation(level: 'none' | 'strict' | 'moderate') {
  switch (level) {
    case 'strict':
      // Restore real timers
      jest.useRealTimers();
      break;

    case 'moderate':
      // Partial cleanup
      break;

    case 'none':
      // No cleanup
      break;
  }
}

/**
 * Enhance error with attempt information
 */
function enhanceErrorWithAttemptInfo(
  error: any,
  testName: string,
  attempt: number,
  maxRetries: number
) {
  if (error instanceof Error) {
    error.message = `[Test: ${testName}] [Attempt ${attempt}/${maxRetries + 1}] ${error.message}`;

    // Add attempt info to error object
    (error as any).testName = testName;
    (error as any).attempt = attempt;
    (error as any).maxAttempts = maxRetries + 1;
  }

  return error;
}

/**
 * Create a stabilized test suite
 */
export function createStabilizedSuite(
  suiteName: string,
  options: StabilizedTestOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return {
    name: suiteName,
    options: opts,

    // Test method
    test: (testName: string, testFn: () => Promise<any> | any, testOptions?: StabilizedTestOptions) => {
      const mergedOptions = { ...opts, ...testOptions };
      return {
        [testName]: stabilizeTest(`${suiteName} - ${testName}`, testFn, mergedOptions)
      };
    },

    // Only test (skip retries)
    only: (testName: string, testFn: () => Promise<any> | any) => {
      return {
        [testName]: async () => {
          await setupIsolation(opts.isolation);
          await opts.beforeTest();

          try {
            await testFn();
          } finally {
            await opts.afterTest();
            await cleanupIsolation(opts.isolation);
          }
        }
      };
    },

    // Skip test
    skip: (testName: string, testFn?: () => Promise<any> | any) => {
      return {
        [testName]: () => {
          console.log(`[SKIPPED] ${suiteName} - ${testName}`);
        }
      };
    },

    // Concurrent tests
    concurrent: async (tests: Array<{ name: string; fn: () => Promise<any> }>) => {
      const promises = tests.map(({ name, fn }) =>
        executeStabilized(fn, `${suiteName} - ${name}`, opts)
      );

      return await Promise.all(promises);
    }
  };
}

/**
 * Common test patterns with stabilization
 */
export const Patterns = {
  /**
   * API test pattern with network mocking
   */
  apiTest: (
    testName: string,
    testFn: (mockFetch: jest.Mock) => Promise<any>,
    options?: StabilizedTestOptions
  ) => {
    return stabilizeTest(testName, async () => {
      const mockFetch = global.fetch as jest.Mock;
      await testFn(mockFetch);
    }, {
      useFakeTimers: true,
      isolation: 'moderate',
      ...options
    });
  },

  /**
   * Database test pattern with transaction rollback
   */
  databaseTest: (
    testName: string,
    testFn: (mockDB: any) => Promise<any>,
    options?: StabilizedTestOptions
  ) => {
    return stabilizeTest(testName, async () => {
      const mockDB = TestStabilization.getMockDB();

      // Begin transaction
      mockDB.transaction.mockImplementation(async (callback) => {
        try {
          return await callback(mockDB);
        } catch (error) {
          mockDB.rollback();
          throw error;
        }
      });

      await testFn(mockDB);
    }, {
      isolation: 'strict',
      ...options
    });
  },

  /**
   * Async operation test pattern with race condition prevention
   */
  asyncTest: (
    testName: string,
    testFn: () => Promise<any>,
    options?: StabilizedTestOptions
  ) => {
    return stabilizeTest(testName, async () => {
      // Use sequential execution to prevent race conditions
      await TestStabilization.async.sequential([
        () => testFn()
      ]);
    }, {
      useFakeTimers: true,
      autoAdvanceTimers: true,
      ...options
    });
  },

  /**
   * Performance test pattern with timing validation
   */
  performanceTest: (
    testName: string,
    testFn: () => Promise<any>,
    expectedMaxTime: number,
    options?: StabilizedTestOptions
  ) => {
    return stabilizeTest(testName, async () => {
      const startTime = Date.now();

      // Don't use fake timers for performance tests
      jest.useRealTimers();

      await testFn();

      const executionTime = Date.now() - startTime;

      if (executionTime > expectedMaxTime) {
        throw new Error(
          `Performance test failed: took ${executionTime}ms, expected max ${expectedMaxTime}ms`
        );
      }
    }, {
      useFakeTimers: false,
      maxRetries: 1, // Don't retry performance tests
      ...options
    });
  }
};

/**
 * Stabilized describe blocks
 */
export function stabilizedDescribe(
  suiteName: string,
  suiteFn: () => void,
  options: StabilizedTestOptions = {}
) {
  describe(suiteName, () => {
    const suite = createStabilizedSuite(suiteName, options);

    // Make suite available to tests
    (global as any).__currentSuite = suite;

    suiteFn();

    // Clean up
    delete (global as any).__currentSuite;
  });
}

/**
 * Stabilized it/test blocks
 */
export const stabilizedIt = (
  testName: string,
  testFn: () => Promise<any> | any,
  options?: StabilizedTestOptions
) => {
  it(testName, stabilizeTest(testName, testFn, options));
};

export const stabilizedTestFn = stabilizedIt; // Alternative name

export default {
  stabilizedTest,
  stabilizedDescribe,
  stabilizedIt,
  createStabilizedSuite,
  Patterns
};