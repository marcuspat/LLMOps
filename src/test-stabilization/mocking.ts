/**
 * External Service Mocking Framework
 * Provides comprehensive mocking for external dependencies to eliminate environment-based flakiness
 */

import { jest } from '@jest/globals';

export interface MockConfig {
  enableNetworkMocking: boolean;
  enableDatabaseMocking: boolean;
  enableFileSystemMocking: boolean;
  enableAPIMocking: boolean;
  enableWebhookMocking: boolean;
  recordInteractions: boolean;
  defaultResponseTime: number;
  failureSimulation: FailureSimulationConfig;
}

export interface FailureSimulationConfig {
  enableRandomFailures: boolean;
  failureRate: number;
  failureTypes: string[];
  retryableFailures: string[];
}

export interface MockEndpoint {
  url: string | RegExp;
  method: string;
  response: any;
  status?: number;
  headers?: Record<string, string>;
  delay?: number;
  condition?: (request: any) => boolean;
  times?: number;
}

export interface DatabaseMockConfig {
  dialect: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
  database: string;
  schemas: any[];
  initialData?: Record<string, any[]>;
  transactionSupport: boolean;
  connectionPool: boolean;
}

export interface FileSystemMockConfig {
  rootDirectory: string;
  initialStructure: FileSystemNode;
  readOnly: boolean;
  caseSensitive: boolean;
  preserveTimestamps: boolean;
}

export interface FileSystemNode {
  type: 'file' | 'directory';
  content?: string;
  children?: Record<string, FileSystemNode>;
  permissions?: string;
  timestamp?: Date;
}

export interface WebhookMockConfig {
  endpoint: string;
  events: string[];
  secret?: string;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    baseDelay: number;
  };
}

/**
 * Mock Response Builder
 */
export class MockResponse {
  private response: any = {};
  private status: number = 200;
  private headers: Record<string, string> = {};
  private delay: number = 0;
  private condition?: (request: any) => boolean;

  static json(data: any, status: number = 200): MockResponse {
    const mock = new MockResponse();
    mock.response = data;
    mock.status = status;
    mock.headers['Content-Type'] = 'application/json';
    return mock;
  }

  static text(text: string, status: number = 200): MockResponse {
    const mock = new MockResponse();
    mock.response = text;
    mock.status = status;
    mock.headers['Content-Type'] = 'text/plain';
    return mock;
  }

  static status(status: number, message?: string): MockResponse {
    const mock = new MockResponse();
    mock.response = { error: message || 'Request failed' };
    mock.status = status;
    return mock;
  }

  withDelay(ms: number): MockResponse {
    this.delay = ms;
    return this;
  }

  withHeaders(headers: Record<string, string>): MockResponse {
    Object.assign(this.headers, headers);
    return this;
  }

  withCondition(condition: (request: any) => boolean): MockResponse {
    this.condition = condition;
    return this;
  }

  build(): MockEndpoint {
    return {
      url: '', // Will be set by MockManager
      method: 'GET',
      response: this.response,
      status: this.status,
      headers: this.headers,
      delay: this.delay,
      condition: this.condition
    };
  }
}

/**
 * Network Mocking Manager
 */
export class NetworkMockManager {
  private static instance: NetworkMockManager;
  private mocks = new Map<string, MockEndpoint[]>();
  private recordings = new Map<string, any[]>();
  private config: MockConfig;

  constructor(config: MockConfig) {
    this.config = config;
  }

  static getInstance(config?: MockConfig): NetworkMockManager {
    if (!NetworkMockManager.instance) {
      NetworkMockManager.instance = new NetworkMockManager(
        config || {
          enableNetworkMocking: true,
          enableDatabaseMocking: true,
          enableFileSystemMocking: true,
          enableAPIMocking: true,
          enableWebhookMocking: true,
          recordInteractions: true,
          defaultResponseTime: 100,
          failureSimulation: {
            enableRandomFailures: false,
            failureRate: 0.1,
            failureTypes: ['timeout', 'connection_error'],
            retryableFailures: ['timeout', 'rate_limit']
          }
        }
      );
    }
    return NetworkMockManager.instance;
  }

