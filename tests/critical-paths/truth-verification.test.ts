/**
 * Truth Verification Core Logic Critical Path Tests
 * Comprehensive testing for 0.95 threshold enforcement and consensus mechanisms
 */

import { TruthVerification } from '../../src/core/TruthVerification.js';
import {
  TruthVerificationRequest,
  TruthVerificationResult,
  VerificationType,
  IssueSeverity
} from '../../src/types/index.js';

describe('TruthVerification Core Logic - Critical Path Tests', () => {
  let truthVerification: TruthVerification;

  beforeEach(() => {
    truthVerification = TruthVerification.getInstance();
  });

  describe('0.95 Threshold Enforcement', () => {
    describe('Boundary Conditions', () => {
      it('should accept exact threshold score of 0.95', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'function test() { return true; }', // Simple valid code
          threshold: 0.95,
          context: {}
        };

        // Mock the rule execution to return exact 0.95
        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.95)]);

        const result = await truthVerification.verify(request);

        expect(result.passed).toBe(true);
        expect(result.score).toBe(0.95);
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should reject score just below threshold (0.949)', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'function test() { return true; }',
          threshold: 0.95,
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.949)]);

        const result = await truthVerification.verify(request);

        expect(result.passed).toBe(false);
        expect(result.score).toBe(0.949);
        expect(result.details.issues).toHaveLength(0); // Score below threshold but no issues
      });

      it('should accept score above threshold (0.951)', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'function test() { return true; }',
          threshold: 0.95,
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.951)]);

        const result = await truthVerification.verify(request);

        expect(result.passed).toBe(true);
        expect(result.score).toBe(0.951);
      });

      it('should handle default threshold when not specified', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'function test() { return true; }',
          // No threshold specified
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.95)]);

        const result = await truthVerification.verify(request);

        // Should use default 0.95 threshold
        expect(result.passed).toBe(true);
        expect(result.score).toBe(0.95);
      });

      it('should reject extreme low scores (0.0)', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'malformed code with many issues',
          threshold: 0.95,
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.0)]);

        const result = await truthVerification.verify(request);

        expect(result.passed).toBe(false);
        expect(result.score).toBe(0.0);
      });

      it('should accept perfect scores (1.0)', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'function perfect() { return true; }',
          threshold: 0.95,
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(1.0)]);

        const result = await truthVerification.verify(request);

        expect(result.passed).toBe(true);
        expect(result.score).toBe(1.0);
      });
    });

    describe('Multiple Rule Scenarios', () => {
      it('should calculate average score across multiple rules', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'function test() { return true; }',
          threshold: 0.95,
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([
            createMockRule(1.0),
            createMockRule(0.9),
            createMockRule(0.95)
          ]);

        const result = await truthVerification.verify(request);

        // Average: (1.0 + 0.9 + 0.95) / 3 = 0.95
        expect(result.score).toBeCloseTo(0.95, 2);
        expect(result.passed).toBe(true);
      });

      it('should reject when average score is below threshold', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'function test() { return true; }',
          threshold: 0.95,
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([
            createMockRule(1.0),
            createMockRule(0.8),
            createMockRule(0.9)
          ]);

        const result = await truthVerification.verify(request);

        // Average: (1.0 + 0.8 + 0.9) / 3 = 0.9
        expect(result.score).toBeCloseTo(0.9, 2);
        expect(result.passed).toBe(false);
      });

      it('should handle rule execution failures gracefully', async () => {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: 'function test() { return true; }',
          threshold: 0.95,
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([
            createMockRule(1.0),
            createFailingRule(),
            createMockRule(0.95)
          ]);

        const result = await truthVerification.verify(request);

        // Average of successful rules: (1.0 + 0.95) / 2 = 0.975
        expect(result.score).toBeCloseTo(0.975, 2);
        expect(result.passed).toBe(true);
        expect(result.details.issues).toHaveLength(1);
        expect(result.details.issues[0].type).toBe('rule_execution_error');
      });
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate high confidence with no issues', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.95,
        context: {}
      };

      jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.96, [])]);

      const result = await truthVerification.verify(request);

      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('should reduce confidence with critical issues', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.95,
        context: {}
      };

      jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.96, [
            { type: 'critical_issue', severity: IssueSeverity.CRITICAL, message: 'Critical issue' }
          ])]);

      const result = await truthVerification.verify(request);

      expect(result.confidence).toBeLessThan(0.8); // 1 - 0.2 = 0.8
    });

    it('should moderately reduce confidence with high issues', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.95,
        context: {}
      };

      jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.96, [
            { type: 'high_issue', severity: IssueSeverity.HIGH, message: 'High issue' }
          ])]);

      const result = await truthVerification.verify(request);

      expect(result.confidence).toBeLessThan(0.9); // 1 - 0.1 = 0.9
    });

    it('should handle multiple critical and high issues', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.95,
        context: {}
      };

      jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.96, [
            { type: 'critical_issue', severity: IssueSeverity.CRITICAL, message: 'Critical issue' },
            { type: 'high_issue', severity: IssueSeverity.HIGH, message: 'High issue' },
            { type: 'another_critical', severity: IssueSeverity.CRITICAL, message: 'Another critical' }
          ])]);

      const result = await truthVerification.verify(request);

      expect(result.confidence).toBeLessThan(0.5); // 1 - (3 * 0.2) = 0.4, but clamped to 0
    });
  });

  describe('Consensus Algorithm Tests', () => {
    it('should handle Byzantine failure scenarios', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.95,
        context: {}
      };

      // Simulate Byzantine behavior: some rules return conflicting results
      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([
          createMockRule(1.0), // Honest: high score
          createByzantineRule(0.0), // Malicious: zero score
          createMockRule(0.95), // Honest: threshold score
          createByzantineRule(0.1), // Malicious: low score
          createMockRule(0.98)  // Honest: high score
        ]);

      const result = await truthVerification.verify(request);

      // Should still reach reasonable consensus despite Byzantine nodes
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should achieve consensus with all honest nodes', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.95,
        context: {}
      };

      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([
          createMockRule(0.96),
          createMockRule(0.94),
          createMockRule(0.95),
          createMockRule(0.97),
          createMockRule(0.95)
        ]);

      const result = await truthVerification.verify(request);

      // Should achieve high confidence consensus
      expect(result.score).toBeCloseTo(0.954, 2); // Average of honest scores
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect and handle consensus deadlocks', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.95,
        context: {}
      };

      // Create rules that would deadlock (extreme opposing scores)
      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([
          createMockRule(1.0),
          createMockRule(0.0),
          createMockRule(1.0),
          createMockRule(0.0)
        ]);

      const result = await truthVerification.verify(request);

      // Should resolve deadlock by averaging
      expect(result.score).toBe(0.5);
      expect(result.passed).toBe(false);
      expect(result.details.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Security Tests', () => {
    it('should prevent code injection in rule execution', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function malicious() { while(true) {} }', // Infinite loop
        threshold: 0.95,
        context: {}
      };

      const mockRule = {
        execute: jest.fn().mockImplementation((content) => {
          // Attempt to execute the content (should not happen in real implementation)
          if (content.includes('while(true)')) {
            throw new Error('Potential infinite loop detected');
          }
          return {
            score: 0.8,
            issues: [{ type: 'infinite_loop', severity: IssueSeverity.CRITICAL, message: 'Potential infinite loop' }],
            suggestions: ['Remove infinite loops'],
            metrics: { complexity: 10 }
          };
        })
      };

      jest.spyOn(truthVerification as any, 'verificationRules').mockReturnValue([mockRule]);

      const result = await truthVerification.verify(request);

      expect(result.passed).toBe(false);
      expect(mockRule.execute).toHaveBeenCalled();
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({
          type: 'infinite_loop',
          severity: IssueSeverity.CRITICAL
        })
      );
    });

    it('should prevent timing attacks on threshold comparison', async () => {
      const request1: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test1() { return true; }',
        threshold: 0.95,
        context: {}
      };

      const request2: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test2() { return true; }',
        threshold: 0.95,
        context: {}
      };

      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([createMockRule(0.951)]);

      // Execute multiple requests and measure timing
      const start1 = Date.now();
      await truthVerification.verify(request1);
      const time1 = Date.now() - start1;

      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([createMockRule(0.949)]);

      const start2 = Date.now();
      await truthVerification.verify(request2);
      const time2 = Date.now() - start2;

      // Timing differences should be minimal (within reasonable variance)
      const timeDiff = Math.abs(time1 - time2);
      expect(timeDiff).toBeLessThan(100); // Less than 100ms difference
    });

    it('should handle resource exhaustion attacks', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: 'x'.repeat(10000000), // Very large content
        threshold: 0.95,
        context: {}
      };

      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([createMockRule(0.8)]);

      // Should handle large content without crashing
      const startTime = Date.now();
      const result = await truthVerification.verify(request);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Performance Tests', () => {
    it('should handle large codebases efficiently', async () => {
      const largeContent = generateLargeCodebase(10000); // 10k lines

      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: largeContent,
        threshold: 0.95,
        context: {}
      };

      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([
          createMockRule(0.9),
          createMockRule(0.85),
          createMockRule(0.95)
        ]);

      const startTime = Date.now();
      const result = await truthVerification.verify(request);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.score).toBeCloseTo(0.9, 2);
    });

    it('should handle concurrent verification requests', async () => {
      const requests: TruthVerificationRequest[] = Array.from({ length: 50 }, (_, i) => ({
        type: VerificationType.CODE_QUALITY as VerificationType,
        content: `function test${i}() { return ${i}; }`,
        threshold: 0.95,
        context: {}
      }));

      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([createMockRule(0.96)]);

      const startTime = Date.now();
      const results = await Promise.all(requests.map(req => truthVerification.verify(req)));
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(results.every(r => r.passed)).toBe(true);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should maintain consistent memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run multiple verifications
      for (let i = 0; i < 100; i++) {
        const request: TruthVerificationRequest = {
          type: VerificationType.CODE_QUALITY,
          content: `function test${i}() { return ${i}; }`,
          threshold: 0.95,
          context: {}
        };

        jest.spyOn(truthVerification as any, 'verificationRules')
          .mockReturnValue([createMockRule(0.95 + Math.random() * 0.05)]);

        await truthVerification.verify(request);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Batch Verification', () => {
    it('should process multiple verification requests efficiently', async () => {
      const requests: TruthVerificationRequest[] = [
        {
          type: VerificationType.CODE_QUALITY,
          content: 'function test1() { return true; }',
          threshold: 0.95,
          context: {}
        },
        {
          type: VerificationType.TEST_COVERAGE,
          content: 'describe("test", () => { it("should pass", () => expect(true).toBe(true)); });',
          threshold: 0.9,
          context: {}
        },
        {
          type: VerificationType.SECURITY,
          content: 'function secure() { return "secure"; }',
          threshold: 0.98,
          context: {}
        }
      ];

      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([
          createMockRule(0.96),
          createMockRule(0.92),
          createMockRule(0.99)
        ]);

      const results = await truthVerification.verifyBatch(requests);

      expect(results).toHaveLength(3);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
      expect(results[2].passed).toBe(true);
    });

    it('should handle batch with mixed results', async () => {
      const requests: TruthVerificationRequest[] = [
        {
          type: VerificationType.CODE_QUALITY,
          content: 'function good() { return true; }',
          threshold: 0.95,
          context: {}
        },
        {
          type: VerificationType.CODE_QUALITY,
          content: 'function bad() { eval("malicious"); }',
          threshold: 0.95,
          context: {}
        }
      ];

      jest.spyOn(truthVerification as any, 'verificationRules')
        .mockReturnValue([
          createMockRule(0.96),
          createMockRule(0.4, [{ type: 'eval_usage', severity: IssueSeverity.CRITICAL, message: 'Use of eval()' }])
        ]);

      const results = await truthVerification.verifyBatch(requests);

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const malformedRequest = {
        // Missing required fields
        type: VerificationType.CODE_QUALITY,
        // content missing
        threshold: 0.95
      } as any;

      const result = await truthVerification.verify(malformedRequest);

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
      expect(result.details.issues).toContainEqual(
        expect.objectContaining({
          severity: IssueSeverity.HIGH
        })
      );
    });

    it('should handle invalid verification types', async () => {
      const request: TruthVerificationRequest = {
        type: 'invalid_type' as VerificationType,
        content: 'function test() { return true; }',
        threshold: 0.95,
        context: {}
      };

      const result = await truthVerification.verify(request);

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle null/undefined content', async () => {
      const request: TruthVerificationRequest = {
        type: VerificationType.CODE_QUALITY,
        content: null as any,
        threshold: 0.95,
        context: {}
      };

      const result = await truthVerification.verify(request);

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
    });
  });
});

