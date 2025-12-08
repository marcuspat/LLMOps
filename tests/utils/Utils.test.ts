import {
  IdGenerator,
  ValidationUtils,
  ResponseHelper,
  AsyncUtils,
  PerformanceUtils,
  MapUtils
} from '../../src/shared/utils.js';

describe('IdGenerator', () => {
  test('should generate ID without prefix', () => {
    const id = IdGenerator.generate();
    expect(id).toMatch(/^\d+_[a-z0-9]+$/);
  });

  test('should generate ID with prefix', () => {
    const id = IdGenerator.generate('test');
    expect(id).toMatch(/^test_\d+_[a-z0-9]+$/);
  });

  test('should generate unique IDs', () => {
    const id1 = IdGenerator.generate('test');
    const id2 = IdGenerator.generate('test');
    expect(id1).not.toBe(id2);
  });
});

describe('ValidationUtils', () => {
  describe('sanitizeString', () => {
    test('should remove script tags', () => {
      const input = '<script>alert("xss")</script>clean text';
      const result = ValidationUtils.sanitizeString(input);
      expect(result).toBe('clean text');
    });

    test('should remove javascript protocol', () => {
      const input = 'javascript:alert("xss")';
      const result = ValidationUtils.sanitizeString(input);
      expect(result).toBe('');
    });

    test('should limit string length', () => {
      const input = 'a'.repeat(20000);
      const result = ValidationUtils.sanitizeString(input, 1000);
      expect(result.length).toBe(1000);
    });

    test('should handle non-string input', () => {
      expect(ValidationUtils.sanitizeString(null as any)).toBe('');
      expect(ValidationUtils.sanitizeString(123 as any)).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    test('should remove sensitive keys', () => {
      const input = {
        username: 'test',
        password: 'secret',
        token: 'abc123',
        normalData: 'value'
      };

      const result = ValidationUtils.sanitizeObject(input);
      expect(result).toEqual({
        username: 'test',
        normalData: 'value'
      });
      expect(result.password).toBeUndefined();
      expect(result.token).toBeUndefined();
    });

    test('should handle nested objects', () => {
      const input = {
        user: {
          name: 'test',
          password: 'secret'
        },
        data: {
          apiToken: 'abc123',
          value: 'normal'
        }
      };

      const result = ValidationUtils.sanitizeObject(input);
      expect(result).toEqual({
        user: { name: 'test' },
        data: { value: 'normal' }
      });
    });

    test('should handle non-object input', () => {
      expect(ValidationUtils.sanitizeObject('string' as any)).toBe('string');
      expect(ValidationUtils.sanitizeObject(null)).toBe(null);
    });
  });

  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      expect(ValidationUtils.validateEmail('test@example.com')).toBe(true);
      expect(ValidationUtils.validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(ValidationUtils.validateEmail('invalid')).toBe(false);
      expect(ValidationUtils.validateEmail('test@')).toBe(false);
      expect(ValidationUtils.validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    test('should validate correct URLs', () => {
      expect(ValidationUtils.validateUrl('https://example.com')).toBe(true);
      expect(ValidationUtils.validateUrl('http://localhost:3000')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(ValidationUtils.validateUrl('not-a-url')).toBe(false);
      expect(ValidationUtils.validateUrl('')).toBe(false);
    });
  });
});

describe('ResponseHelper', () => {
  test('should create success response', () => {
    const response = ResponseHelper.createSuccessResponse({ data: 'test' });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ data: 'test' });
    expect(response.error).toBeUndefined();
    expect(response.timestamp).toBeInstanceOf(Date);
  });

  test('should create error response', () => {
    const response = ResponseHelper.createErrorResponse('TEST_ERROR', 'Test message');

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('TEST_ERROR');
    expect(response.error.message).toBe('Test message');
    expect(response.data).toBeUndefined();
    expect(response.timestamp).toBeInstanceOf(Date);
  });

  test('should create error response with details', () => {
    const details = { field: 'value' };
    const response = ResponseHelper.createErrorResponse('TEST_ERROR', 'Test message', details);

    expect(response.error.details).toEqual(details);
  });
});

describe('AsyncUtils', () => {
  describe('timeout', () => {
    test('should resolve when promise completes before timeout', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('success'), 100));
      const result = await AsyncUtils.timeout(promise, 200);
      expect(result).toBe('success');
    });

    test('should reject when promise exceeds timeout', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('success'), 200));
      await expect(AsyncUtils.timeout(promise, 100)).rejects.toThrow('timed out');
    });
  });

  describe('retry', () => {
    test('should succeed on first attempt', async () => {
      let attempts = 0;
      const operation = () => {
        attempts++;
        return 'success';
      };

      const result = await AsyncUtils.retry(operation, 3);
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    test('should retry on failure', async () => {
      let attempts = 0;
      const operation = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await AsyncUtils.retry(operation, 3);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should fail after max attempts', async () => {
      const operation = () => {
        throw new Error('Persistent failure');
      };

      await expect(AsyncUtils.retry(operation, 3)).rejects.toThrow('Persistent failure');
    });
  });
});

describe('PerformanceUtils', () => {
  describe('measureTime', () => {
    test('should measure execution time', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const { result, duration } = await PerformanceUtils.measureTime(operation);

      expect(result).toBe('result');
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    test('should handle synchronous operations', async () => {
      const operation = () => 'sync result';

      const { result, duration } = await PerformanceUtils.measureTime(operation);

      expect(result).toBe('sync result');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    test('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = PerformanceUtils.debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should reset timer on new calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = PerformanceUtils.debounce(mockFn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);

      debouncedFn();
      jest.advanceTimersByTime(50);

      debouncedFn();
      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    test('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = PerformanceUtils.throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});

describe('MapUtils', () => {
  describe('mapAsync', () => {
    test('should map array asynchronously', async () => {
      const items = [1, 2, 3, 4, 5];
      const mapper = async (item: number) => item * 2;

      const results = await MapUtils.mapAsync(items, mapper);

      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    test('should handle concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5];
      let concurrentCalls = 0;
      let maxConcurrent = 0;

      const mapper = async (item: number) => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCalls--;
        return item * 2;
      };

      await MapUtils.mapAsync(items, mapper, 2);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });
});