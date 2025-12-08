import { Router, Request, Response } from 'express';
import { createClient } from 'redis';
import { Pool } from 'pg';
import { performance } from 'perf_hooks';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: ServiceHealth[];
  system: SystemHealth;
  metrics: HealthMetrics;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  details?: any;
}

interface SystemHealth {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

interface HealthMetrics {
  httpRequests: number;
  errorRate: number;
  responseTime: number;
  activeConnections: number;
}

// Cache health status to reduce overhead
let healthCache: HealthStatus | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

// Service configurations
const services = {
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'turboflow',
    user: process.env.DATABASE_USER || 'turboflow',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DATABASE_SSL === 'true'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0')
  }
};

// Initialize metrics
let metrics: HealthMetrics = {
  httpRequests: 0,
  errorRate: 0,
  responseTime: 0,
  activeConnections: 0
};

// Track HTTP requests
router.use((req, res, next) => {
  metrics.httpRequests++;
  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;
    metrics.responseTime = (metrics.responseTime + duration) / 2;

    if (res.statusCode >= 400) {
      metrics.errorRate = Math.min(1, metrics.errorRate + 0.01);
    } else {
      metrics.errorRate = Math.max(0, metrics.errorRate - 0.001);
    }
  });

  next();
});

// Simple health check endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = performance.now();

    // Quick basic checks
    const checks = await Promise.allSettled([
      checkDatabaseConnection(),
      checkRedisConnection()
    ]);

    const allHealthy = checks.every(check =>
      check.status === 'fulfilled' && check.value
    );

    const responseTime = performance.now() - startTime;

    res.json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: Math.round(responseTime),
      services: {
        database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Detailed health check endpoint
router.get('/detailed', async (req: Request, res: Response) => {
  const now = Date.now();

  // Return cached response if still valid
  if (healthCache && (now - cacheTimestamp) < CACHE_TTL) {
    return res.json(healthCache);
  }

  try {
    const startTime = performance.now();
    const startTimeMs = process.hrtime.bigint();

    // Run all health checks in parallel
    const [
      dbHealth,
      redisHealth,
      systemHealth,
      diskHealth
    ] = await Promise.allSettled([
        checkDatabaseConnectionDetailed(),
        checkRedisConnectionDetailed(),
        getSystemHealth(),
        getDiskHealth()
    ]);

    // Build service health array
    const services: ServiceHealth[] = [
      {
        name: 'database',
        status: dbHealth.status === 'fulfilled' ? dbHealth.value.status : 'unhealthy',
        responseTime: dbHealth.status === 'fulfilled' ? dbHealth.value.responseTime : undefined,
        error: dbHealth.status === 'rejected' ? dbHealth.reason.message : undefined,
        details: dbHealth.status === 'fulfilled' ? dbHealth.value.details : undefined
      },
      {
        name: 'redis',
        status: redisHealth.status === 'fulfilled' ? redisHealth.value.status : 'unhealthy',
        responseTime: redisHealth.status === 'fulfilled' ? redisHealth.value.responseTime : undefined,
        error: redisHealth.status === 'rejected' ? redisHealth.reason.message : undefined,
        details: redisHealth.status === 'fulfilled' ? redisHealth.value.details : undefined
      },
      {
        name: 'disk',
        status: diskHealth.status === 'fulfilled' ?
          (diskHealth.value.percentage > 90 ? 'degraded' : 'healthy') : 'unhealthy',
        details: diskHealth.status === 'fulfilled' ? diskHealth.value : undefined
      }
    ];

    // Determine overall status
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTimeMs) / 1000000; // Convert to milliseconds

    // Get package.json for version
    const packagePath = path.join(process.cwd(), 'package.json');
    let version = 'unknown';
    try {
      const packageContent = await fs.readFile(packagePath, 'utf8');
      version = JSON.parse(packageContent).version || 'unknown';
    } catch {
      // Ignore version read errors
    }

    const healthData: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version,
      services,
      system: systemHealth.status === 'fulfilled' ? systemHealth.value : {
        cpu: { usage: 0, loadAverage: [0, 0, 0] },
        memory: { used: 0, total: 0, percentage: 0 },
        disk: { used: 0, total: 0, percentage: 0 }
      },
      metrics: { ...metrics }
    };

    // Cache the result
    healthCache = healthData;
    cacheTimestamp = now;

    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthData);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: [],
      system: { cpu: { usage: 0, loadAverage: [0, 0, 0] }, memory: { used: 0, total: 0, percentage: 0 }, disk: { used: 0, total: 0, percentage: 0 } },
      metrics: { ...metrics }
    });
  }
});