  /**
   * Setup network mocking
   */
  setup(): void {
    if (this.config.enableNetworkMocking) {
      this.setupFetchMock();
    }

    if (this.config.enableDatabaseMocking) {
      this.setupDatabaseMock();
    }

    if (this.config.enableFileSystemMocking) {
      this.setupFileSystemMock();
    }

    if (this.config.enableWebhookMocking) {
      this.setupWebhookMock();
    }
  }

  /**
   * Cleanup all mocks
   */
  cleanup(): void {
    // Restore original implementations
    this.restoreOriginalImplementations();

    // Clear recorded interactions
    this.recordings.clear();

    // Clear all mocks
    this.mocks.clear();
  }

  /**
   * Mock HTTP endpoint
   */
  mockEndpoint(endpoint: MockEndpoint): void {
    const key = this.getMockKey(endpoint.url, endpoint.method);
    if (!this.mocks.has(key)) {
      this.mocks.set(key, []);
    }
    this.mocks.get(key)!.push(endpoint);
  }

  /**
   * Mock GET request
   */
  mockGet(url: string | RegExp, response: any, options: {
    status?: number;
    headers?: Record<string, string>;
    delay?: number;
    condition?: (request: any) => boolean;
  } = {}): void {
    this.mockEndpoint({
      url,
      method: 'GET',
      response,
      status: options.status || 200,
      headers: options.headers,
      delay: options.delay || this.config.defaultResponseTime,
      condition: options.condition
    });
  }

  /**
   * Mock POST request
   */
  mockPost(url: string | RegExp, response: any, options: {
    status?: number;
    headers?: Record<string, string>;
    delay?: number;
    condition?: (request: any) => boolean;
  } = {}): void {
    this.mockEndpoint({
      url,
      method: 'POST',
      response,
      status: options.status || 200,
      headers: options.headers,
      delay: options.delay || this.config.defaultResponseTime,
      condition: options.condition
    });
  }

  /**
   * Mock PUT request
   */
  mockPut(url: string | RegExp, response: any, options: {
    status?: number;
    headers?: Record<string, string>;
    delay?: number;
    condition?: (request: any) => boolean;
  } = {}): void {
    this.mockEndpoint({
      url,
      method: 'PUT',
      response,
      status: options.status || 200,
      headers: options.headers,
      delay: options.delay || this.config.defaultResponseTime,
      condition: options.condition
    });
  }

  /**
   * Mock DELETE request
   */
  mockDelete(url: string | RegExp, response: any = {}, options: {
    status?: number;
    headers?: Record<string, string>;
    delay?: number;
    condition?: (request: any) => boolean;
  } = {}): void {
    this.mockEndpoint({
      url,
      method: 'DELETE',
      response,
      status: options.status || 204,
      headers: options.headers,
      delay: options.delay || this.config.defaultResponseTime,
      condition: options.condition
    });
  }

  /**
   * Simulate network failure
   */
  mockNetworkFailure(url: string | RegExp, method: string = 'GET', errorType: 'timeout' | 'connection_error' | 'rate_limit' = 'timeout'): void {
    this.mockEndpoint({
      url,
      method,
      response: () => {
        throw new Error(`Network ${errorType}`);
      },
      status: 0
    });
  }

