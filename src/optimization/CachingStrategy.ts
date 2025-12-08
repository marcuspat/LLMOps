/**
 * Comprehensive Multi-Level Caching Strategy
 * Implements memory, computed, and response caching with TTL and LRU eviction
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  maxSize: number;
  hitRate: number;
}

export class CachingStrategy {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private computedCache: Map<string, CacheEntry<any>> = new Map();
  private responseCache: Map<string, CacheEntry<any>> = new Map();
  private stats: Map<string, CacheStats> = new Map();

  // Default TTL values in milliseconds
  private readonly DEFAULT_MEMORY_TTL = 300000; // 5 minutes
  private readonly DEFAULT_COMPUTED_TTL = 600000; // 10 minutes
  private readonly DEFAULT_RESPONSE_TTL = 60000; // 1 minute

  // Cache size limits
  private readonly MEMORY_CACHE_MAX_SIZE = 100; // MB
  private readonly COMPUTED_CACHE_MAX_SIZE = 50; // MB
  private readonly RESPONSE_CACHE_MAX_SIZE = 25; // MB

  constructor() {
    this.initializeStats();
    this.setupCacheCleanup();
  }

  /**
   * Memory cache for frequently accessed data
   */
  public setMemoryCache<T>(key: string, data: T, ttl: number = this.DEFAULT_MEMORY_TTL): void {
    this.setCache(this.memoryCache, key, data, ttl, 'memory');
  }

  public getMemoryCache<T>(key: string): T | null {
    return this.getCache(this.memoryCache, key, 'memory');
  }

  public setComputedCache<T>(key: string, data: T, ttl: number = this.DEFAULT_COMPUTED_TTL): void {
    this.setCache(this.computedCache, key, data, ttl, 'computed');
  }

  public getComputedCache<T>(key: string): T | null {
    return this.getCache(this.computedCache, key, 'computed');
  }

  public setResponseCache<T>(key: string, data: T, ttl: number = this.DEFAULT_RESPONSE_TTL): void {
    this.setCache(this.responseCache, key, data, ttl, 'response');
  }

  public getResponseCache<T>(key: string): T | null {
    return this.getCache(this.responseCache, key, 'response');
  }

  /**
   * Generic cache setter with LRU and size management
   */
  private setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number, cacheType: string): void {
    const now = Date.now();

    // Check if we need to evict entries
    if (this.shouldEvict(cache, cacheType)) {
      this.evictLRU(cache, cacheType);
    }

    // Create cache entry
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      accessCount: 1,
      lastAccessed: now
    };

    cache.set(key, entry);
  }

  /**
   * Generic cache getter with TTL checking
   */
  private getCache<T>(cache: Map<string, CacheEntry<T>>, key: string, cacheType: string): T | null {
    const entry = cache.get(key);
    const stats = this.stats.get(cacheType);

    if (!entry) {
      stats.misses++;
      return null;
    }

    const now = Date.now();

    // Check TTL
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
      stats.misses++;
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = now;
    stats.hits++;

    return entry.data;
  }

  /**
   * Batch cache operations for better performance
   */
  public setBatchMemoryCache<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    const now = Date.now();
    const batch: Array<{ key: string; entry: CacheEntry<T> }> = [];

    entries.forEach(({ key, data, ttl = this.DEFAULT_MEMORY_TTL }) => {
      batch.push({
        key,
        entry: {
          data,
          timestamp: now,
          ttl,
          accessCount: 1,
          lastAccessed: now
        }
      });
    });

    // Sort by importance (could be customized)
    batch.sort((a, b) => {
      // Prioritize shorter keys (usually more important)
      return a.key.length - b.key.length;
    });

    // Insert batch
    batch.forEach(({ key, entry }) => {
      if (this.shouldEvict(this.memoryCache, 'memory')) {
        this.evictLRU(this.memoryCache, 'memory');
      }
      this.memoryCache.set(key, entry);
    });
  }

  public getBatchMemoryCache<T>(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();
    const now = Date.now();

    keys.forEach(key => {
      const entry = this.memoryCache.get(key);
      if (entry && now - entry.timestamp <= entry.ttl) {
        entry.accessCount++;
        entry.lastAccessed = now;
        result.set(key, entry.data);
        this.stats.get('memory').hits++;
      } else {
        this.stats.get('memory').misses++;
      }
    });

    return result;
  }

  /**
   * Intelligent cache warming for frequently accessed data
   */
  public async warmCache(cacheType: string, warmupData: Array<{ key: string; data: any; ttl?: number }>): Promise<void> {
    console.log(`🔥 Warming up ${cacheType} cache with ${warmupData.length} entries...`);

    const cache = this.getCacheByType(cacheType);
    const defaultTtl = this.getDefaultTTL(cacheType);

    // Process in batches to avoid blocking
    const batchSize = 10;
    for (let i = 0; i < warmupData.length; i += batchSize) {
      const batch = warmupData.slice(i, i + batchSize);

      batch.forEach(({ key, data, ttl = defaultTtl }) => {
        this.setCache(cache, key, data, ttl, cacheType);
      });

      // Yield control every batch
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    console.log(`✅ Cache warming completed: ${cacheType} cache now has ${cache.size} entries`);
  }

  /**
   * Cache invalidation strategies
   */
  public invalidateByPattern(pattern: RegExp, cacheType?: string): number {
    let invalidatedCount = 0;
    const caches = cacheType ? [this.getCacheByType(cacheType)] : [this.memoryCache, this.computedCache, this.responseCache];

    caches.forEach(cache => {
      const keysToDelete: string[] = [];

      cache.forEach((value, key) => {
        if (pattern.test(key)) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => cache.delete(key));
      invalidatedCount += keysToDelete.length;
    });

    return invalidatedCount;
  }

  public invalidateByPrefix(prefix: string, cacheType?: string): number {
    return this.invalidateByPattern(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), cacheType);
  }

  public invalidateExpired(cacheType?: string): number {
    let invalidatedCount = 0;
    const now = Date.now();
    const caches = cacheType ? [this.getCacheByType(cacheType)] : [this.memoryCache, this.computedCache, this.responseCache];

    caches.forEach(cache => {
      const keysToDelete: string[] = [];

      cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => cache.delete(key));
      invalidatedCount += keysToDelete.length;
    });

    return invalidatedCount;
  }

  /**
   * Cache statistics and monitoring
   */
  public getCacheStats(cacheType?: string): Map<string, CacheStats> {
    if (cacheType) {
      const stats = new Map<string, CacheStats>();
      const cacheStats = this.stats.get(cacheType);
      if (cacheStats) {
        stats.set(cacheType, { ...cacheStats });
      }
      return stats;
    }

    return new Map(this.stats);
  }

  public getDetailedCacheInfo(): any {
    return {
      memory: {
        size: this.memoryCache.size,
        maxSize: this.MEMORY_CACHE_MAX_SIZE,
        stats: this.stats.get('memory')
      },
      computed: {
        size: this.computedCache.size,
        maxSize: this.COMPUTED_CACHE_MAX_SIZE,
        stats: this.stats.get('computed')
      },
      response: {
        size: this.responseCache.size,
        maxSize: this.RESPONSE_CACHE_MAX_SIZE,
        stats: this.stats.get('response')
      },
      overall: this.calculateOverallStats()
    };
  }

  /**
   * Advanced cache operations
   */
  public promoteToMemoryCache<T>(key: string, sourceCacheType: 'computed' | 'response', ttl?: number): boolean {
    const sourceCache = this.getCacheByType(sourceCacheType);
    const data = this.getCache(sourceCache, key, sourceCacheType);

    if (data) {
      this.setMemoryCache(key, data, ttl);
      return true;
    }

    return false;
  }

  public demoteFromMemoryCache<T>(key: string, targetCacheType: 'computed' | 'response', ttl?: number): boolean {
    const data = this.getMemoryCache<T>(key);

    if (data) {
      if (targetCacheType === 'computed') {
        this.setComputedCache(key, data, ttl);
      } else {
        this.setResponseCache(key, data, ttl);
      }
      this.memoryCache.delete(key);
      return true;
    }

    return false;
  }

  /**
   * Cache optimization suggestions
   */
  public getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const stats = this.getDetailedCacheInfo();

    // Analyze hit rates
    Object.entries(stats).forEach(([cacheType, info]) => {
      if (info.stats && info.stats.hitRate < 0.7) {
        suggestions.push(`Low hit rate (${(info.stats.hitRate * 100).toFixed(1)}%) in ${cacheType} cache - consider warming cache or adjusting TTL`);
      }

      if (info.stats && info.stats.evictions > 10) {
        suggestions.push(`High eviction count (${info.stats.evictions}) in ${cacheType} cache - consider increasing size or reducing TTL`);
      }
    });

    // Check cache sizes
    if (stats.memory.size > stats.memory.maxSize * 0.9) {
      suggestions.push('Memory cache near capacity - consider increasing size or optimizing data');
    }

    return suggestions;
  }

  // Private helper methods

  private getCacheByType(cacheType: string): Map<string, CacheEntry<any>> {
    switch (cacheType) {
      case 'memory': return this.memoryCache;
      case 'computed': return this.computedCache;
      case 'response': return this.responseCache;
      default: throw new Error(`Unknown cache type: ${cacheType}`);
    }
  }

  private getDefaultTTL(cacheType: string): number {
    switch (cacheType) {
      case 'memory': return this.DEFAULT_MEMORY_TTL;
      case 'computed': return this.DEFAULT_COMPUTED_TTL;
      case 'response': return this.DEFAULT_RESPONSE_TTL;
      default: return this.DEFAULT_MEMORY_TTL;
    }
  }

  private shouldEvict(cache: Map<string, CacheEntry<any>>, cacheType: string): boolean {
    const maxSize = this.getMaxSize(cacheType);
    return cache.size >= maxSize;
  }

  private getMaxSize(cacheType: string): number {
    switch (cacheType) {
      case 'memory': return this.MEMORY_CACHE_MAX_SIZE;
      case 'computed': return this.COMPUTED_CACHE_MAX_SIZE;
      case 'response': return this.RESPONSE_CACHE_MAX_SIZE;
      default: return 100;
    }
  }

  private evictLRU(cache: Map<string, CacheEntry<any>>, cacheType: string): void {
    if (cache.size === 0) return;

    // Find least recently used entry
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    cache.forEach((entry, key) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      cache.delete(oldestKey);
      this.stats.get(cacheType).evictions++;
    }
  }

  private initializeStats(): void {
    this.stats.set('memory', {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      maxSize: this.MEMORY_CACHE_MAX_SIZE,
      hitRate: 0
    });

    this.stats.set('computed', {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      maxSize: this.COMPUTED_CACHE_MAX_SIZE,
      hitRate: 0
    });

    this.stats.set('response', {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      maxSize: this.RESPONSE_CACHE_MAX_SIZE,
      hitRate: 0
    });
  }

  private calculateOverallStats(): any {
    const totalHits = Array.from(this.stats.values()).reduce((sum, stats) => sum + stats.hits, 0);
    const totalMisses = Array.from(this.stats.values()).reduce((sum, stats) => sum + stats.misses, 0);
    const totalSize = Array.from(this.stats.values()).reduce((sum, stats) => sum + stats.currentSize, 0);
    const totalMaxSize = Array.from(this.stats.values()).reduce((sum, stats) => sum + stats.maxSize, 0);

    return {
      totalHits,
      totalMisses,
      totalSize,
      totalMaxSize,
      overallHitRate: totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
      utilizationRate: totalMaxSize > 0 ? totalSize / totalMaxSize : 0
    };
  }

  private setupCacheCleanup(): void {
    // Clean expired entries every 5 minutes
    setInterval(() => {
      const invalidated = this.invalidateExpired();
      if (invalidated > 0) {
        console.log(`🧹 Cleaned ${invalidated} expired cache entries`);
      }
    }, 300000);

    // Update hit rates every minute
    setInterval(() => {
      this.stats.forEach((stats, cacheType) => {
        const total = stats.hits + stats.misses;
        stats.hitRate = total > 0 ? stats.hits / total : 0;
        stats.currentSize = this.getCacheByType(cacheType).size;
      });
    }, 60000);
  }
}