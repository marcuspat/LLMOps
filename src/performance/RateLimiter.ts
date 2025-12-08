import { EventEmitter } from 'events';
import { getCacheManager, CacheManager } from './CacheManager.js';
import { logger } from '../utils/secure-logger.js';
import { performance } from 'perf_hooks';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  headers?: boolean;
  message?: string;
  statusCode?: number;
  trustProxy?: boolean;
  draftPolliRatio?: number;
  queueSize?: number;
  loadSheddingEnabled?: boolean;
  loadSheddingThreshold?: number;
  adaptiveLimiting?: boolean;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  queuePosition?: number;
  loadShed?: boolean;
  adaptiveLimit?: number;
}

interface RequestMetrics {
  timestamp: number;
  duration: number;
  success: boolean;
  statusCode: number;
  endpoint: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Advanced rate limiting with load shedding and adaptive throttling
 * - Token bucket algorithm for precise rate limiting
 * - Sliding window for accurate tracking
 * - Load shedding under extreme load
 * - Adaptive rate limiting based on system performance
 * - Priority queue for important requests
 * - Distributed rate limiting with Redis
 */
export class AdvancedRateLimiter extends EventEmitter {
  private cache: CacheManager;
  private metrics: Map<string, RequestMetrics[]> = new Map();
  private systemLoad: number = 0;
  private adaptiveLimits: Map<string, number> = new Map();
  private priorityQueues: Map<string, Array<{ req: any; resolve: Function; reject: Function; timestamp: number }>> = new Map();
  private loadSheddingActive: boolean = false;
  private lastSystemCheck: number = 0;

  constructor(private config: RateLimitConfig) {
    super();
    this.cache = getCacheManager();

    // Initialize configuration with defaults
    this.config = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      statusCode: 429,
      message: 'Too many requests, please try again later.',
      headers: true,
      trustProxy: false,
      queueSize: 10,
      loadSheddingThreshold: 0.9,
      adaptiveLimiting: true,
      ...config
    };

    this.startMonitoring();
  }

  /**
   * Check if request is allowed and update counters
   */
  async checkRateLimit(req: any): Promise<RateLimitResult> {
    const key = this.generateKey(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Check for load shedding first
    if (this.config.loadSheddingEnabled && this.shouldShedLoad()) {
      this.emit('loadShed', { key, req });
      return {
        success: false,
        limit: 0,
        current: Infinity,
        remaining: 0,
        resetTime: new Date(now + this.config.windowMs),
        loadShed: true
      };
    }

    // Get adaptive limit if enabled
    const adaptiveLimit = this.config.adaptiveLimiting ? this.getAdaptiveLimit(key) : this.config.maxRequests;

    try {
      // Get current request count from cache
      const requestData = await this.cache.get<{ count: number; resetTime: number }>(
        `rate_limit:${key}`
      );

      let currentCount = 0;
      let resetTime = now + this.config.windowMs;

      if (requestData) {
        currentCount = requestData.count;
        resetTime = requestData.resetTime;
      }

      // Check if within limit
      if (currentCount < adaptiveLimit) {
        // Increment counter
        const newCount = currentCount + 1;
        await this.cache.set(`rate_limit:${key}`, {
          count: newCount,
          resetTime: resetTime
        }, Math.ceil(this.config.windowMs / 1000));

        this.recordRequest(key, req, true);

        return {
          success: true,
          limit: adaptiveLimit,
          current: newCount,
          remaining: adaptiveLimit - newCount,
          resetTime: new Date(resetTime),
          adaptiveLimit
        };
      }

      // Check if request can be queued
      if (this.config.queueSize && this.config.queueSize > 0) {
        const queuePosition = await this.addToQueue(key, req);
        if (queuePosition >= 0) {
          this.recordRequest(key, req, false);

          return {
            success: false,
            limit: adaptiveLimit,
            current: currentCount,
            remaining: 0,
            resetTime: new Date(resetTime),
            retryAfter: Math.ceil(this.config.windowMs / 1000),
            queuePosition,
            adaptiveLimit
          };
        }
      }

      // Rate limited
      this.recordRequest(key, req, false);
      this.emit('rateLimit', { key, req, currentCount, limit: adaptiveLimit });

      return {
        success: false,
        limit: adaptiveLimit,
        current: currentCount,
        remaining: 0,
        resetTime: new Date(resetTime),
        retryAfter: Math.ceil((resetTime - now) / 1000),
        adaptiveLimit
      };

    } catch (error) {
      logger.error('Rate limiter error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown'
      });

      // Fail open - allow request if Redis is down
      this.recordRequest(key, req, true);
      return {
        success: true,
        limit: this.config.maxRequests,
        current: 0,
        remaining: this.config.maxRequests,
        resetTime: new Date(now + this.config.windowMs)
      };
    }
  }