// Liveness probe (Kubernetes style)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// Readiness probe (Kubernetes style)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check critical services
    const [dbConnected, redisConnected] = await Promise.all([
      checkDatabaseConnection(),
      checkRedisConnection()
    ]);

    const isReady = dbConnected && redisConnected;

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'ready' : 'not ready',
        redis: redisConnected ? 'ready' : 'not ready'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed'
    });
  }
});

// Database connection check
async function checkDatabaseConnection(): Promise<boolean> {
  const pool = new Pool({
    host: services.database.host,
    port: services.database.port,
    database: services.database.database,
    user: services.database.user,
    password: services.database.password,
    ssl: services.database.ssl,
    connectionTimeoutMillis: 3000,
    max: 1
  });

  try {
    const result = await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch (error) {
    await pool.end();
    return false;
  }
}

// Detailed database health check
async function checkDatabaseConnectionDetailed(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: any;
}> {
  const startTime = performance.now();
  const pool = new Pool({
    host: services.database.host,
    port: services.database.port,
    database: services.database.database,
    user: services.database.user,
    password: services.database.password,
    ssl: services.database.ssl,
    connectionTimeoutMillis: 3000,
    max: 1
  });

  try {
    const [connectionResult, statsResult] = await Promise.all([
      pool.query('SELECT 1'),
      pool.query(`
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections
        FROM pg_stat_activity
      `)
    ]);

    const responseTime = performance.now() - startTime;
    await pool.end();

    return {
      status: 'healthy',
      responseTime,
      details: {
        connections: {
          total: parseInt(statsResult.rows[0].total_connections),
          active: parseInt(statsResult.rows[0].active_connections)
        }
      }
    };
  } catch (error) {
    await pool.end();
    const responseTime = performance.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      details: {
        error: (error as Error).message
      }
    };
  }
}

// Redis connection check
async function checkRedisConnection(): Promise<boolean> {
  const client = createClient({
    socket: {
      host: services.redis.host,
      port: services.redis.port
    },
    password: services.redis.password,
    database: services.redis.db
  });

  try {
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch (error) {
    await client.quit().catch(() => {});
    return false;
  }
}

// Detailed Redis health check
async function checkRedisConnectionDetailed(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: any;
}> {
  const startTime = performance.now();
  const client = createClient({
    socket: {
      host: services.redis.host,
      port: services.redis.port
    },
    password: services.redis.password,
    database: services.redis.db
  });

  try {
    await client.connect();

    const [ping, info] = await Promise.all([
      client.ping(),
      client.info('memory', 'clients', 'stats')
    ]);

    const responseTime = performance.now() - startTime;
    await client.quit();

    // Parse Redis info
    const infoLines = info.split('\r\n');
    const infoObj: any = {};
    for (const line of infoLines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        infoObj[key] = value;
      }
    }

    return {
      status: 'healthy',
      responseTime,
      details: {
        connected_clients: parseInt(infoObj.connected_clients) || 0,
        used_memory: parseInt(infoObj.used_memory) || 0,
        used_memory_human: infoObj.used_memory_human || '0B',
        total_commands_processed: parseInt(infoObj.total_commands_processed) || 0,
        keyspace_hits: parseInt(infoObj.keyspace_hits) || 0,
        keyspace_misses: parseInt(infoObj.keyspace_misses) || 0
      }
    };
  } catch (error) {
    await client.quit().catch(() => {});
    const responseTime = performance.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      details: {
        error: (error as Error).message
      }
    };
  }
}

// Get system health metrics
async function getSystemHealth(): Promise<SystemHealth> {
  const cpus = require('os').cpus();
  const loadAverage = require('os').loadavg();
  const totalMem = require('os').totalmem();
  const freeMem = require('os').freemem();
  const usedMem = totalMem - freeMem;

  // Get CPU usage (simplified calculation)
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - (idle / total) * 100;

  return {
    cpu: {
      usage: Math.round(usage * 100) / 100,
      loadAverage: loadAverage.map(load => Math.round(load * 100) / 100)
    },
    memory: {
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percentage: Math.round((usedMem / totalMem) * 10000) / 100
    },
    disk: {
      used: 0,
      total: 0,
      percentage: 0
    }
  };
}

// Get disk health metrics
async function getDiskHealth(): Promise<{
  used: number;
  total: number;
  percentage: number;
}> {
  try {
    const stats = await fs.stat(process.cwd());
    // This is a simplified disk check - in production, you might want to use df or a proper disk utility
    return {
      used: 0,
      total: 0,
      percentage: 0
    };
  } catch {
    return {
      used: 0,
      total: 0,
      percentage: 0
    };
  }
}

export default router;