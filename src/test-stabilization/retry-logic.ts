/**
 * Advanced Retry Logic and Timing Control for Test Stabilization
 * Implements intelligent retry strategies and adaptive timeout management
 */

import { TestFailure, TestEnvironment } from './framework.js';

export interface RetryStrategy {
  name: string;
  shouldRetry: (error: Error, attempt: number, context: RetryContext) => boolean;
  calculateDelay: (attempt: number, baseDelay: number) => number;
  maxAttempts: number;
}

export interface RetryContext {
  testName: string;
  totalAttempts: number;
  previousErrors: Error[];
  executionTime: number;
  environment: TestEnvironment;
  startTime: number;
}

export interface TimingConfig {
  baseTimeout: number;
  maxTimeout: number;
  adaptiveMultiplier: number;
  timeoutVariance: number;
  enableDynamicAdjustment: boolean;
  historicalWeighting: number;
}

export interface WaitStrategy {
  name: string;
  wait: (condition: () => boolean | Promise<boolean>, options: WaitOptions) => Promise<void>;
}

export interface WaitOptions {
  timeout: number;
  interval: number;
  message?: string;
  throwOnTimeout: boolean;
}

export interface PollingOptions extends WaitOptions {
  successCondition: (result: any) => boolean;
  failureCondition?: (result: any) => boolean;
  maxAttempts?: number;
}

/**
 * Retry Logic Manager
 */
export class RetryLogicManager {
  private static strategies = new Map<string, RetryStrategy>();
  private static waitStrategies = new Map<string, WaitStrategy>();

  static {
    this.initializeDefaultStrategies();
  }

  /**
   * Register a custom retry strategy
   */
  static registerStrategy(name: string, strategy: RetryStrategy): void {
    this.strategies.set(name, strategy);
  }

