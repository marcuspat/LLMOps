/**
 * Unit tests for Truth Verification System
 * Tests the core verification engine with 0.95 threshold enforcement
 */

import { TruthVerification } from '../../src/core/TruthVerification.js';
import { VerificationType, TruthVerificationRequest, IssueSeverity } from '../../src/types/index.js';

describe('TruthVerification Service', () => {
  let truthVerification: TruthVerification;

  beforeEach(() => {
    truthVerification = TruthVerification.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TruthVerification.getInstance();
      const instance2 = TruthVerification.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', async () => {
      const instance1 = TruthVerification.getInstance();
      const instance2 = TruthVerification.getInstance();

      const request: TruthVerificationRequest = {
        content: 'function test() { return true; }',
        type: VerificationType.CODE_QUALITY
      };

      const result1 = await instance1.verify(request);
      const result2 = await instance2.verify(request);

      expect(result1.score).toBe(result2.score);
      expect(result1.passed).toBe(result2.passed);
    });
  });

  describe('Code Quality Verification', () => {
    it('should verify simple high-quality code', async () => {
      const request: TruthVerificationRequest = {
        content: `
          /**
           * Adds two numbers together
           */
          function add(a: number, b: number): number {
            return a + b;
          }
        `,
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.passed).toBe(true);
      expect(result.details.metrics).toBeDefined();
      expect(result.details.suggestions).toBeDefined();
    });

    it('should detect complex code with issues', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function complexFunction(x, y) {
            if (x > 0) {
              for (let i = 0; i < x; i++) {
                if (y > 0) {
                  while (i < y) {
                    switch(i) {
                      case 1:
                        try {
                          return i * 123456;
                        } catch(e) {
                          break;
                        }
                    }
                    i++;
                  }
                }
              }
            }
            return x + y + 789;
          }
        `,
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBeLessThan(0.9);
      expect(result.details.issues.length).toBeGreaterThan(0);

      const complexityIssues = result.details.issues.filter(
        issue => issue.type === 'high_complexity'
      );
      expect(complexityIssues.length).toBeGreaterThan(0);

      const performanceIssues = result.details.issues.filter(
        issue => issue.type === 'performance_anti_pattern'
      );
      expect(performanceIssues.length).toBeGreaterThan(0);
    });

    it('should detect missing TypeScript types', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function processData(data) {
            return data.map(item => {
              return item.value * 2;
            });
          }
        `,
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBeLessThan(0.9);

      const typeIssues = result.details.issues.filter(
        issue => issue.type === 'missing_types' || issue.type === 'any_type_usage'
      );
      expect(typeIssues.length).toBeGreaterThan(0);

      expect(result.details.suggestions).toContain(
        'Add TypeScript type annotations for better type safety'
      );
    });

    it('should detect long functions', async () => {
      const longFunction = `
        function veryLongFunction() {
          // This function is intentionally long to test the detection
          let result = '';
          for (let i = 0; i < 100; i++) {
            result += 'Line ' + i + '\\n';
            result += 'Additional content ' + i + '\\n';
            result += 'More content ' + i + '\\n';
            result += 'Even more content ' + i + '\\n';
            result += 'Extra content ' + i + '\\n';
            result += 'Further content ' + i + '\\n';
            result += 'Additional details ' + i + '\\n';
            result += 'More information ' + i + '\\n';
            result += 'Extra details ' + i + '\\n';
          }
          return result;
        }
      `;

      const request: TruthVerificationRequest = {
        content: longFunction,
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      const longFunctionIssues = result.details.issues.filter(
        issue => issue.type === 'long_function'
      );
      expect(longFunctionIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Test Coverage Verification', () => {
    it('should verify test file structure', async () => {
      const request: TruthVerificationRequest = {
        content: `
          describe('Calculator', () => {
            it('should add two numbers', () => {
              expect(add(2, 3)).toBe(5);
            });

            it('should subtract two numbers', () => {
              expect(subtract(5, 3)).toBe(2);
            });
          });
        `,
        type: VerificationType.TEST_COVERAGE
      };

      const result = await truthVerification.verify(request);

      expect(result).toBeDefined();
      expect(result.details.metrics.testCount).toBe(2);
      expect(result.details.metrics.assertionCount).toBe(2);
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should detect missing assertions', async () => {
      const request: TruthVerificationRequest = {
        content: `
          describe('User Service', () => {
            it('should create user', () => {
              const user = userService.create({ name: 'Test' });
              // Missing assertion
            });

            it('should validate email', () => {
              // Completely empty test
            });
          });
        `,
        type: VerificationType.TEST_COVERAGE
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBeLessThan(0.9);

      const missingAssertions = result.details.issues.filter(
        issue => issue.type === 'missing_assertions'
      );
      expect(missingAssertions.length).toBeGreaterThan(0);

      expect(result.details.suggestions).toContain(
        'Add assertions to all tests'
      );
    });

    it('should detect multiple assertions per test', async () => {
      const request: TruthVerificationRequest = {
        content: `
          describe('Array Utils', () => {
            it('should handle multiple operations', () => {
              expect([1, 2, 3]).toContain(2);
              expect([1, 2, 3]).toHaveLength(3);
              expect([1, 2, 3]).toEqual(expect.arrayContaining([1, 3]));
              expect([1, 2, 3]).not.toContain(4);
            });
          });
        `,
        type: VerificationType.TEST_COVERAGE
      };

      const result = await truthVerification.verify(request);

      const multipleAssertionIssues = result.details.issues.filter(
        issue => issue.type === 'multiple_assertions'
      );
      expect(multipleAssertionIssues.length).toBeGreaterThan(0);

      expect(result.details.metrics.multipleAssertionTests).toBe(1);
    });

    it('should detect no tests scenario', async () => {
      const request: TruthVerificationRequest = {
        content: `
          // This file has no tests
          const helper = {
            add: (a, b) => a + b,
            multiply: (a, b) => a * b
          };
        `,
        type: VerificationType.TEST_COVERAGE
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBe(0);

      const noTestIssues = result.details.issues.filter(
        issue => issue.type === 'no_tests'
      );
      expect(noTestIssues.length).toBe(1);
      expect(noTestIssues[0].severity).toBe(IssueSeverity.CRITICAL);
    });
  });

  describe('Security Verification', () => {
    it('should detect security vulnerabilities', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function processUserInput(input) {
            eval(input);
            document.write(input);
            element.innerHTML = userContent;
            setTimeout("alert(" + input + ")", 1000);
          }
        `,
        type: VerificationType.SECURITY
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBeLessThan(0.5);
      expect(result.details.issues.length).toBeGreaterThan(2);

      const criticalIssues = result.details.issues.filter(
        issue => issue.severity === IssueSeverity.CRITICAL
      );
      expect(criticalIssues.length).toBeGreaterThan(0);

      const evalIssues = result.details.issues.filter(
        issue => issue.message.includes('eval')
      );
      expect(evalIssues.length).toBeGreaterThan(0);
    });

    it('should detect missing input validation', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function processRequest(req) {
            const data = req.body;
            const params = req.params;
            return database.save(data);
          }
        `,
        type: VerificationType.SECURITY
      };

      const result = await truthVerification.verify(request);

      const validationIssues = result.details.issues.filter(
        issue => issue.type === 'missing_input_validation'
      );
      expect(validationIssues.length).toBeGreaterThan(0);
      expect(validationIssues[0].severity).toBe(IssueSeverity.HIGH);

      expect(result.details.suggestions).toContain(
        'Add input validation for all user inputs'
      );
    });

    it('should pass secure code', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function processSecureInput(input) {
            if (typeof input !== 'string') {
              throw new Error('Invalid input type');
            }

            const sanitized = input.replace(/<script[^>]*>.*?<\\/script>/gi, '');
            return sanitized.trim();
          }
        `,
        type: VerificationType.SECURITY
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBeGreaterThan(0.8);
      expect(result.details.metrics.hasInputValidation).toBe(1);
    });
  });

  describe('Performance Verification', () => {
    it('should detect performance anti-patterns', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function inefficientOperations(data) {
            // Anti-pattern: chaining length and forEach
            data.length.forEach(item => console.log(item));

            // Anti-pattern: deep copy with JSON
            const deepCopy = JSON.parse(JSON.stringify(data));

            // Potential memory leak
            document.addEventListener('click', handler);

            return deepCopy;
          }
        `,
        type: VerificationType.PERFORMANCE
      };

      const result = await truthVerification.verify(request);

      expect(result.details.issues.length).toBeGreaterThan(0);

      const performanceIssues = result.details.issues.filter(
        issue => issue.type === 'performance_anti_pattern'
      );
      expect(performanceIssues.length).toBeGreaterThan(0);

      const memoryLeakIssues = result.details.issues.filter(
        issue => issue.type === 'potential_memory_leak'
      );
      expect(memoryLeakIssues.length).toBeGreaterThan(0);
    });

    it('should check event listener balance', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function setupEventListeners() {
            element.addEventListener('click', handler);
            element.addEventListener('focus', handler);
            element.addEventListener('blur', handler);

            // Only removing one listener
            element.removeEventListener('click', handler);
          }
        `,
        type: VerificationType.PERFORMANCE
      };

      const result = await truthVerification.verify(request);

      expect(result.details.metrics.eventListenerBalance).toBeLessThan(1);

      const memoryLeakIssues = result.details.issues.filter(
        issue => issue.type === 'potential_memory_leak'
      );
      expect(memoryLeakIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Documentation Verification', () => {
    it('should detect missing documentation', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function calculateTotal(items) {
            return items.reduce((sum, item) => sum + item.price, 0);
          }

          function findUserById(id) {
            return database.users.find(user => user.id === id);
          }

          function processData(data) {
            return data.map(item => transform(item));
          }
        `,
        type: VerificationType.DOCUMENTATION
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBeLessThan(0.9);

      const incompleteDocIssues = result.details.issues.filter(
        issue => issue.type === 'incomplete_documentation'
      );
      expect(incompleteDocIssues.length).toBeGreaterThan(0);

      expect(result.details.metrics.functionCount).toBe(3);
      expect(result.details.metrics.documentedFunctionCount).toBe(0);
    });

    it('should pass well-documented code', async () => {
      const request: TruthVerificationRequest = {
        content: `
          /**
           * Calculates the total price of items
           * @param {Array} items - Array of items with price property
           * @returns {number} Total price
           */
          function calculateTotal(items) {
            return items.reduce((sum, item) => sum + item.price, 0);
          }

          /**
           * Finds a user by their ID
           * @param {string} id - User ID to search for
           * @returns {Object|undefined} User object or undefined if not found
           */
          function findUserById(id) {
            return database.users.find(user => user.id === id);
          }
        `,
        type: VerificationType.DOCUMENTATION
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBeGreaterThan(0.85);
      expect(result.details.metrics.functionCount).toBe(2);
      expect(result.details.metrics.documentedFunctionCount).toBe(2);
    });
  });

  describe('Batch Verification', () => {
    it('should verify multiple requests in parallel', async () => {
      const requests: TruthVerificationRequest[] = [
        {
          content: 'function simple() { return true; }',
          type: VerificationType.CODE_QUALITY
        },
        {
          content: 'function test() { expect(1).toBe(1); }',
          type: VerificationType.TEST_COVERAGE
        },
        {
          content: '// secure function without vulnerabilities',
          type: VerificationType.SECURITY
        }
      ];

      const results = await truthVerification.verifyBatch(requests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.score).toBeDefined();
        expect(result.passed).toBeDefined();
        expect(result.timestamp).toBeDefined();
      });
    });

    it('should handle mixed verification types in batch', async () => {
      const requests: TruthVerificationRequest[] = [
        {
          content: 'function good() { return 1; }',
          type: VerificationType.CODE_QUALITY
        },
        {
          content: 'function bad() { eval(userInput); }',
          type: VerificationType.SECURITY
        },
        {
          content: '// No tests here',
          type: VerificationType.TEST_COVERAGE
        }
      ];

      const results = await truthVerification.verifyBatch(requests);

      expect(results[0].score).toBeGreaterThan(0.8);
      expect(results[1].score).toBeLessThan(0.5);
      expect(results[2].score).toBe(0);
    });
  });

  describe('Threshold Enforcement', () => {
    it('should use default threshold of 0.95', async () => {
      const request: TruthVerificationRequest = {
        content: 'function moderate() { /* some issues */ }',
        type: VerificationType.CODE_QUALITY
        // No threshold specified - should use 0.95
      };

      const result = await truthVerification.verify(request);

      // With the default 0.95 threshold, even minor issues should fail
      if (result.details.issues.length > 0) {
        expect(result.passed).toBe(false);
      }
    });

    it('should respect custom threshold', async () => {
      const request: TruthVerificationRequest = {
        content: 'function withMinorIssues() { /* has some issues */ }',
        type: VerificationType.CODE_QUALITY,
        threshold: 0.5 // Lower threshold
      };

      const result = await truthVerification.verify(request);

      // Should pass even with some issues due to lower threshold
      expect(result.passed).toBe(true);
    });

    it('should fail content below threshold', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function terrible() {
            eval(maliciousCode);
            document.write(userInput);
            return undefined;
          }
        `,
        type: VerificationType.SECURITY,
        threshold: 0.9
      };

      const result = await truthVerification.verify(request);

      expect(result.score).toBeLessThan(0.9);
      expect(result.passed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle verification type with no rules', async () => {
      const request: TruthVerificationRequest = {
        content: 'some content',
        type: VerificationType.DOCUMENTATION
      };

      const result = await truthVerification.verify(request);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.passed).toBeDefined();
    });

    it('should handle empty content', async () => {
      const request: TruthVerificationRequest = {
        content: '',
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('should handle malformed content gracefully', async () => {
      const request: TruthVerificationRequest = {
        content: 'function malformed([[[[[[[[[[[[[[[',
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate high confidence for clean code', async () => {
      const request: TruthVerificationRequest = {
        content: `
          /**
           * Clean, well-documented function
           */
          function cleanFunction(param: string): string {
            return param.trim().toLowerCase();
          }
        `,
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.details.issues.length).toBe(0);
    });

    it('should calculate lower confidence with many issues', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function problematic() {
            eval(code);
            if (x) { if (y) { if (z) { } } }
            return;
          }
        `,
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result.confidence).toBeLessThan(0.9);
      // Issues should reduce confidence
      if (result.details.issues.length > 0) {
        expect(result.confidence).toBeLessThan(1);
      }
    });
  });

  describe('Metrics Collection', () => {
    it('should collect appropriate metrics for each verification type', async () => {
      const codeRequest: TruthVerificationRequest = {
        content: 'function test() { return 1; }',
        type: VerificationType.CODE_QUALITY
      };

      const codeResult = await truthVerification.verify(codeRequest);

      expect(codeResult.details.metrics).toBeDefined();
      expect(Object.keys(codeResult.details.metrics).length).toBeGreaterThan(0);
    });

    it('should provide meaningful metric values', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function example() {
            for (let i = 0; i < 10; i++) {
              console.log(i);
            }
          }
        `,
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result.details.metrics.cyclomaticComplexity).toBeDefined();
      expect(result.details.metrics.cyclomaticComplexity).toBeGreaterThan(0);
    });
  });

  describe('Suggestion Generation', () => {
    it('should provide relevant suggestions for detected issues', async () => {
      const request: TruthVerificationRequest = {
        content: `
          function noTypes(param) {
            if (param) {
              return param.toString();
            }
            return null;
          }
        `,
        type: VerificationType.CODE_QUALITY
      };

      const result = await truthVerification.verify(request);

      expect(result.details.suggestions).toBeDefined();
      expect(result.details.suggestions.length).toBeGreaterThan(0);

      // Should suggest type annotations
      const typeSuggestion = result.details.suggestions.find(s =>
        s.toLowerCase().includes('type')
      );
      expect(typeSuggestion).toBeDefined();
    });

    it('should provide different suggestions for different issue types', async () => {
      const securityRequest: TruthVerificationRequest = {
        content: 'eval(userInput);',
        type: VerificationType.SECURITY
      };

      const securityResult = await truthVerification.verify(securityRequest);

      expect(securityResult.details.suggestions).toBeDefined();

      const performanceRequest: TruthVerificationRequest = {
        content: 'data.length.forEach(item => process(item));',
        type: VerificationType.PERFORMANCE
      };

      const performanceResult = await truthVerification.verify(performanceRequest);

      expect(performanceResult.details.suggestions).toBeDefined();

      // Suggestions should be different for different types
      expect(securityResult.details.suggestions).not.toEqual(
        performanceResult.details.suggestions
      );
    });
  });

  describe('Verification Statistics', () => {
    it('should return verification stats structure', () => {
      const timeframe = {
        start: new Date(Date.now() - 86400000), // 24 hours ago
        end: new Date()
      };

      const stats = truthVerification.getVerificationStats(timeframe);

      expect(stats).toBeDefined();
      expect(stats.totalVerifications).toBeDefined();
      expect(stats.averageScore).toBeDefined();
      expect(stats.passRate).toBeDefined();
      expect(stats.commonIssues).toBeDefined();
      expect(stats.scoreTrend).toBeDefined();
    });
  });
});