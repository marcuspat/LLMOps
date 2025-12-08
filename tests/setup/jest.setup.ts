/**
 * Jest Setup File
 * Global test configuration and mocks with comprehensive test stabilization
 */

import TestStabilization from './test-stabilization';

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-for-jwt-testing";
process.env.CORS_ORIGINS = "http://localhost:3000";

// Initialize test stabilization before all tests
beforeAll(() => {
  // Initialize comprehensive test stabilization
  TestStabilization.initialize();

  // Mock console methods in tests to reduce noise
  const originalConsole = global.console;
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  // Return original console after tests
  (global as any).__originalConsole = originalConsole;
});

afterAll(() => {
  // Restore original console
  if ((global as any).__originalConsole) {
    global.console = (global as any).__originalConsole;
  }
});

// Global test helpers with stabilization
global.createMockRequest = (overrides = {}) => ({
  headers: {},
  query: {},
  params: {},
  body: {},
  ip: "127.0.0.1",
  ...overrides
});

global.createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

global.createMockNext = () => jest.fn();

// Global stabilization utilities for tests
global.TestStabilization = TestStabilization;

// Global async utilities
global.waitForCondition = TestStabilization.async.waitForCondition;
global.withTimeout = TestStabilization.async.withTimeout;
global.sequential = TestStabilization.async.sequential;

// Global retry utilities
global.retry = TestStabilization.retry.retry;
global.retryWithJitter = TestStabilization.retry.retryWithJitter;

// Global mock getters
global.getMockDB = TestStabilization.getMockDB;

// Global cleanup utilities
global.registerCleanup = TestStabilization.registerCleanup;
global.registerTempFile = TestStabilization.registerTempFile;
global.registerTempDir = TestStabilization.registerTempDir;
