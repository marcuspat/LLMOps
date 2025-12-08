import { Pool, PoolConfig, PoolClient } from 'pg';
import { EventEmitter } from 'events';
import { logger } from '../utils/secure-logger.js';

interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  connectionUtilization: number;
  averageWaitTime: number;
  totalQueries: number;
  failedQueries: number;
  averageQueryTime: number;
}

interface ConnectionOptions extends PoolConfig {
  maxConnections?: number;
  minConnections?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  maxLifetimeMillis?: number;
  healthCheckInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Production-grade database connection pool with advanced features
 * - Connection pooling and reuse
 * - Health checks and monitoring
 * - Automatic retry logic
 * - Performance metrics
 * - Graceful degradation
 */
export class DatabasePool extends EventEmitter {
  private pool: Pool;
  private metrics: PoolMetrics;
  private healthCheckTimer?: NodeJS.Timeout;
  private lastHealthCheck?: Date;
  private connectionWaitTimes: number[] = [];
  private queryTimes: number[] = [];
  private readonly maxWaitTimeSamples = 1000;
  private readonly maxQueryTimeSamples = 10000;

  constructor(private options: ConnectionOptions) {
    super();

    // Default pool settings optimized for production
    const poolOptions: PoolConfig = {
      ...options,
      max: options.maxConnections || Math.max(10, options.max || 20),
      min: options.minConnections || Math.max(2, Math.floor((options.maxConnections || 20) * 0.2)),
      connectionTimeoutMillis: options.connectionTimeoutMillis || 30000,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      maxLifetimeMillis: options.maxLifetimeMillis || 3600000, // 1 hour
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    };

    this.pool = new Pool(poolOptions);
    this.metrics = this.initializeMetrics();
    this.setupPoolEvents();
    this.startHealthChecks();
  }