  /**
   * Mock rate limiting
   */
  mockRateLimit(url: string | RegExp, limit: number = 10, windowMs: number = 60000): void {
    let requestCount = 0;
    let resetTime = Date.now() + windowMs;

    this.mockEndpoint({
      url,
      method: 'GET',
      response: () => {
        const now = Date.now();
        if (now >= resetTime) {
          requestCount = 0;
          resetTime = now + windowMs;
        }

        requestCount++;
        if (requestCount > limit) {
          throw new Error('Rate limit exceeded');
        }

        return { success: true, remaining: limit - requestCount };
      },
      status: 200,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': Math.max(0, limit - requestCount).toString(),
        'X-RateLimit-Reset': resetTime.toString()
      }
    });
  }

  /**
   * Get recorded interactions
   */
  getRecordedInteractions(url?: string | RegExp): any[] {
    if (!url) {
      return Array.from(this.recordings.values()).flat();
    }

    const key = this.getMockKey(url, '*');
    return this.recordings.get(key) || [];
  }

  /**
   * Clear recorded interactions
   */
  clearRecordings(url?: string | RegExp): void {
    if (url) {
      const key = this.getMockKey(url, '*');
      this.recordings.delete(key);
    } else {
      this.recordings.clear();
    }
  }

  /**
   * Setup fetch mock
   */
  private setupFetchMock(): void {
    if (typeof global.fetch !== 'undefined') {
      const originalFetch = global.fetch;

      global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method || 'GET';

        // Record interaction
        if (this.config.recordInteractions) {
          const key = this.getMockKey(url, method);
          if (!this.recordings.has(key)) {
            this.recordings.set(key, []);
          }
          this.recordings.get(key)!.push({
            url,
            method,
            headers: init?.headers,
            body: init?.body,
            timestamp: Date.now()
          });
        }

        // Check for matching mock
        const mock = this.findMatchingMock(url, method);
        if (mock) {
          // Simulate delay if configured
          if (mock.delay) {
            await this.sleep(mock.delay);
          }

          // Check condition if present
          if (mock.condition && !mock.condition({ url, method, init })) {
            // Try to find another mock or use original fetch
            return originalFetch(input, init);
          }

          // Check for simulated failure
          if (this.config.failureSimulation.enableRandomFailures) {
            if (Math.random() < this.config.failureSimulation.failureRate) {
              const failureType = this.config.failureSimulation.failureTypes[
                Math.floor(Math.random() * this.config.failureSimulation.failureTypes.length)
              ];
              throw new Error(`Simulated network failure: ${failureType}`);
            }
          }

          // Return mock response
          return new Response(JSON.stringify(mock.response), {
            status: mock.status,
            headers: mock.headers
          });
        }

        // Fallback to original fetch if no mock matches
        return originalFetch(input, init);
      };
    }
  }

  /**
   * Setup database mock
   */
  private setupDatabaseMock(): void {
    // This would integrate with your database mocking library
    // For example, with sqlite3 in-memory or mocked Sequelize
    const mockDatabase = {
      query: async (sql: string, params?: any[]) => {
        // Mock database query logic
        return { rows: [], rowCount: 0 };
      },
      transaction: async (callback: any) => {
        // Mock transaction logic
        return await callback();
      }
    };

    // Mock database connections based on your ORM
    if (typeof require !== 'undefined') {
      try {
        // Example for Sequelize-like mocking
        const Sequelize = require('sequelize');
        const originalSequelize = Sequelize;

        // Would need to implement proper Sequelize mocking here
        // This is just a conceptual example
      } catch (error) {
        // Sequelize not available
      }
    }
  }

  /**
   * Setup file system mock
   */
  private setupFileSystemMock(): void {
    const mockFileSystem = new Map<string, FileSystemNode>();

    // Mock fs module
    if (typeof require !== 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');

        // Mock fs operations
        const originalReadFileSync = fs.readFileSync;
        fs.readFileSync = (filePath: string, encoding?: string) => {
          const normalizedPath = path.normalize(filePath);
          const node = mockFileSystem.get(normalizedPath);

          if (!node || node.type !== 'file') {
            throw new Error(`File not found: ${filePath}`);
          }

          return node.content || '';
        };

        const originalWriteFileSync = fs.writeFileSync;
        fs.writeFileSync = (filePath: string, data: string | Buffer) => {
          const normalizedPath = path.normalize(filePath);
          mockFileSystem.set(normalizedPath, {
            type: 'file',
            content: data.toString(),
            timestamp: new Date()
          });
        };

        const originalExistsSync = fs.existsSync;
        fs.existsSync = (filePath: string) => {
          const normalizedPath = path.normalize(filePath);
          return mockFileSystem.has(normalizedPath);
        };

      } catch (error) {
        // fs module not available
      }
    }
  }

  /**
   * Setup webhook mock
   */
  private setupWebhookMock(): void {
    // Mock webhook endpoints for GitHub, Slack, etc.
    this.mockPost(/api\.github\.com\/webhooks/, {
      success: true,
      message: 'Webhook received'
    });

    this.mockPost(/hooks\.slack\.com/, {
      ok: true,
      message: 'Message sent'
    });

    this.mockPost(/discord\.com\/api\/webhooks/, {
      success: true,
      message: 'Discord message sent'
    });
  }

  /**
   * Find matching mock for request
   */
  private findMatchingMock(url: string, method: string): MockEndpoint | undefined {
    const key = this.getMockKey(url, method);
    const mocks = this.mocks.get(key);

    if (!mocks || mocks.length === 0) {
      return undefined;
    }

    // Return first matching mock
    return mocks.find(mock => {
      const mockUrl = mock.url;
      if (typeof mockUrl === 'string') {
        return url.includes(mockUrl);
      } else {
        return mockUrl.test(url);
      }
    });
  }

  /**
   * Get mock key for storage
   */
  private getMockKey(url: string | RegExp, method: string): string {
    if (typeof url === 'string') {
      return `${method}:${url}`;
    } else {
      return `${method}:${url.toString()}`;
    }
  }

  /**
   * Restore original implementations
   */
  private restoreOriginalImplementations(): void {
    // Restore fetch if it was mocked
    // This would require storing the original implementation
    // during setup phase
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Database Mocking Utilities
 */
export class DatabaseMocker {
  private static mockData = new Map<string, any[]>();
  private static schemas = new Map<string, any>();

  /**
   * Create mock database table
   */
  static createTable(name: string, schema: any, initialData: any[] = []): void {
    this.schemas.set(name, schema);
    this.mockData.set(name, [...initialData]);
  }

  /**
   * Insert data into mock table
   */
  static insert(tableName: string, data: any | any[]): void {
    const table = this.mockData.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    if (Array.isArray(data)) {
      table.push(...data);
    } else {
      table.push(data);
    }
  }

  /**
   * Query mock table
   */
  static query(tableName: string, filter?: (item: any) => boolean): any[] {
    const table = this.mockData.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    return filter ? table.filter(filter) : [...table];
  }

  /**
   * Update mock table
   */
  static update(tableName: string, filter: (item: any) => boolean, updates: Partial<any>): number {
    const table = this.mockData.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    let count = 0;
    for (const item of table) {
      if (filter(item)) {
        Object.assign(item, updates);
        count++;
      }
    }

    return count;
  }

  /**
   * Delete from mock table
   */
  static delete(tableName: string, filter?: (item: any) => boolean): number {
    const table = this.mockData.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    const originalLength = table.length;
    if (filter) {
      for (let i = table.length - 1; i >= 0; i--) {
        if (filter(table[i])) {
          table.splice(i, 1);
        }
      }
    } else {
      table.length = 0;
    }

    return originalLength - table.length;
  }

  /**
   * Clear mock table
   */
  static clear(tableName?: string): void {
    if (tableName) {
      this.mockData.set(tableName, []);
    } else {
      this.mockData.clear();
    }
  }

  /**
   * Get table schema
   */
  static getSchema(tableName: string): any {
    return this.schemas.get(tableName);
  }
}

/**
 * File System Mocking Utilities
 */
export class FileSystemMocker {
  private static files = new Map<string, string>();
  private static directories = new Set<string>();

  /**
   * Create mock file
   */
  static createFile(path: string, content: string): void {
    this.files.set(path, content);

    // Ensure parent directory exists
    const parentDir = path.dirname(path);
    if (!this.directories.has(parentDir)) {
      this.directories.add(parentDir);
    }
  }

  /**
   * Create mock directory
   */
  static createDirectory(path: string): void {
    this.directories.add(path);
  }

  /**
   * Read mock file
   */
  static readFile(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  /**
   * Write to mock file
   */
  static writeFile(path: string, content: string): void {
    this.files.set(path, content);

    // Ensure parent directory exists
    const parentDir = path.dirname(path);
    if (!this.directories.has(parentDir)) {
      this.directories.add(parentDir);
    }
  }

  /**
   * Check if file exists
   */
  static exists(path: string): boolean {
    return this.files.has(path) || this.directories.has(path);
  }

  /**
   * Delete file or directory
   */
  static delete(path: string): void {
    this.files.delete(path);
    this.directories.delete(path);
  }

  /**
   * List directory contents
   */
  static listDirectory(path: string): string[] {
    const contents: string[] = [];

    for (const file of this.files.keys()) {
      if (file.startsWith(path) && file.split('/').length === path.split('/').length + 1) {
        contents.push(file);
      }
    }

    for (const dir of this.directories) {
      if (dir.startsWith(path) && dir.split('/').length === path.split('/').length + 1) {
        contents.push(dir);
      }
    }

    return contents;
  }

  /**
   * Clear all mock files and directories
   */
  static clear(): void {
    this.files.clear();
    this.directories.clear();
  }
}

/**
 * Decorator for mocked tests
 */
export function withMocks(config: Partial<MockConfig> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const mockManager = NetworkMockManager.getInstance(config);

      try {
        mockManager.setup();
        return await originalMethod.apply(this, args);
      } finally {
        mockManager.cleanup();
      }
    };

    return descriptor;
  };
}

