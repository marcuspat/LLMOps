import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../utils/secure-logger.js';
import { getCacheManager, CacheManager } from './CacheManager.js';

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  heapUsagePercentage: number;
  bufferUsagePercentage: number;
  totalAllocated: number;
  totalFreed: number;
  allocationRate: number;
  gcStats: {
    collections: number;
    duration: number;
    forced: number;
  };
}

interface MemoryThreshold {
  warning: number; // % of heap usage
  critical: number; // % of heap usage
  maxHeapSize: number; // MB
  maxBufferUsage: number; // MB
  gcFrequency: number; // GCs per second
}

interface MemoryLeakDetection {
  enabled: boolean;
  interval: number; // ms
  threshold: number; // MB growth
  samples: Array<{
    timestamp: number;
    heapUsed: number;
    rss: number;
  }>;
}

/**
 * Advanced memory optimization and monitoring system
 * - Real-time memory tracking
 * - Automatic garbage collection optimization
 * - Memory leak detection
 * - Buffer pool management
 * - Memory usage alerts and thresholds
 * - Performance impact analysis
 */
export class MemoryOptimizer extends EventEmitter {
  private memoryStats: MemoryStats;
  private thresholds: MemoryThreshold;
  private leakDetection: MemoryLeakDetection;
  private bufferPools: Map<string, any[]> = new Map();
  private monitoringActive: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private gcListener?: NodeJS.UncaughtExceptionMonitor;
  private lastGC: number = 0;
  private gcCount: number = 0;
  private gcDuration: number = 0;
  private startGCTime: number = 0;

  constructor() {
    super();

    this.memoryStats = this.initializeStats();
    this.thresholds = this.getDefaultThresholds();
    this.leakDetection = {
      enabled: true,
      interval: 30000, // 30 seconds
      threshold: 50, // MB growth
      samples: []
    };

    this.setupGCListener();
  }