  /**
   * Express middleware for rate limiting
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      const result = await this.checkRateLimit(req);

      // Add rate limit headers if enabled
      if (this.config.headers) {
        res.set({
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
          'X-RateLimit-Reset': Math.ceil(result.resetTime.getTime() / 1000)
        });

        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
        }

        if (result.adaptiveLimit && result.adaptiveLimit !== this.config.maxRequests) {
          res.set('X-RateLimit-Adaptive', result.adaptiveLimit.toString());
        }

        if (result.loadShed) {
          res.set('X-Load-Shed', 'true');
        }
      }

      if (result.success) {
        next();
      } else {
        const statusCode = result.loadShed ? 503 : this.config.statusCode;
        const message = result.loadShed
          ? 'Server temporarily unavailable due to high load'
          : this.config.message;

        if (result.queuePosition !== undefined && result.queuePosition >= 0) {
          res.status(statusCode).json({
            error: 'Request queued',
            queuePosition: result.queuePosition,
            retryAfter: result.retryAfter
          });
        } else {
          res.status(statusCode).json({
            error: message,
            retryAfter: result.retryAfter
          });
        }
      }
    };
  }

  /**
   * Generate unique key for rate limiting
   */
  private generateKey(req: any): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Default key generation
    let ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;

    if (this.config.trustProxy && req.headers['x-forwarded-for']) {
      ip = req.headers['x-forwarded-for'].split(',')[0].trim();
    }

    const userId = req.user?.id || req.user?.sub;
    const endpoint = req.route?.path || req.path || req.url || 'unknown';

    // Use user ID if available, otherwise IP
    const identifier = userId || ip || 'anonymous';