  /**
   * Get a retry strategy by name
   */
  static getStrategy(name: string): RetryStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Execute function with specified retry strategy
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T> | T,
    strategyName: string,
    context: Partial<RetryContext> = {},
    options: {
      baseDelay?: number;
      maxDelay?: number;
      timeout?: number;
      onError?: (error: Error, attempt: number) => void;
    } = {}
  ): Promise<T> {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) {
      throw new Error(`Unknown retry strategy: ${strategyName}`);
    }

    const retryContext: RetryContext = {
      testName: context.testName || 'unknown',
      totalAttempts: 0,
      previousErrors: [],
      executionTime: 0,
      environment: this.captureEnvironment(),
      startTime: Date.now(),
      ...context
    };

    let lastError: Error | undefined;
    const baseDelay = options.baseDelay || 1000;
    const maxDelay = options.maxDelay || 30000;

    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      retryContext.totalAttempts = attempt;

      try {
        const startTime = Date.now();
        const result = await this.executeWithTimeout(fn, options.timeout);
        retryContext.executionTime = Date.now() - startTime;
        return result;
      } catch (error) {
        lastError = error as Error;
        retryContext.previousErrors.push(lastError);

        // Call error handler if provided
        if (options.onError) {
          options.onError(lastError, attempt);
        }

        // Check if we should retry
        if (attempt === strategy.maxAttempts || !strategy.shouldRetry(lastError, attempt, retryContext)) {
          break;
        }

        // Calculate delay and wait
        const delay = Math.min(
          strategy.calculateDelay(attempt, baseDelay),
          maxDelay
        );

        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }

    throw this.enhanceRetryError(lastError!, retryContext);
  }

  /**
   * Execute function with timeout
   */
  private static async executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeout?: number
  ): Promise<T> {
    if (!timeout) {
      return fn();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Register a custom wait strategy
   */
  static registerWaitStrategy(name: string, strategy: WaitStrategy): void {
    this.waitStrategies.set(name, strategy);
  }

  /**
   * Wait for condition using specified strategy
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    strategyName: string = 'exponential',
    options: WaitOptions = {
      timeout: 30000,
      interval: 100,
      throwOnTimeout: true
    }
  ): Promise<void> {
    const strategy = this.waitStrategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown wait strategy: ${strategyName}`);
    }

    await strategy.wait(condition, options);
  }

  /**
   * Enhanced error with retry context
   */
  private static enhanceRetryError(error: Error, context: RetryContext): Error {
    const enhancedMessage = `${error.message}\n\n` +
      `Retry Context:\n` +
      `- Test: ${context.testName}\n` +
      `- Attempts: ${context.totalAttempts}\n` +
      `- Total Time: ${Date.now() - context.startTime}ms\n` +
      `- Previous Errors: ${context.previousErrors.length}\n` +
      `- Strategy Failed: Reached max attempts or non-retryable error`;

    const enhancedError = new Error(enhancedMessage);
    enhancedError.name = `RetryError: ${error.name}`;
    enhancedError.stack = error.stack;

    return enhancedError;
  }

  /**
   * Capture current test environment
   */
  private static captureEnvironment(): TestEnvironment {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      concurrentTests: 0 // Would be set by the framework
    };
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize default retry strategies
   */
  private static initializeDefaultStrategies(): void {
    // Exponential backoff strategy
    this.registerStrategy('exponential', {
      name: 'exponential',
      maxAttempts: 3,
      shouldRetry: (error, attempt) => {
        // Retry on timeout, connection, and network errors
        const retryablePatterns = [
          /timeout/i,
          /connection|network/i,
          /ECONNREFUSED|ETIMEDOUT/i,
          /fetch/i,
          /database/i
        ];
        return retryablePatterns.some(pattern => pattern.test(error.message));
      },
      calculateDelay: (attempt, baseDelay) => {
        return baseDelay * Math.pow(2, attempt - 1);
      }
    });

    // Linear backoff strategy
    this.registerStrategy('linear', {
      name: 'linear',
      maxAttempts: 5,
      shouldRetry: (error, attempt) => {
        return /timeout|connection/i.test(error.message);
      },
      calculateDelay: (attempt, baseDelay) => {
        return baseDelay * attempt;
      }
    });

    // Fixed delay strategy
    this.registerStrategy('fixed', {
      name: 'fixed',
      maxAttempts: 3,
      shouldRetry: (error, attempt) => {
        return attempt <= 2; // Always retry first 2 attempts
      },
      calculateDelay: () => 1000
    });

    // Adaptive strategy based on error type
    this.registerStrategy('adaptive', {
      name: 'adaptive',
      maxAttempts: 4,
      shouldRetry: (error, attempt) => {
        if (attempt >= 4) return false;

        const message = error.message.toLowerCase();
        if (message.includes('timeout')) return true;
        if (message.includes('connection')) return attempt <= 3;
        if (message.includes('network')) return attempt <= 2;
        if (message.includes('database')) return attempt <= 3;

        return false;
      },
      calculateDelay: (attempt, baseDelay) => {
        const message = arguments[0]?.message?.toLowerCase() || '';
        let multiplier = 1;

        if (message.includes('timeout')) multiplier = 3;
        else if (message.includes('connection')) multiplier = 2;
        else if (message.includes('database')) multiplier = 1.5;

        return baseDelay * multiplier * attempt;
      }
    });

    // Aggressive retry strategy for known flaky tests
    this.registerStrategy('aggressive', {
      name: 'aggressive',
      maxAttempts: 7,
      shouldRetry: (error, attempt) => {
        return attempt < 7; // Always retry up to 7 times
      },
      calculateDelay: (attempt, baseDelay) => {
        return Math.min(baseDelay * attempt, 5000);
      }
    });

    // Conservative retry strategy
    this.registerStrategy('conservative', {
      name: 'conservative',
      maxAttempts: 2,
      shouldRetry: (error, attempt) => {
        return attempt === 1 && /timeout/i.test(error.message);
      },
      calculateDelay: () => 2000
    });

    // Initialize default wait strategies
    this.initializeDefaultWaitStrategies();
  }

  /**
   * Initialize default wait strategies
   */
  private static initializeDefaultWaitStrategies(): void {
    // Exponential backoff wait
    this.registerWaitStrategy('exponential', {
      name: 'exponential',
      wait: async (condition, options) => {
        const startTime = Date.now();
        let interval = options.interval || 100;
        let attempt = 0;

        while (Date.now() - startTime < options.timeout) {
          try {
            if (await condition()) {
              return;
            }
          } catch (error) {
            // Continue waiting on condition evaluation errors
          }

          attempt++;
          await this.sleep(Math.min(interval * Math.pow(1.5, attempt), 5000));
        }

        if (options.throwOnTimeout) {
          throw new Error(
            `Wait condition not met after ${options.timeout}ms${
              options.message ? `: ${options.message}` : ''
            }`
          );
        }
      }
    });

    // Linear wait with fixed interval
    this.registerWaitStrategy('linear', {
      name: 'linear',
      wait: async (condition, options) => {
        const startTime = Date.now();
        const interval = options.interval || 500;

        while (Date.now() - startTime < options.timeout) {
          try {
            if (await condition()) {
              return;
            }
          } catch (error) {
            // Continue waiting on condition evaluation errors
          }

          await this.sleep(interval);
        }

        if (options.throwOnTimeout) {
          throw new Error(
            `Wait condition not met after ${options.timeout}ms${
              options.message ? `: ${options.message}` : ''
            }`
          );
        }
      }
    });

    // Polling wait with configurable interval
    this.registerWaitStrategy('polling', {
      name: 'polling',
      wait: async (condition, options) => {
        const startTime = Date.now();
        const interval = options.interval || 1000;
        let attempts = 0;
        const maxAttempts = Math.floor(options.timeout / interval);

        while (attempts < maxAttempts) {
          try {
            const result = await condition();
            if (typeof result === 'boolean') {
              if (result) return;
            } else if (result !== null && result !== undefined) {
              // Non-boolean result, condition considered met
              return;
            }
          } catch (error) {
            // Continue waiting on condition evaluation errors
          }

          attempts++;
          await this.sleep(interval);
        }

        if (options.throwOnTimeout) {
          throw new Error(
            `Polling condition not met after ${attempts} attempts${
              options.message ? `: ${options.message}` : ''
            }`
          );
        }
      }
    });
  }
}

/**
 * Adaptive Timeout Manager
 */
export class AdaptiveTimeoutManager {
  private static executionHistory = new Map<string, number[]>();

  /**
   * Calculate adaptive timeout for a test
   */
  static calculateAdaptiveTimeout(
    testName: string,
    baseTimeout: number,
    config: TimingConfig = {
      baseTimeout: 30000,
      maxTimeout: 300000,
      adaptiveMultiplier: 1.5,
      timeoutVariance: 0.3,
      enableDynamicAdjustment: true,
      historicalWeighting: 0.7
    }
  ): number {
    const history = this.executionHistory.get(testName) || [];

    if (history.length === 0 || !config.enableDynamicAdjustment) {
      return baseTimeout;
    }

    // Calculate historical average
    const historicalAverage = history.reduce((sum, time) => sum + time, 0) / history.length;

    // Apply weighted average between historical and base timeout
    const weightedTimeout =
      (historicalAverage * config.historicalWeighting) +
      (baseTimeout * (1 - config.historicalWeighting));

    // Apply adaptive multiplier
    const adaptiveTimeout = weightedTimeout * config.adaptiveMultiplier;

    // Apply variance to account for execution time fluctuations
    const variance = adaptiveTimeout * config.timeoutVariance;

    const finalTimeout = Math.min(
      adaptiveTimeout + variance,
      config.maxTimeout
    );

    return Math.max(finalTimeout, baseTimeout); // Never go below base timeout
  }

  /**
   * Record execution time for adaptive learning
   */
  static recordExecution(testName: string, executionTime: number): void {
    if (!this.executionHistory.has(testName)) {
      this.executionHistory.set(testName, []);
    }

    const history = this.executionHistory.get(testName)!;
    history.push(executionTime);

    // Keep only recent executions (last 10)
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  /**
   * Get timeout statistics for a test
   */
  static getTimeoutStats(testName: string): {
    average: number;
    min: number;
    max: number;
    count: number;
    recommendedTimeout: number;
  } | null {
    const history = this.executionHistory.get(testName);
    if (!history || history.length === 0) {
      return null;
    }

    const average = history.reduce((sum, time) => sum + time, 0) / history.length;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const count = history.length;

    // Recommended timeout is max * 1.5 but not exceeding 5 minutes
    const recommendedTimeout = Math.min(max * 1.5, 300000);

    return {
      average,
      min,
      max,
      count,
      recommendedTimeout
    };
  }

  /**
   * Clear execution history for a test
   */
  static clearHistory(testName?: string): void {
    if (testName) {
      this.executionHistory.delete(testName);
    } else {
      this.executionHistory.clear();
    }
  }
}

/**
 * Utility functions for common wait patterns
 */
export class WaitHelpers {
  /**
   * Wait for DOM element to be visible
   */
  static async waitForElement(
    selector: string,
    options: WaitOptions = {
      timeout: 30000,
      interval: 500,
      throwOnTimeout: true,
      message: `Element ${selector} not found`
    }
  ): Promise<void> {
    await RetryLogicManager.waitFor(
      () => {
        const element = document.querySelector(selector);
        return element !== null && (element as any).offsetParent !== null;
      },
      'exponential',
      options
    );
  }

  /**
   * Wait for DOM element to be hidden
   */
  static async waitForElementHidden(
    selector: string,
    options: WaitOptions = {
      timeout: 30000,
      interval: 500,
      throwOnTimeout: true,
      message: `Element ${selector} still visible`
    }
  ): Promise<void> {
    await RetryLogicManager.waitFor(
      () => {
        const element = document.querySelector(selector);
        return element === null || (element as any).offsetParent === null;
      },
      'exponential',
      options
    );
  }

  /**
   * Wait for text to appear in element
   */
  static async waitForText(
    selector: string,
    text: string,
    options: WaitOptions = {
      timeout: 30000,
      interval: 500,
      throwOnTimeout: true,
      message: `Text "${text}" not found in element ${selector}`
    }
  ): Promise<void> {
    await RetryLogicManager.waitFor(
      () => {
        const element = document.querySelector(selector);
        return element !== null && element.textContent?.includes(text);
      },
      'exponential',
      options
    );
  }

  /**
   * Wait for network request to complete
   */
  static async waitForNetworkRequest(
    urlPattern: string | RegExp,
    options: WaitOptions = {
      timeout: 30000,
      interval: 100,
      throwOnTimeout: true,
      message: `Network request matching ${urlPattern} not completed`
    }
  ): Promise<void> {
    const requests = [] as string[];

    // Intercept network requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = args[0]?.toString() || '';
      requests.push(url);
      return originalFetch.apply(window, args);
    };

    await RetryLogicManager.waitFor(
      () => {
        const pattern = urlPattern instanceof RegExp ? urlPattern : new RegExp(urlPattern);
        return requests.some(url => pattern.test(url));
      },
      'exponential',
      options
    );

    // Restore original fetch
    window.fetch = originalFetch;
  }

  /**
   * Wait for condition with polling
   */
  static async pollForCondition<T>(
    condition: () => Promise<T>,
    options: PollingOptions = {
      timeout: 30000,
      interval: 1000,
      throwOnTimeout: true,
      successCondition: (result) => !!result
    }
  ): Promise<T> {
    let result: T | undefined;
    let attempts = 0;
    const maxAttempts = options.maxAttempts || Math.floor(options.timeout / options.interval);

    while (attempts < maxAttempts) {
      try {
        result = await condition();

        if (options.successCondition(result)) {
          return result;
        }

        if (options.failureCondition && options.failureCondition(result)) {
          throw new Error(`Polling condition failed: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        // Continue polling on errors, unless it's a failure condition
        if (options.failureCondition && options.failureCondition(error)) {
          throw error;
        }
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, options.interval));
    }

    if (options.throwOnTimeout) {
      throw new Error(
        `Polling condition not met after ${attempts} attempts${
          options.message ? `: ${options.message}` : ''
        }`
      );
    }

    return result!;
  }
}

/**
 * Decorator for retry logic
 */
export function withRetry(
  strategy: string = 'exponential',
  options: {
    baseDelay?: number;
    maxDelay?: number;
    timeout?: number;
    onError?: (error: Error, attempt: number) => void;
  } = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return RetryLogicManager.executeWithRetry(
        () => originalMethod.apply(this, args),
        strategy,
        { testName: `${target.constructor.name}.${propertyKey}` },
        options
      );
    };

    return descriptor;
  };
}

/**
 * Decorator for adaptive timeout
 */
export function withAdaptiveTimeout(
  baseTimeout: number,
  config?: Partial<TimingConfig>
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const testName = `${target.constructor.name}.${propertyKey}`;
      const adaptiveTimeout = AdaptiveTimeoutManager.calculateAdaptiveTimeout(
        testName,
        baseTimeout,
        config
      );

      const startTime = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const executionTime = Date.now() - startTime;
        AdaptiveTimeoutManager.recordExecution(testName, executionTime);
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        AdaptiveTimeoutManager.recordExecution(testName, executionTime);
        throw error;
      }
    };

    return descriptor;
  };
}