  /**
   * Start memory monitoring
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringActive) {
      logger.warn('Memory monitoring already active');
      return;
    }

    this.monitoringActive = true;
    this.monitoringInterval = setInterval(() => {
      this.updateMemoryStats();
      this.checkThresholds();
      this.detectMemoryLeaks();
    }, intervalMs);

    logger.info('Memory monitoring started', { interval: intervalMs });
    this.emit('monitoringStarted');
  }

  /**
   * Stop memory monitoring
   */
  public stopMonitoring(): void {
    if (!this.monitoringActive) {
      return;
    }

    this.monitoringActive = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Memory monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Get current memory statistics
   */
  public getMemoryStats(): MemoryStats & {
    trends: {
      heapGrowth: number;
      bufferGrowth: number;
      allocationRate: number;
    };
    recommendations: string[];
  } {
    const trends = this.calculateTrends();
    const recommendations = this.generateRecommendations();

    return {
      ...this.memoryStats,
      trends,
      recommendations
    };
  }

  /**
   * Force garbage collection
   */
  public forceGC(): Promise<void> {
    return new Promise((resolve) => {
      if (global.gc) {
        const beforeGC = performance.now();
        const beforeStats = process.memoryUsage();

        global.gc();

        const afterGC = performance.now();
        const afterStats = process.memoryUsage();

        this.gcDuration += afterGC - beforeGC;
        this.gcCount++;

        const freed = beforeStats.heapUsed - afterStats.heapUsed;

        logger.info('Manual garbage collection completed', {
          duration: afterGC - beforeGC,
          freedBytes: freed,
          freedMB: freed / 1024 / 1024
        });

        this.updateMemoryStats();
        this.emit('garbageCollected', {
          forced: true,
          duration: afterGC - beforeGC,
          freed: freed
        });

        resolve();
      } else {
        logger.warn('Garbage collection not available (run with --expose-gc)');
        resolve();
      }
    });
  }

  /**
   * Optimize memory usage
   */
  public async optimizeMemory(): Promise<{
    freedBytes: number;
    optimizations: string[];
  }> {
    const before = process.memoryUsage();
    const optimizations: string[] = [];
    let freedBytes = 0;

    // Clear buffer pools
    freedBytes += this.clearBufferPools();
    optimizations.push('Buffer pools cleared');

    // Force GC if available
    if (global.gc) {
      await this.forceGC();
      optimizations.push('Forced garbage collection');
    }

    // Clear old cached data (if cache manager available)
    try {
      const cacheManager = getCacheManager();
      await cacheManager.clear('temp_*');
      optimizations.push('Temporary cache cleared');
    } catch (error) {
      // Cache manager not available
    }

    const after = process.memoryUsage();
    freedBytes += before.heapUsed - after.heapUsed;

    logger.info('Memory optimization completed', {
      freedBytes,
      freedMB: freedBytes / 1024 / 1024,
      optimizations
    });

    this.emit('memoryOptimized', { freedBytes, optimizations });

    return { freedBytes, optimizations };
  }

  /**
   * Get buffer from pool or create new one
   */
  public getBuffer(size: number, type: string = 'default'): Buffer {
    const pool = this.getBufferPool(type);
    const buffer = pool.pop();

    if (buffer && buffer.length >= size) {
      // Reuse existing buffer
      return buffer;
    }

    // Create new buffer
    return Buffer.allocUnsafe(size);
  }

  /**
   * Return buffer to pool
   */
  public returnBuffer(buffer: Buffer, type: string = 'default'): void {
    const pool = this.getBufferPool(type);

    // Only keep buffers that aren't too large
    if (pool.length < 100 && buffer.length <= 1024 * 1024) { // Max 1MB, max 100 buffers
      pool.push(buffer);
    }
  }

  /**
   * Set custom memory thresholds
   */
  public setThresholds(thresholds: Partial<MemoryThreshold>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Memory thresholds updated', { thresholds: this.thresholds });
  }

  /**
   * Enable/disable memory leak detection
   */
  public setLeakDetection(enabled: boolean, options?: Partial<MemoryLeakDetection>): void {
    this.leakDetection = {
      ...this.leakDetection,
      enabled,
      ...options
    };

    if (!enabled) {
      this.leakDetection.samples = [];
    }

    logger.info('Memory leak detection updated', {
      enabled,
      interval: this.leakDetection.interval,
      threshold: this.leakDetection.threshold
    });
  }

  /**
   * Create memory-efficient object pool
   */
  public createObjectPool<T>(
    createFn: () => T,
    resetFn: (obj: T) => void,
    maxSize: number = 100
  ): {
    get: () => T;
    release: (obj: T) => void;
    size: () => number;
    clear: () => void;
  } {
    const pool: T[] = [];

    return {
      get: (): T => {
        if (pool.length > 0) {
          return pool.pop()!;
        }
        return createFn();
      },

      release: (obj: T): void => {
        if (pool.length < maxSize) {
          resetFn(obj);
          pool.push(obj);
        }
      },

      size: (): number => pool.length,

      clear: (): void => {
        pool.length = 0;
      }
    };
  }

  // Private methods

  private initializeStats(): MemoryStats {
    const memUsage = process.memoryUsage();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: 0, // Would need Node.js v12+ for actual tracking
      heapUsagePercentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      bufferUsagePercentage: 0,
      totalAllocated: 0,
      totalFreed: 0,
      allocationRate: 0,
      gcStats: {
        collections: 0,
        duration: 0,
        forced: 0
      }
    };
  }

  private getDefaultThresholds(): MemoryThreshold {
    return {
      warning: 75, // 75% heap usage
      critical: 90, // 90% heap usage
      maxHeapSize: 1024, // 1GB
      maxBufferUsage: 512, // 512MB
      gcFrequency: 5 // 5 GCs per second max
    };
  }

  private setupGCListener(): void {
    // Try to listen for GC events (Node.js v12+)
    if (process.on && typeof process.on === 'function') {
      process.on('gc', (info) => {
        this.handleGCEvent(info);
      });
    }
  }

  private handleGCEvent(info: any): void {
    const now = performance.now();

    if (this.startGCTime > 0) {
      const duration = now - this.startGCTime;
      this.gcDuration += duration;

      if (info && info.type === 'scavenge') {
        this.memoryStats.gcStats.collections++;
      } else if (info && info.type === 'mark-sweep-compact') {
        this.memoryStats.gcStats.collections++;
      }
    }

    this.startGCTime = now;
    this.lastGC = now;

    this.emit('garbageCollected', {
      info,
      timestamp: now
    });
  }

