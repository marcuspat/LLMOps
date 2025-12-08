/**
 * Basic test to verify Jest setup is working
 */

import { jest } from '@jest/globals';

describe('Jest Configuration', () => {
  test('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  test('should have mock utilities available', () => {
    expect(typeof jest.fn).toBe('function');
  });
});