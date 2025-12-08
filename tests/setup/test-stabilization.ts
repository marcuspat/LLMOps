/**
 * Test Stabilization Setup
 *
 * Global setup for eliminating test flakiness through:
 * - Fake timers for deterministic time handling
 * - Comprehensive mocking of external dependencies
 * - Proper cleanup and teardown procedures
 * - Race condition prevention
 * - Retry logic for intermittent issues
 */

import { jest } from '@jest/globals';

// Global state for test stabilization
const testStabilizationState = {
  timers: {
    fake: false,
    callbacks: new Set<() => void>(),
    intervals: new Set<NodeJS.Timeout>(),
    timeouts: new Set<NodeJS.Timeout>()
  },
  mocks: {
    network: new Map<string, any>(),
    database: new Map<string, any>(),
    filesystem: new Map<string, any>()
  },
  cleanup: {
    resources: new Set<() => Promise<void>>(),
    tempDirs: new Set<string>(),
    tempFiles: new Set<string>()
  }
};

// Initialize fake timers globally
export function initializeFakeTimers() {
  if (!testStabilizationState.timers.fake) {
    jest.useFakeTimers({
      advanceTimers: true,
      doNotFake: ['nextTick', 'setImmediate'] // Keep these real for proper async handling
    });

    // Override setTimeout/setInterval to track them
    const originalSetTimeout = global.setTimeout;
    const originalSetInterval = global.setInterval;
    const originalClearTimeout = global.clearTimeout;
    const originalClearInterval = global.clearInterval;

    global.setTimeout = jest.fn().mockImplementation((callback, delay, ...args) => {
      const timeoutId = originalSetTimeout(callback, delay, ...args);
      testStabilizationState.timers.timeouts.add(timeoutId);
      return timeoutId;
    });

    global.setInterval = jest.fn().mockImplementation((callback, delay, ...args) => {
      const intervalId = originalSetInterval(callback, delay, ...args);
      testStabilizationState.timers.intervals.add(intervalId);
      return intervalId;
    });

    global.clearTimeout = jest.fn().mockImplementation((timeoutId) => {
      testStabilizationState.timers.timeouts.delete(timeoutId);
      return originalClearTimeout(timeoutId);
    });

    global.clearInterval = jest.fn().mockImplementation((intervalId) => {
      testStabilizationState.timers.intervals.delete(intervalId);
      return originalClearInterval(intervalId);
    });

    testStabilizationState.timers.fake = true;
  }
}

// Mock external network requests
export function setupNetworkMocks() {
  // Mock fetch API
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      headers: new Map()
    })
  );

  // Mock XMLHttpRequest
  global.XMLHttpRequest = jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    send: jest.fn(),
    setRequestHeader: jest.fn(),
    addEventListener: jest.fn(),
    readyState: 4,
    status: 200,
    response: JSON.stringify({ success: true })
  }));

  // Mock WebSocket
  global.WebSocket = jest.fn().mockImplementation(() => ({
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  }));
}

// Mock database operations
export function setupDatabaseMocks() {
  // Mock common database operations
  const mockDB = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    transaction: jest.fn().mockImplementation((callback) => callback()),
    begin: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    prepare: jest.fn().mockReturnValue({
      run: jest.fn().mockResolvedValue({ changes: 0, lastID: 1 }),
      get: jest.fn().mockResolvedValue(null),
      all: jest.fn().mockResolvedValue([])
    })
  };

  // Add to global mocks registry
  testStabilizationState.mocks.database.set('default', mockDB);

  // Make mock available globally
  (global as any).__mockDB = mockDB;
}

// Mock filesystem operations
export function setupFilesystemMocks() {
  const fs = require('fs');
  const path = require('path');

  // Mock fs operations
  jest.mock('fs', () => ({
    ...fs,
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('mock file content'),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn().mockReturnValue(['file1.txt', 'file2.txt']),
    statSync: jest.fn().mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date()
    })
  }));

  // Mock path operations for deterministic behavior
  jest.mock('path', () => ({
    ...path,
    resolve: jest.fn().mockImplementation((...args) => args.join('/')),
    join: jest.fn().mockImplementation((...args) => args.join('/')),
    basename: jest.fn().mockImplementation((p) => p.split('/').pop() || ''),
    dirname: jest.fn().mockImplementation((p) => p.split('/').slice(0, -1).join('/') || '.')
  }));
}

// Setup comprehensive cleanup
export function setupTestCleanup() {
  // Register cleanup function
  afterEach(() => {
    // Clear all timers
    testStabilizationState.timers.timeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    testStabilizationState.timers.intervals.forEach(intervalId => {
      clearInterval(intervalId);
    });

    testStabilizationState.timers.timeouts.clear();
    testStabilizationState.timers.intervals.clear();

    // Clear all mock states
    jest.clearAllMocks();

    // Reset modules that might have state
    jest.resetModules();

    // Execute cleanup callbacks
    testStabilizationState.cleanup.resources.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    });
    testStabilizationState.cleanup.resources.clear();

    // Clean up temporary files/dirs if they exist
    const fs = require('fs');
    testStabilizationState.cleanup.tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    testStabilizationState.cleanup.tempFiles.clear();

    testStabilizationState.cleanup.tempDirs.forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          fs.rmdirSync(dir, { recursive: true });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    testStabilizationState.cleanup.tempDirs.clear();
  });
}