  private updateMemoryStats(): void {
    const memUsage = process.memoryUsage();
    const heapUsedDiff = memUsage.heapUsed - this.memoryStats.heapUsed;
    const now = Date.now();

    this.memoryStats = {
      ...this.memoryStats,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: this.getArrayBuffersUsage(),
      heapUsagePercentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      bufferUsagePercentage: (this.getArrayBuffersUsage() / 1024 / 1024) * 100 / this.thresholds.maxBufferUsage,
      totalAllocated: this.memoryStats.totalAllocated + Math.max(0, heapUsedDiff),
      allocationRate: this.calculateAllocationRate(now),
      gcStats: {
        ...this.memoryStats.gcStats,
        duration: this.gcDuration,
        forced: this.gcStats ? this.memoryStats.gcStats.forced + 1 : 0
      }
    };

    this.emit('statsUpdated', this.memoryStats);
  }

  private getArrayBuffersUsage(): number {
    // Approximate array buffer usage
    return this.memoryStats.arrayBuffers;
  }

  private calculateAllocationRate(now: number): number {
    // Simple calculation - would need more sophisticated tracking in production
    return this.memoryStats.allocationRate;
  }

  private checkThresholds(): void {
    const stats = this.memoryStats;
    let alertLevel: 'normal' | 'warning' | 'critical' = 'normal';

    // Check heap usage
    if (stats.heapUsagePercentage >= this.thresholds.critical) {
      alertLevel = 'critical';
      this.emit('memoryThreshold', {
        type: 'heap',
        level: 'critical',
        percentage: stats.heapUsagePercentage,
        threshold: this.thresholds.critical
      });

      // Force GC at critical levels
      this.forceGC();
    } else if (stats.heapUsagePercentage >= this.thresholds.warning) {
      alertLevel = 'warning';
      this.emit('memoryThreshold', {
        type: 'heap',
        level: 'warning',
        percentage: stats.heapUsagePercentage,
        threshold: this.thresholds.warning
      });
    }

    // Check buffer usage
    if (stats.bufferUsagePercentage >= this.thresholds.critical) {
      alertLevel = 'critical';
      this.emit('memoryThreshold', {
        type: 'buffer',
        level: 'critical',
        percentage: stats.bufferUsagePercentage,
        threshold: this.thresholds.critical
      });

      // Clear buffer pools at critical levels
      this.clearBufferPools();
    }

    // Check GC frequency
    const gcFrequency = this.memoryStats.gcStats.collections / (process.uptime() || 1);
    if (gcFrequency > this.thresholds.gcFrequency) {
      this.emit('memoryThreshold', {
        type: 'gc',
        level: 'warning',
        frequency: gcFrequency,
        threshold: this.thresholds.gcFrequency
      });
    }
  }

  private detectMemoryLeaks(): void {
    if (!this.leakDetection.enabled) {
      return;
    }

    const sample = {
      timestamp: Date.now(),
      heapUsed: this.memoryStats.heapUsed,
      rss: this.memoryStats.rss
    };

    this.leakDetection.samples.push(sample);

    // Keep only last 10 samples
    if (this.leakDetection.samples.length > 10) {
      this.leakDetection.samples.shift();
    }

    // Check for memory growth
    if (this.leakDetection.samples.length >= 3) {
      const oldest = this.leakDetection.samples[0];
      const newest = this.leakDetection.samples[this.leakDetection.samples.length - 1];
      const growthMB = (newest.heapUsed - oldest.heapUsed) / 1024 / 1024;
      const timeDiffMinutes = (newest.timestamp - oldest.timestamp) / 60000;

      if (growthMB > this.leakDetection.threshold && timeDiffMinutes < 5) {
        this.emit('memoryLeakDetected', {
          growthMB,
          timeMinutes: timeDiffMinutes,
          rate: growthMB / timeDiffMinutes,
          samples: this.leakDetection.samples
        });

        logger.warn('Potential memory leak detected', {
          growthMB,
          timeMinutes: timeDiffMinutes,
          rate: growthMB / timeDiffMinutes
        });
      }
    }
  }

