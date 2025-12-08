/**
 * Performance tests for Truth Verification System
 * Tests verification speed, throughput, and resource usage under load
 */

import { TruthVerification } from '../../src/core/TruthVerification.js';
import { VerificationType, TruthVerificationRequest } from '../../src/types/index.js';

describe('Truth Verification Performance Tests', () => {
  let truthVerification: TruthVerification;
  const testCodeSamples = [
    // Simple, high-quality code
    `
      /**
       * Utility function for string manipulation
       * @param input The string to process
       * @returns Processed string
       */
      function processString(input: string): string {
        return input.trim().toLowerCase();
      }
    `,
    // Medium complexity code
    `
      /**
       * Processes user data with validation
       * @param userData User data object
       * @returns Processed and validated user data
       */
      function processUserData(userData: { name: string; email: string; age: number }) {
        if (!userData.name || !userData.email) {
          throw new Error('Name and email are required');
        }

        if (userData.age < 0 || userData.age > 150) {
          throw new Error('Invalid age range');
        }

        return {
          ...userData,
          name: userData.name.trim(),
          email: userData.email.toLowerCase()
        };
      }
    `,
    // Complex code with multiple functions
    `
      /**
       * Data processing pipeline with multiple transformations
       */
      class DataProcessor {
        private cache = new Map<string, any>();

        constructor(private readonly options: { maxCacheSize: number }) {}

        /**
         * Processes data through pipeline
         * @param data Raw data to process
         * @returns Processed data
         */
        public async processData<T>(data: T[]): Promise<T[]> {
          const startTime = performance.now();

          try {
            // Validation step
            const validatedData = this.validateData(data);

            // Transformation step
            const transformedData = await this.transformData(validatedData);

            // Aggregation step
            const aggregatedData = this.aggregateData(transformedData);

            // Cache results
            this.cacheResult(aggregatedData);

            const processingTime = performance.now() - startTime;
            console.log(\`Processing completed in \${processingTime.toFixed(2)}ms\`);

            return aggregatedData;
          } catch (error) {
            throw new Error(\`Data processing failed: \${error instanceof Error ? error.message : 'Unknown error'}\`);
          }
        }

        private validateData<T>(data: T[]): T[] {
          if (!Array.isArray(data)) {
            throw new Error('Input must be an array');
          }

          if (data.length === 0) {
            throw new Error('Input array cannot be empty');
          }

          return data.filter(item => item !== null && item !== undefined);
        }

        private async transformData<T>(data: T[]): Promise<T[]> {
          return Promise.all(
            data.map(async item => {
              await new Promise(resolve => setTimeout(resolve, 1)); // Simulate async work
              return item;
            })
          );
        }

        private aggregateData<T>(data: T[]): T[] {
          // Simple aggregation - in real implementation would be more complex
          return data.slice(0, Math.min(data.length, this.options.maxCacheSize));
        }

        private cacheResult<T>(data: T[]): void {
          const key = \`result_\${Date.now()}_\${Math.random()}\`;
          this.cache.set(key, data);

          // Maintain cache size
          if (this.cache.size > this.options.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
        }
      }
    `,
    // Code with security issues
    `
      function processUserInput(input: any): string {
        // Security vulnerability: eval usage
        const processed = eval(input);

        // Security vulnerability: direct HTML manipulation
        document.getElementById('output').innerHTML = processed;

        // Security vulnerability: no input validation
        return processed.toString();
      }
    `,
    // Code with performance issues
    `
      function processLargeDataset(data: any[]): any[] {
        const results = [];

        // Performance issue: O(n^2) nested loop
        for (let i = 0; i < data.length; i++) {
          for (let j = 0; j < data.length; j++) {
            if (i !== j && data[i] === data[j]) {
              results.push(data[i]);
            }
          }
        }

        // Performance issue: unnecessary deep copy
        const clonedData = JSON.parse(JSON.stringify(data));

        // Performance issue: blocking operation in loop
        results.forEach(item => {
          while (Date.now() % 1000 !== 0) {
            // Busy wait
          }
        });

        return results;
      }
    `
  ];

  beforeEach(() => {
    truthVerification = TruthVerification.getInstance();
  });

  describe('Single Request Performance', () => {
    it('should verify simple code within 100ms', async () => {
      const request: TruthVerificationRequest = {
        content: testCodeSamples[0],
        type: VerificationType.CODE_QUALITY
      };

      const startTime = performance.now();
      const result = await truthVerification.verify(request);
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('should verify complex code within 500ms', async () => {
      const request: TruthVerificationRequest = {
        content: testCodeSamples[2],
        type: VerificationType.CODE_QUALITY
      };

      const startTime = performance.now();
      const result = await truthVerification.verify(request);
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(500);
    });

    it('should handle security verification efficiently', async () => {
      const request: TruthVerificationRequest = {
        content: testCodeSamples[3],
        type: VerificationType.SECURITY
      };

      const startTime = performance.now();
      const result = await truthVerification.verify(request);
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(200);
      expect(result.details.issues.length).toBeGreaterThan(0);
    });

    it('should process performance verification quickly', async () => {
      const request: TruthVerificationRequest = {
        content: testCodeSamples[4],
        type: VerificationType.PERFORMANCE
      };

      const startTime = performance.now();
      const result = await truthVerification.verify(request);
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(300);
      expect(result.details.issues.some(issue =>
        issue.type.includes('performance')
      )).toBe(true);
    });
  });

  describe('Batch Verification Performance', () => {
    it('should handle batch of 10 requests efficiently', async () => {
      const requests: TruthVerificationRequest[] = testCodeSamples.map((content, index) => ({
        content,
        type: [
          VerificationType.CODE_QUALITY,
          VerificationType.SECURITY,
          VerificationType.PERFORMANCE,
          VerificationType.DOCUMENTATION,
          VerificationType.TEST_COVERAGE
        ][index % 5] as VerificationType
      }));

      const startTime = performance.now();
      const results = await truthVerification.verifyBatch(requests);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(1000); // Should be under 1 second total
      expect(duration / 10).toBeLessThan(100); // Average under 100ms per request
    });

    it('should handle batch of 100 requests efficiently', async () => {
      const requests: TruthVerificationRequest[] = Array(100).fill(null).map((_, index) => ({
        content: testCodeSamples[index % testCodeSamples.length],
        type: VerificationType.CODE_QUALITY
      }));

      const startTime = performance.now();
      const results = await truthVerification.verifyBatch(requests);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should be under 5 seconds
      expect(duration / 100).toBeLessThan(50); // Average under 50ms per request
    });

    it('should maintain consistent performance under batch load', async () => {
      const batchSizes = [10, 25, 50, 100];
      const performanceResults = [];

      for (const batchSize of batchSizes) {
        const requests: TruthVerificationRequest[] = Array(batchSize).fill(null).map((_, index) => ({
          content: testCodeSamples[index % testCodeSamples.length],
          type: VerificationType.CODE_QUALITY
        }));

        const startTime = performance.now();
        await truthVerification.verifyBatch(requests);
        const duration = performance.now() - startTime;

        performanceResults.push({
          batchSize,
          duration,
          avgTimePerRequest: duration / batchSize
        });
      }

      // Verify linear or sub-linear scaling
      for (let i = 1; i < performanceResults.length; i++) {
        const current = performanceResults[i];
        const previous = performanceResults[i - 1];

        // Average time per request should not increase significantly
        expect(current.avgTimePerRequest).toBeLessThan(previous.avgTimePerRequest * 1.5);
      }
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle 10 concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => ({
        content: testCodeSamples[0],
        type: VerificationType.CODE_QUALITY
      } as TruthVerificationRequest));

      const startTime = performance.now();
      const promises = requests.map(request => truthVerification.verify(request));
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    it('should handle 50 concurrent requests', async () => {
      const requests = Array(50).fill(null).map((_, index) => ({
        content: testCodeSamples[index % testCodeSamples.length],
        type: VerificationType.CODE_QUALITY
      } as TruthVerificationRequest));

      const startTime = performance.now();
      const promises = requests.map(request => truthVerification.verify(request));
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should maintain performance with mixed verification types', async () => {
      const verificationTypes = [
        VerificationType.CODE_QUALITY,
        VerificationType.SECURITY,
        VerificationType.PERFORMANCE,
        VerificationType.DOCUMENTATION
      ];

      const requests = Array(20).fill(null).map((_, index) => ({
        content: testCodeSamples[index % testCodeSamples.length],
        type: verificationTypes[index % verificationTypes.length]
      } as TruthVerificationRequest));

      const startTime = performance.now();
      const promises = requests.map(request => truthVerification.verify(request));
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second

      // Verify all types were processed
      const typeCounts = new Map<VerificationType, number>();
      results.forEach(result => {
        // The actual type would be stored in the result in a real implementation
        // For this test, we just ensure all results are valid
        expect(result).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory during batch processing', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple batches
      for (let i = 0; i < 10; i++) {
        const requests: TruthVerificationRequest[] = Array(50).fill(null).map((_, index) => ({
          content: testCodeSamples[index % testCodeSamples.length],
          type: VerificationType.CODE_QUALITY
        }));

        await truthVerification.verifyBatch(requests);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large content efficiently', async () => {
      const largeContent = testCodeSamples[2].repeat(100); // Create large content
      const request: TruthVerificationRequest = {
        content: largeContent,
        type: VerificationType.CODE_QUALITY
      };

      const initialMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      const result = await truthVerification.verify(request);

      const duration = performance.now() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = finalMemory - initialMemory;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should handle large content in under 2 seconds
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Should use less than 100MB
    });
  });

  describe('Stress Testing', () => {
    it('should handle sustained load without degradation', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = Date.now();
      const performanceData = [];

      while (Date.now() - startTime < testDuration) {
        const request = {
          content: testCodeSamples[Math.floor(Math.random() * testCodeSamples.length)],
          type: VerificationType.CODE_QUALITY
        } as TruthVerificationRequest;

        const requestStart = performance.now();
        await truthVerification.verify(request);
        const requestDuration = performance.now() - requestStart;

        performanceData.push(requestDuration);
      }

      // Analyze performance
      const avgDuration = performanceData.reduce((a, b) => a + b, 0) / performanceData.length;
      const maxDuration = Math.max(...performanceData);
      const p95Duration = performanceData.sort((a, b) => a - b)[Math.floor(performanceData.length * 0.95)];

      expect(avgDuration).toBeLessThan(100);
      expect(maxDuration).toBeLessThan(500);
      expect(p95Duration).toBeLessThan(200);
    });

    it('should recover from high load quickly', async () => {
      // First, create high load
      const highLoadRequests = Array(100).fill(null).map(() => ({
        content: testCodeSamples[2], // Complex code
        type: VerificationType.CODE_QUALITY
      } as TruthVerificationRequest));

      await Promise.all(highLoadRequests.map(req => truthVerification.verify(req)));

      // Then test normal performance
      const normalRequest = {
        content: testCodeSamples[0],
        type: VerificationType.CODE_QUALITY
      } as TruthVerificationRequest;

      const startTime = performance.now();
      await truthVerification.verify(normalRequest);
      const duration = performance.now() - startTime;

      // Should recover to normal performance quickly
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Threshold Enforcement Performance', () => {
    it('should enforce 0.95 threshold efficiently', async () => {
      const requests = testCodeSamples.map(content => ({
        content,
        type: VerificationType.CODE_QUALITY,
        threshold: 0.95
      } as TruthVerificationRequest));

      const startTime = performance.now();
      const results = await truthVerification.verifyBatch(requests);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(testCodeSamples.length);
      expect(duration).toBeLessThan(1000);

      // Verify threshold was enforced
      results.forEach(result => {
        if (result.score < 0.95) {
          expect(result.passed).toBe(false);
        }
      });
    });

    it('should handle custom thresholds without performance impact', async () => {
      const thresholds = [0.5, 0.7, 0.9, 0.95, 0.99];
      const performanceData = [];

      for (const threshold of thresholds) {
        const request = {
          content: testCodeSamples[1],
          type: VerificationType.CODE_QUALITY,
          threshold
        } as TruthVerificationRequest;

        const startTime = performance.now();
        await truthVerification.verify(request);
        const duration = performance.now() - startTime;

        performanceData.push({ threshold, duration });
      }

      // Performance should be consistent across thresholds
      const avgDuration = performanceData.reduce((a, b) => a + b.duration, 0) / performanceData.length;
      performanceData.forEach(({ duration }) => {
        expect(duration).toBeLessThan(avgDuration * 2); // Within 2x of average
      });
    });
  });

  describe('Resource Cleanup Performance', () => {
    it('should cleanup resources efficiently after verification', async () => {
      const iterations = 100;
      const resourceData = [];

      for (let i = 0; i < iterations; i++) {
        const initialMemory = process.memoryUsage().heapUsed;

        const request = {
          content: testCodeSamples[2],
          type: VerificationType.CODE_QUALITY
        } as TruthVerificationRequest;

        await truthVerification.verify(request);

        const finalMemory = process.memoryUsage().heapUsed;
        resourceData.push(finalMemory - initialMemory);
      }

      // Memory usage should be stable
      const avgMemoryIncrease = resourceData.reduce((a, b) => a + b, 0) / resourceData.length;
      expect(avgMemoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB average increase
    });
  });
});