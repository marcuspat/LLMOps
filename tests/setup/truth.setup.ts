// Truth verification system test setup
import { jest } from '@jest/globals';

// Mock truth verification system
export const mockTruthSystem = {
  // Mock verification with 0.95+ threshold
  verify: jest.fn().mockImplementation((code: string) => {
    // Simulate high truth scores for test code
    return Promise.resolve({
      score: 0.97,
      passed: true,
      threshold: 0.95,
      analysis: 'Code passes truth verification',
    });
  }),

  // Mock enforcement
  enforce: jest.fn().mockImplementation((code: string) => {
    return Promise.resolve({
      enforced: true,
      score: 0.96,
      rollback: false,
      message: 'Code enforced successfully',
    });
  }),

  // Mock rollback mechanism
  rollback: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      rolledBack: true,
      reason: 'Truth threshold not met',
      previousState: 'stable',
    });
  }),
};

// Mock AI models for truth verification
export const mockAIModels = {
  // Claude model mock
  claude: {
    analyze: jest.fn().mockResolvedValue({
      analysis: 'Code structure is sound',
      confidence: 0.95,
      suggestions: [],
    }),
  },

  // OpenAI model mock
  openai: {
    analyze: jest.fn().mockResolvedValue({
      analysis: 'Logic appears correct',
      confidence: 0.94,
      suggestions: [],
    }),
  },

  // Local model mock
  local: {
    analyze: jest.fn().mockResolvedValue({
      analysis: 'Syntax is valid',
      confidence: 0.93,
      suggestions: [],
    }),
  },
};

// Global truth verification setup
beforeAll(() => {
  // Set truth verification environment variables
  process.env.TRUTH_THRESHOLD = '0.95';
  process.env.TRUTH_ENFORCEMENT = 'true';
  process.env.TRUTH_AUTO_ROLLBACK = 'true';
  process.env.TRUTH_MODELS = 'claude,openai,local';
});

// Setup truth system mocks
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();

  // Setup default successful verification
  mockTruthSystem.verify.mockResolvedValue({
    score: 0.97,
    passed: true,
    threshold: 0.95,
    analysis: 'Code passes truth verification',
  });
});

// Test utilities for truth verification
export const truthTestUtils = {
  // Create mock code that passes verification
  createPassingCode: () => `
    function testFunction() {
      return true;
    }
  `,

  // Create mock code that fails verification
  createFailingCode: () => `
    function problematicFunction() {
      // This would fail verification
      return undefined;
    }
  `,

  // Simulate verification below threshold
  simulateLowTruthScore: () => {
    mockTruthSystem.verify.mockResolvedValueOnce({
      score: 0.85,
      passed: false,
      threshold: 0.95,
      analysis: 'Code does not meet truth threshold',
    });
  },

  // Simulate enforcement failure
  simulateEnforcementFailure: () => {
    mockTruthSystem.enforce.mockResolvedValueOnce({
      enforced: false,
      score: 0.89,
      rollback: true,
      message: 'Enforcement failed, triggering rollback',
    });
  },

  // Get verification metrics
  getVerificationMetrics: () => ({
    totalVerifications: mockTruthSystem.verify.mock.calls.length,
    totalEnforcements: mockTruthSystem.enforce.mock.calls.length,
    totalRollbacks: mockTruthSystem.rollback.mock.calls.length,
    averageScore: 0.95,
  }),
};

// Export mocks for use in tests
global.mockTruthSystem = mockTruthSystem;
global.mockAIModels = mockAIModels;
global.truthTestUtils = truthTestUtils;