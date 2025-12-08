import { TruthVerificationCore } from '../../src/verification/TruthVerificationCore.js';
import { VerificationType } from '../../src/types/index.js';

describe('TruthVerificationCore', () => {
  let truthVerification: TruthVerificationCore;

  beforeEach(() => {
    truthVerification = TruthVerificationCore.getInstance();
  });

  describe('Basic Verification', () => {
    test('should verify code quality successfully', async () => {
      const request = {
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.8,
        context: { requestId: 'test-1' }
      };

      const result = await truthVerification.verify(request);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('timestamp');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    test('should verify test coverage successfully', async () => {
      const request = {
        type: VerificationType.TEST_COVERAGE,
        content: 'test("example", () => { expect(true).toBe(true); });',
        threshold: 0.7
      };

      const result = await truthVerification.verify(request);

      expect(result).toHaveProperty('score');
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test('should verify security successfully', async () => {
      const request = {
        type: VerificationType.SECURITY,
        content: 'function safe() { return "safe"; }', // No security issues
        threshold: 0.9
      };

      const result = await truthVerification.verify(request);

      expect(result).toHaveProperty('passed');
      expect(result.score).toBeGreaterThan(0.8);
    });

    test('should handle vulnerable code', async () => {
      const request = {
        type: VerificationType.SECURITY,
        content: 'function unsafe() { eval("malicious code"); }',
        threshold: 0.9
      };

      const result = await truthVerification.verify(request);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(0.9);
      expect(result.details.issues).toHaveLength(1);
      expect(result.details.issues[0].type).toBe('security_vulnerability');
    });
  });

  describe('Batch Verification', () => {
    test('should verify multiple requests in batch', async () => {
      const requests = [
        {
          type: VerificationType.CODE_QUALITY,
          content: 'function test() { return true; }',
          threshold: 0.8
        },
        {
          type: VerificationType.SECURITY,
          content: 'function safe() { return "safe"; }',
          threshold: 0.9
        }
      ];

      const results = await truthVerification.verifyBatch(requests);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('passed');
      });
    });

    test('should handle empty batch', async () => {
      const results = await truthVerification.verifyBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    test('should provide verification statistics', async () => {
      // Perform some verifications first
      await truthVerification.verify({
        type: VerificationType.CODE_QUALITY,
        content: 'function test() { return true; }',
        threshold: 0.8
      });

      const stats = truthVerification.getVerificationStats({
        start: new Date(Date.now() - 60000), // 1 minute ago
        end: new Date()
      });

      expect(stats).toHaveProperty('totalVerifications');
      expect(stats).toHaveProperty('averageScore');
      expect(stats).toHaveProperty('passRate');
      expect(stats).toHaveProperty('commonIssues');
      expect(stats).toHaveProperty('scoreTrend');
      expect(stats.totalVerifications).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid verification type', async () => {
      const request = {
        type: 'invalid_type' as VerificationType,
        content: 'test content',
        threshold: 0.8
      };

      await expect(truthVerification.verify(request)).rejects.toThrow();
    });

    test('should handle empty content', async () => {
      const request = {
        type: VerificationType.CODE_QUALITY,
        content: '',
        threshold: 0.8
      };

      const result = await truthVerification.verify(request);
      expect(result).toHaveProperty('score');
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = TruthVerificationCore.getInstance();
      const instance2 = TruthVerificationCore.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});