// Helper functions for creating mock rules
function createMockRule(score: number, issues: any[] = []) {
  return {
    execute: jest.fn().mockResolvedValue({
      score,
      issues,
      suggestions: issues.length > 0 ? ['Fix the issues'] : [],
      metrics: { complexity: 5, linesOfCode: 10 }
    })
  };
}

function createFailingRule() {
  return {
    execute: jest.fn().mockRejectedValue(new Error('Rule execution failed'))
  };
}

function createByzantineRule(score: number) {
  return {
    execute: jest.fn().mockResolvedValue({
      score,
      issues: [{ type: 'byzantine_behavior', severity: IssueSeverity.CRITICAL, message: 'Consensus manipulation attempt' }],
      suggestions: [],
      metrics: { complexity: 1 }
    })
  };
}

function generateLargeCodebase(lines: number): string {
  const functions = [];
  for (let i = 0; i < lines; i += 10) {
    functions.push(`
      function function${i}() {
        const x = ${i};
        const y = x * 2;
        return y + ${i};
      }

      function function${i + 1}() {
        return function${i}() * 3;
      }

      function function${i + 2}() {
        const arr = [1, 2, 3, 4, 5];
        return arr.map(x => x * ${i % 10}).reduce((a, b) => a + b, 0);
      }
    `);
  }
  return functions.join('\n');
}