  private calculateTrends(): {
    heapGrowth: number;
    bufferGrowth: number;
    allocationRate: number;
  } {
    const samples = this.leakDetection.samples;
    if (samples.length < 2) {
      return {
        heapGrowth: 0,
        bufferGrowth: 0,
        allocationRate: 0
      };
    }

    const oldest = samples[0];
    const newest = samples[samples.length - 1];
    const timeDiff = (newest.timestamp - oldest.timestamp) / 1000; // seconds

    return {
      heapGrowth: (newest.heapUsed - oldest.heapUsed) / timeDiff,
      bufferGrowth: 0, // Would need actual buffer tracking
      allocationRate: this.memoryStats.allocationRate
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.memoryStats;

    // Heap usage recommendations
    if (stats.heapUsagePercentage > 80) {
      recommendations.push('Heap usage is high - consider optimizing object creation and lifecycle');
      recommendations.push('Review for memory leaks and implement object pooling');
    }

    // GC recommendations
    if (stats.gcStats.collections > 100) {
      recommendations.push('High GC frequency detected - reduce object allocation rate');
      recommendations.push('Consider using object pools for frequently created/destroyed objects');
    }

    // Buffer recommendations
    if (stats.bufferUsagePercentage > 50) {
      recommendations.push('Buffer usage is high - implement buffer pooling');
      recommendations.push('Check for buffer leaks and ensure proper cleanup');
    }

    // General recommendations
    if (stats.external > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High external memory usage - review native module usage');
    }

    return recommendations;
  }

  private getBufferPool(type: string): Buffer[] {
    if (!this.bufferPools.has(type)) {
      this.bufferPools.set(type, []);
    }
    return this.bufferPools.get(type)!;
  }

  private clearBufferPools(): number {
    let totalSize = 0;

    for (const [type, pool] of this.bufferPools.entries()) {
      for (const buffer of pool) {
        totalSize += buffer.length;
      }
      pool.length = 0;
    }

    return totalSize;
  }

  /**
   * Get memory optimization report
   */
  public getOptimizationReport(): {
    summary: MemoryStats & { trends: any; recommendations: string[] };
    analysis: {
      healthScore: number;
      issues: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
      }>;
    };
    actions: Array<{
      priority: 'low' | 'medium' | 'high';
      action: string;
      impact: string;
    }>;
  } {
    const summary = this.getMemoryStats();
    const analysis = this.analyzeMemoryHealth();
    const actions = this.generateOptimizationActions();

    return {
      summary,
      analysis,
      actions
    };
  }

  private analyzeMemoryHealth(): {
    healthScore: number;
    issues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
    }>;
  } {
    const issues: any[] = [];
    let score = 100;

    // Check heap usage
    if (this.memoryStats.heapUsagePercentage > 90) {
      issues.push({
        type: 'heap_usage',
        severity: 'critical',
        description: `Critical heap usage: ${this.memoryStats.heapUsagePercentage.toFixed(1)}%`
      });
      score -= 40;
    } else if (this.memoryStats.heapUsagePercentage > 75) {
      issues.push({
        type: 'heap_usage',
        severity: 'high',
        description: `High heap usage: ${this.memoryStats.heapUsagePercentage.toFixed(1)}%`
      });
      score -= 20;
    }

    // Check GC frequency
    const gcFreq = this.memoryStats.gcStats.collections / (process.uptime() || 1);
    if (gcFreq > 10) {
      issues.push({
        type: 'gc_frequency',
        severity: 'high',
        description: `High GC frequency: ${gcFreq.toFixed(1)}/sec`
      });
      score -= 15;
    }

    // Check external memory
    const externalMB = this.memoryStats.external / 1024 / 1024;
    if (externalMB > 200) {
      issues.push({
        type: 'external_memory',
        severity: 'medium',
        description: `High external memory usage: ${externalMB.toFixed(1)}MB`
      });
      score -= 10;
    }

    return {
      healthScore: Math.max(0, score),
      issues
    };
  }

  private generateOptimizationActions(): Array<{
    priority: 'low' | 'medium' | 'high';
    action: string;
    impact: string;
  }> {
    const actions: any[] = [];

    // High priority actions
    if (this.memoryStats.heapUsagePercentage > 90) {
      actions.push({
        priority: 'high',
        action: 'Immediate garbage collection and memory optimization',
        impact: 'Prevent out-of-memory errors'
      });
    }

    // Medium priority actions
    if (this.memoryStats.heapUsagePercentage > 75) {
      actions.push({
        priority: 'medium',
        action: 'Review and optimize memory-intensive operations',
        impact: 'Reduce memory pressure by 20-30%'
      });
    }

    // Add general actions based on analysis
    const recommendations = this.generateRecommendations();
    recommendations.forEach(rec => {
      actions.push({
        priority: 'medium',
        action: rec,
        impact: 'Improve memory efficiency'
      });
    });

    return actions;
  }
}

// Singleton instance
let memoryOptimizer: MemoryOptimizer | null = null;

export function getMemoryOptimizer(): MemoryOptimizer {
  if (!memoryOptimizer) {
    memoryOptimizer = new MemoryOptimizer();
  }
  return memoryOptimizer;
}