// Prevent race conditions with async utilities
export function createAsyncUtils() {
  return {
    // Wait for condition with timeout
    waitForCondition: async (
      condition: () => boolean | Promise<boolean>,
      options: { timeout?: number; interval?: number } = {}
    ): Promise<void> => {
      const { timeout = 5000, interval = 100 } = options;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        if (await condition()) {
          return;
        }
        await new Promise(resolve => {
          const timeoutId = setTimeout(resolve, interval);
          testStabilizationState.timers.timeouts.add(timeoutId);
        });
      }

      throw new Error(`Condition not met within ${timeout}ms`);
    },

    // Promise with timeout
    withTimeout: <T>(
      promise: Promise<T>,
      timeoutMs: number,
      timeoutError: Error = new Error(`Operation timed out after ${timeoutMs}ms`)
    ): Promise<T> => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => reject(timeoutError), timeoutMs);
        testStabilizationState.timers.timeouts.add(timeoutId);
      });

      return Promise.race([promise, timeoutPromise]);
    },

    // Execute in order to prevent race conditions
    sequential: async <T>(functions: Array<() => Promise<T>>): Promise<T[]> => {
      const results: T[] = [];
      for (const fn of functions) {
        results.push(await fn());
      }
      return results;
    }
  };
}

// Retry utility for flaky operations
export function createRetryUtils() {
  return {
    // Retry with exponential backoff
    retry: async <T>(
      fn: () => Promise<T>,
      options: {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        factor?: number;
        retryIf?: (error: any) => boolean;
      } = {}
    ): Promise<T> => {
      const {
        maxRetries = 3,
        initialDelay = 100,
        maxDelay = 5000,
        factor = 2,
        retryIf = () => true
      } = options;

      let lastError: any;
      let delay = initialDelay;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;

          if (attempt === maxRetries || !retryIf(error)) {
            throw error;
          }

          // Wait with exponential backoff
          await new Promise(resolve => {
            const timeoutId = setTimeout(resolve, delay);
            testStabilizationState.timers.timeouts.add(timeoutId);
          });

          delay = Math.min(delay * factor, maxDelay);
        }
      }

      throw lastError;
    },

    // Retry with jitter for distributed systems
    retryWithJitter: async <T>(
      fn: () => Promise<T>,
      options: {
        maxRetries?: number;
        baseDelay?: number;
        maxDelay?: number;
        jitter?: boolean;
      } = {}
    ): Promise<T> => {
      const {
        maxRetries = 3,
        baseDelay = 100,
        maxDelay = 5000,
        jitter = true
      } = options;

      let lastError: any;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;

          if (attempt === maxRetries) {
            throw error;
          }

          // Calculate delay with jitter
          let delay = baseDelay * Math.pow(2, attempt);
          if (jitter) {
            delay = delay * (0.5 + Math.random() * 0.5);
          }
          delay = Math.min(delay, maxDelay);

          await new Promise(resolve => {
            const timeoutId = setTimeout(resolve, delay);
            testStabilizationState.timers.timeouts.add(timeoutId);
          });
        }
      }

      throw lastError;
    }
  };
}

// Test stabilization helpers
export const TestStabilization = {
  // Initialize all stabilization features
  initialize() {
    initializeFakeTimers();
    setupNetworkMocks();
    setupDatabaseMocks();
    setupFilesystemMocks();
    setupTestCleanup();
  },

  // Advance fake timers safely
  advanceTimers: (ms: number) => {
    if (testStabilizationState.timers.fake) {
      jest.advanceTimersByTime(ms);
    }
  },

  // Run all pending timers
  runAllTimers: () => {
    if (testStabilizationState.timers.fake) {
      jest.runAllTimers();
    }
  },

  // Run only pending timers up to current time
  runOnlyPendingTimers: () => {
    if (testStabilizationState.timers.fake) {
      jest.runOnlyPendingTimers();
    }
  },

  // Clear all timers
  clearAllTimers: () => {
    if (testStabilizationState.timers.fake) {
      jest.clearAllTimers();
    }
  },

  // Register cleanup callback
  registerCleanup: (cleanup: () => Promise<void>) => {
    testStabilizationState.cleanup.resources.add(cleanup);
  },

  // Register temporary file for cleanup
  registerTempFile: (filePath: string) => {
    testStabilizationState.cleanup.tempFiles.add(filePath);
  },

  // Register temporary directory for cleanup
  registerTempDir: (dirPath: string) => {
    testStabilizationState.cleanup.tempDirs.add(dirPath);
  },

  // Get mock database
  getMockDB: (name: string = 'default') => {
    return testStabilizationState.mocks.database.get(name);
  },

  // Get async utilities
  async: createAsyncUtils(),

  // Get retry utilities
  retry: createRetryUtils()
};

// Export for use in tests
export default TestStabilization;