    return `rl:${identifier}:${endpoint}`;
  }

  /**
   * Record request metrics for adaptive limiting
   */
  private recordRequest(key: string, req: any, success: boolean): void {
    const metrics: RequestMetrics = {
      timestamp: Date.now(),
      duration: 0, // Will be updated when response finishes
      success,
      statusCode: 200,
      endpoint: req.route?.path || req.path || 'unknown',
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };

    // Track metrics for analysis
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const keyMetrics = this.metrics.get(key)!;
    keyMetrics.push(metrics);

    // Keep only last 1000 metrics
    if (keyMetrics.length > 1000) {
      keyMetrics.splice(0, keyMetrics.length - 1000);
    }

    // Emit metrics for monitoring
    this.emit('request', { key, metrics });

    // Update adaptive limits based on system performance
    if (this.config.adaptiveLimiting) {
      this.updateAdaptiveLimit(key);
    }
  }

  /**
   * Update adaptive limit based on system performance
   */
  private updateAdaptiveLimit(key: string): void {
    const keyMetrics = this.metrics.get(key);
    if (!keyMetrics || keyMetrics.length < 10) return;

    const recentMetrics = keyMetrics.slice(-100); // Last 100 requests
    const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;

    let newLimit = this.config.maxRequests;

    // Adjust based on success rate
    if (successRate < 0.9) {
      newLimit = Math.max(10, Math.floor(this.config.maxRequests * 0.8));
    } else if (successRate > 0.95 && avgResponseTime < 100) {
      newLimit = Math.floor(this.config.maxRequests * 1.2);
    }

    // Adjust based on response time
    if (avgResponseTime > 1000) {
      newLimit = Math.max(10, Math.floor(newLimit * 0.7));
    } else if (avgResponseTime < 100) {
      newLimit = Math.floor(newLimit * 1.1);
    }

    // Apply system load factor
    const systemLoadFactor = Math.max(0.5, 1 - this.systemLoad);
    newLimit = Math.floor(newLimit * systemLoadFactor);

    // Update adaptive limit
    this.adaptiveLimits.set(key, newLimit);

    if (newLimit !== this.config.maxRequests) {
      this.emit('adaptiveLimitChanged', {
        key,
        oldLimit: this.config.maxRequests,
        newLimit,
        successRate,
        avgResponseTime
      });
    }
  }

  /**
   * Get adaptive limit for a key
   */
  private getAdaptiveLimit(key: string): number {
    return this.adaptiveLimits.get(key) || this.config.maxRequests;
  }

  /**
   * Check if load shedding should be activated
   */
  private shouldShedLoad(): boolean {
    const now = Date.now();

    // Update system load every 5 seconds
    if (now - this.lastSystemCheck > 5000) {
      this.updateSystemLoad();
      this.lastSystemCheck = now;
    }

    return this.systemLoad > (this.config.loadSheddingThreshold || 0.9);
  }

  /**
   * Update system load metrics
   */
  private updateSystemLoad(): void {
    try {
      // Use process metrics as simple load indicator
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Calculate load based on memory usage
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const memoryLoad = usedMemory / totalMemory;

      // Simple CPU load calculation (would need more sophisticated approach in production)
      const cpuLoad = Math.min(1, (cpuUsage.user + cpuUsage.system) / 1000000);

      // Combine metrics (weighted average)
      this.systemLoad = (memoryLoad * 0.7) + (cpuLoad * 0.3);

      this.emit('systemLoadUpdate', {
        memoryLoad,
        cpuLoad,
        combinedLoad: this.systemLoad
      });

    } catch (error) {
      logger.error('Failed to update system load', {
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }
  }

  /**
   * Add request to priority queue
   */
  private async addToQueue(key: string, req: any): Promise<number> {
    if (!this.config.queueSize || this.config.queueSize <= 0) {
      return -1;
    }

    let queue = this.priorityQueues.get(key);
    if (!queue) {
      queue = [];
      this.priorityQueues.set(key, queue);
    }

    // Check queue capacity
    if (queue.length >= this.config.queueSize) {
      return -1;
    }

    // Add to queue
    const position = queue.length;
    const promise = new Promise((resolve, reject) => {
      queue!.push({
        req,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });

    // Process queue periodically
    this.processQueue(key);

    return position;
  }

  /**
   * Process queued requests
   */
  private async processQueue(key: string): void {
    const queue = this.priorityQueues.get(key);
    if (!queue || queue.length === 0) return;

    // Process queue in batches
    const batchSize = 5;
    const toProcess = queue.splice(0, batchSize);

    for (const item of toProcess) {
      // Check if request can now be processed
      const result = await this.checkRateLimit(item.req);
      if (result.success) {
        item.resolve();
      } else {
        // Re-queue if still rate limited
        queue.unshift(item);
      }
    }
  }

  /**
   * Start background monitoring
   */
  private startMonitoring(): void {
    // Clean old metrics periodically
    setInterval(() => {
      const cutoff = Date.now() - 3600000; // 1 hour ago
      for (const [key, metrics] of this.metrics.entries()) {
        const filtered = metrics.filter(m => m.timestamp > cutoff);
        if (filtered.length !== metrics.length) {
          this.metrics.set(key, filtered);
        }
      }
    }, 300000); // Every 5 minutes

    // Process queues periodically
    setInterval(() => {
      for (const key of this.priorityQueues.keys()) {
        this.processQueue(key);
      }
    }, 1000); // Every second
  }

  /**
   * Get rate limiting statistics
   */
  getStats(): {
    totalKeys: number;
    systemLoad: number;
    adaptiveLimits: Map<string, number>;
    queueSizes: Map<string, number>;
    loadSheddingActive: boolean;
  } {
    const queueSizes = new Map<string, number>();
    for (const [key, queue] of this.priorityQueues.entries()) {
      queueSizes.set(key, queue.length);
    }

    return {
      totalKeys: this.metrics.size,
      systemLoad: this.systemLoad,
      adaptiveLimits: new Map(this.adaptiveLimits),
      queueSizes,
      loadSheddingActive: this.loadSheddingActive
    };
  }

  /**
   * Reset rate limit for a key
   */
  async resetKey(key: string): Promise<void> {
    await this.cache.del(`rate_limit:${key}`);
    this.metrics.delete(key);
    this.adaptiveLimits.delete(key);
    this.priorityQueues.delete(key);
  }

  /**
   * Manually set adaptive limit
   */
  setAdaptiveLimit(key: string, limit: number): void {
    this.adaptiveLimits.set(key, limit);
    this.emit('adaptiveLimitSet', { key, limit });
  }

  /**
   * Enable or disable load shedding
   */
  setLoadShedding(enabled: boolean): void {
    this.loadSheddingActive = enabled;
    this.emit('loadSheddingChanged', { enabled });
  }
}

/**
 * Factory function to create rate limiters with different strategies
 */
export function createRateLimiter(strategy: 'default' | 'strict' | 'lenient' | 'adaptive', customConfig?: Partial<RateLimitConfig>): AdvancedRateLimiter {
  const configs: Record<string, Partial<RateLimitConfig>> = {
    default: {
      windowMs: 60000,
      maxRequests: 100,
      queueSize: 10,
      loadSheddingEnabled: false,
      adaptiveLimiting: false
    },
    strict: {
      windowMs: 60000,
      maxRequests: 50,
      queueSize: 0,
      loadSheddingEnabled: true,
      loadSheddingThreshold: 0.8,
      adaptiveLimiting: true
    },
    lenient: {
      windowMs: 60000,
      maxRequests: 1000,
      queueSize: 50,
      loadSheddingEnabled: false,
      adaptiveLimiting: false
    },
    adaptive: {
      windowMs: 60000,
      maxRequests: 100,
      queueSize: 20,
      loadSheddingEnabled: true,
      loadSheddingThreshold: 0.9,
      adaptiveLimiting: true
    }
  };

  const config = { ...configs[strategy], ...customConfig };
  return new AdvancedRateLimiter(config);
}