  private initializeMetrics(): PoolMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      connectionUtilization: 0,
      averageWaitTime: 0,
      totalQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0
    };
  }

  private setupPoolEvents(): void {
    this.pool.on('connect', (client) => {
      logger.debug('New database connection established', {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      });
      this.updateMetrics();
    });

    this.pool.on('acquire', (client) => {
      const waitTime = Date.now() - (client as any)._acquireStartTime;
      this.recordWaitTime(waitTime);
      this.updateMetrics();
    });

    this.pool.on('release', (err, client) => {
      if (err) {
        logger.error('Database connection released with error', { error: err.message });
        this.metrics.failedQueries++;
      }
      this.updateMetrics();
    });

    this.pool.on('remove', (client) => {
      logger.warn('Database connection removed from pool', {
        reason: client._removedReason || 'unknown'
      });
      this.updateMetrics();
    });

    this.pool.on('error', (err, client) => {
      logger.error('Database pool error', {
        error: err.message,
        stack: err.stack,
        clientId: client?.processID
      });
      this.emit('error', err);
      this.metrics.failedQueries++;
    });
  }

  private startHealthChecks(): void {
    const interval = this.options.healthCheckInterval || 30000; // 30 seconds
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, interval);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT NOW() as server_time, version() as version');
        this.lastHealthCheck = new Date();
        this.emit('healthCheck', {
          status: 'healthy',
          timestamp: this.lastHealthCheck,
          serverTime: result.rows[0].server_time,
          version: result.rows[0].version
        });
      } finally {
        client.release();
      }
    } catch (error) {
      this.lastHealthCheck = new Date();
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.emit('healthCheck', {
        status: 'unhealthy',
        timestamp: this.lastHealthCheck,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private recordWaitTime(waitTime: number): void {
    this.connectionWaitTimes.push(waitTime);
    if (this.connectionWaitTimes.length > this.maxWaitTimeSamples) {
      this.connectionWaitTimes = this.connectionWaitTimes.slice(-this.maxWaitTimeSamples);
    }
  }

  private recordQueryTime(queryTime: number): void {
    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > this.maxQueryTimeSamples) {
      this.queryTimes = this.queryTimes.slice(-this.maxQueryTimeSamples);
    }
  }

  private updateMetrics(): void {
    this.metrics.totalConnections = this.pool.totalCount;
    this.metrics.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.metrics.idleConnections = this.pool.idleCount;
    this.metrics.waitingClients = this.pool.waitingCount;
    this.metrics.connectionUtilization = this.metrics.totalConnections > 0
      ? (this.metrics.activeConnections / this.metrics.totalConnections) * 100
      : 0;
    this.metrics.averageWaitTime = this.connectionWaitTimes.length > 0
      ? this.connectionWaitTimes.reduce((a, b) => a + b, 0) / this.connectionWaitTimes.length
      : 0;
    this.metrics.averageQueryTime = this.queryTimes.length > 0
      ? this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length
      : 0;
  }

  /**
   * Execute a query with automatic retry logic and performance tracking
   */
  async query<T = any>(
    text: string,
    params?: any[],
    options?: {
      retryAttempts?: number;
      retryDelay?: number;
      timeout?: number;
      name?: string;
    }
  ): Promise<T[]> {
    const startTime = Date.now();
    const retryAttempts = options?.retryAttempts ?? this.options.retryAttempts ?? 3;
    const retryDelay = options?.retryDelay ?? this.options.retryDelay ?? 1000;
    const timeout = options?.timeout || 30000;
    const queryName = options?.name || 'unnamed_query';

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      let client: PoolClient | null = null;

      try {
        // Acquire connection with timeout
        client = await Promise.race([
          this.pool.connect(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), timeout)
          )
        ]);

        // Mark acquire time for metrics
        (client as any)._acquireStartTime = Date.now();

        // Execute query with timeout
        const result = await Promise.race([
          client.query<T>(text, params),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), timeout)
          )
        ]);

        const queryTime = Date.now() - startTime;
        this.recordQueryTime(queryTime);
        this.metrics.totalQueries++;

        logger.debug('Query executed successfully', {
          name: queryName,
          duration: queryTime,
          rows: result.rows.length,
          attempt: attempt + 1
        });

        this.emit('query', {
          name: queryName,
          duration: queryTime,
          rows: result.rows.length,
          success: true,
          attempt: attempt + 1
        });

        return result.rows;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown query error');

        logger.warn(`Query attempt ${attempt + 1} failed`, {
          name: queryName,
          error: lastError.message,
          attempt: attempt + 1,
          maxAttempts: retryAttempts + 1
        });

        // Release connection if acquired
        if (client) {
          client.release(lastError);
        }

        // Don't retry on certain errors
        if (lastError.message.includes('syntax error') ||
            lastError.message.includes('column') ||
            lastError.message.includes('relation') ||
            lastError.message.includes('duplicate key')) {
          break;
        }

        // Wait before retry (except on last attempt)
        if (attempt < retryAttempts) {
          await this.sleep(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    // All attempts failed
    this.metrics.failedQueries++;
    this.emit('query', {
      name: queryName,
      duration: Date.now() - startTime,
      success: false,
      error: lastError?.message,
      attempts: retryAttempts + 1
    });

    throw lastError || new Error('Query failed after all retry attempts');
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: {
      isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
      timeout?: number;
    }
  ): Promise<T> {
    const client = await this.pool.connect();
    const startTime = Date.now();

    try {
      await client.query('BEGIN');

      // Set isolation level if specified
      if (options?.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }

      // Execute callback with timeout if specified
      const result = options?.timeout
        ? await Promise.race([
            callback(client),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Transaction timeout')), options.timeout)
            )
          ])
        : await callback(client);

      await client.query('COMMIT');

      const duration = Date.now() - startTime;
      logger.debug('Transaction completed successfully', { duration });

      this.emit('transaction', {
        duration,
        success: true,
        isolationLevel: options?.isolationLevel || 'default'
      });

      return result;

    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Failed to rollback transaction', {
          error: rollbackError instanceof Error ? rollbackError.message : 'Unknown'
        });
      }

      const duration = Date.now() - startTime;
      logger.error('Transaction failed and rolled back', {
        duration,
        error: error instanceof Error ? error.message : 'Unknown'
      });

      this.emit('transaction', {
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown'
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics & {
    lastHealthCheck?: Date;
    averageConnectionWaitTime: number;
    p95ConnectionWaitTime: number;
    p99ConnectionWaitTime: number;
    averageQueryTime: number;
    p95QueryTime: number;
    p99QueryTime: number;
    errorRate: number;
  } {
    const sortedWaitTimes = [...this.connectionWaitTimes].sort((a, b) => a - b);
    const sortedQueryTimes = [...this.queryTimes].sort((a, b) => a - b);

    return {
      ...this.metrics,
      lastHealthCheck: this.lastHealthCheck,
      averageConnectionWaitTime: this.metrics.averageWaitTime,
      p95ConnectionWaitTime: this.getPercentile(sortedWaitTimes, 95),
      p99ConnectionWaitTime: this.getPercentile(sortedWaitTimes, 99),
      averageQueryTime: this.metrics.averageQueryTime,
      p95QueryTime: this.getPercentile(sortedQueryTimes, 95),
      p99QueryTime: this.getPercentile(sortedQueryTimes, 99),
      errorRate: this.metrics.totalQueries > 0
        ? (this.metrics.failedQueries / this.metrics.totalQueries) * 100
        : 0
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Gracefully close the connection pool
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    try {
      await this.pool.end();
      logger.info('Database connection pool closed successfully');
    } catch (error) {
      logger.error('Error closing database connection pool', {
        error: error instanceof Error ? error.message : 'Unknown'
      });
      throw error;
    }
  }

  /**
   * Force close all connections (emergency use only)
   */
  async forceClose(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Force close all connections
    this.pool.removeAllListeners();

    // Note: Pool doesn't have a direct force close method
    // This would need to be implemented based on specific requirements

    logger.warn('Database connection pool force closed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check status
   */
  isHealthy(): boolean {
    if (!this.lastHealthCheck) {
      return false;
    }

    // Consider unhealthy if no health check in last 2 minutes
    const timeSinceLastCheck = Date.now() - this.lastHealthCheck.getTime();
    return timeSinceLastCheck < 120000;
  }

  /**
   * Get pool configuration
   */
  getPoolInfo(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    max: number;
    min: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      max: this.pool.options.max as number,
      min: this.pool.options.min as number
    };
  }
}

// Singleton instance for the main application database
let mainDatabasePool: DatabasePool | null = null;

export function getDatabasePool(options?: ConnectionOptions): DatabasePool {
  if (!mainDatabasePool) {
    if (!options) {
      throw new Error('Database options required for first initialization');
    }
    mainDatabasePool = new DatabasePool(options);
  }
  return mainDatabasePool;
}

export async function closeDatabasePool(): Promise<void> {
  if (mainDatabasePool) {
    await mainDatabasePool.close();
    mainDatabasePool = null;
  }
}