/**
 * Utility to create mock configurations
 */
export const MockConfig = {
  development: {
    enableNetworkMocking: true,
    enableDatabaseMocking: true,
    enableFileSystemMocking: true,
    enableAPIMocking: true,
    enableWebhookMocking: false,
    recordInteractions: true,
    defaultResponseTime: 50,
    failureSimulation: {
      enableRandomFailures: false,
      failureRate: 0.05,
      failureTypes: ['timeout'],
      retryableFailures: ['timeout']
    }
  } as MockConfig,

  testing: {
    enableNetworkMocking: true,
    enableDatabaseMocking: true,
    enableFileSystemMocking: true,
    enableAPIMocking: true,
    enableWebhookMocking: true,
    recordInteractions: true,
    defaultResponseTime: 10,
    failureSimulation: {
      enableRandomFailures: true,
      failureRate: 0.1,
      failureTypes: ['timeout', 'connection_error', 'rate_limit'],
      retryableFailures: ['timeout', 'rate_limit']
    }
  } as MockConfig,

  integration: {
    enableNetworkMocking: false,
    enableDatabaseMocking: true,
    enableFileSystemMocking: true,
    enableAPIMocking: true,
    enableWebhookMocking: true,
    recordInteractions: true,
    defaultResponseTime: 100,
    failureSimulation: {
      enableRandomFailures: false,
      failureRate: 0.02,
      failureTypes: ['timeout'],
      retryableFailures: ['timeout']
    }
  } as MockConfig
};

/**
 * Path utility for file system operations
 */
function path() {
  return {
    join: (...segments: string[]) => segments.join('/'),
    dirname: (filePath: string) => filePath.split('/').slice(0, -1).join('/'),
    normalize: (filePath: string) => filePath.replace(/\\/g, '/'),
    resolve: (...segments: string[]) => '/' + segments.filter(Boolean).join('/'),
    basename: (filePath: string) => filePath.split('/').pop() || '',
    extname: (filePath: string) => {
      const base = filePath.split('/').pop() || '';
      const dotIndex = base.lastIndexOf('.');
      return dotIndex > 0 ? base.substring(dotIndex) : '';
    }
  };
}