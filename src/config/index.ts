/**
 * Configuration Management for Turbo Flow Backend
 * Environment-based configuration with validation
 */

import { z } from 'zod';

// Configuration schema validation
const configSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.number().int().min(1).max(65535).default(3000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Truth Verification Configuration
  truthVerification: z.object({
    defaultThreshold: z.number().min(0).max(1).default(0.95),
    enableCaching: z.boolean().default(true),
    cacheTimeout: z.number().int().positive().default(300000), // 5 minutes
  }).default({}),

  // Agent Coordination Configuration
  agentCoordination: z.object({
    maxAgents: z.number().int().positive().default(50),
    defaultTopology: z.enum(['hierarchical', 'mesh', 'ring', 'star', 'adaptive']).default('mesh'),
    enableAutoScaling: z.boolean().default(true),
    resourceCheckInterval: z.number().int().positive().default(5000), // 5 seconds
  }).default({}),

  // GitHub Integration Configuration
  github: z.object({
    apiBaseUrl: z.string().url().default('https://api.github.com'),
    timeout: z.number().int().positive().default(30000), // 30 seconds
    rateLimitBuffer: z.number().int().positive().default(100),
  }).default({}),

  // Security Scanning Configuration
  security: z.object({
    enableRealTimeScanning: z.boolean().default(true),
    scanTimeout: z.number().int().positive().default(300000), // 5 minutes
    maxConcurrentScans: z.number().int().positive().default(5),
    vulnerabilityDatabaseUrl: z.string().url().optional(),
  }).default({}),

  // Performance Monitoring Configuration
  performance: z.object({
    metricsInterval: z.number().int().positive().default(5000), // 5 seconds
    retentionPeriod: z.number().int().positive().default(86400000), // 24 hours
    enableBenchmarks: z.boolean().default(true),
    alertThresholds: z.object({
      cpu: z.number().min(0).max(100).default(80),
      memory: z.number().min(0).max(100).default(85),
      responseTime: z.number().int().positive().default(5000), // 5 seconds
    }).default({}),
  }).default({}),

  // Database Configuration (if needed)
  database: z.object({
    url: z.string().optional(),
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    name: z.string().optional(),
    ssl: z.boolean().default(false),
  }).default({}),

  // Redis Configuration (for caching and session management)
  redis: z.object({
    url: z.string().optional(),
    host: z.string().default('localhost'),
    port: z.number().int().positive().default(6379),
    password: z.string().optional(),
    db: z.number().int().min(0).max(15).default(0),
  }).default({}),

  // Authentication Configuration - JWT Secret is required for security
  auth: z.object({
    jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
    jwtExpiration: z.string().default('24h'),
    bcryptRounds: z.number().int().min(10).max(15).default(12),
    sessionSecret: z.string().min(32).optional(),
  }).default({}),

  // CORS Configuration
  cors: z.object({
    origins: z.array(z.string().url()).default(['http://localhost:3000']),
    credentials: z.boolean().default(true),
    methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
    headers: z.array(z.string()).default(['Content-Type', 'Authorization']),
  }).default({}),

  // WebSocket Configuration
  websocket: z.object({
    heartbeatInterval: z.number().int().positive().default(30000), // 30 seconds
    maxConnections: z.number().int().positive().default(1000),
    messageSizeLimit: z.number().int().positive().default(1024 * 1024), // 1MB
    allowedOrigins: z.array(z.string().url()).default([]), // Must be explicitly set
    requireOrigin: z.boolean().default(true), // Always require origin validation
    enableCompression: z.boolean().default(false), // Disable for security
    verifyClient: z.boolean().default(true), // Always verify clients
  }).default({}),

  // Machine Learning Configuration
  ml: z.object({
    enabled: z.boolean().default(false),
    modelPath: z.string().optional(),
    trainingDataPath: z.string().optional(),
    apiEndpoint: z.string().url().optional(),
  }).default({}),
});

// Load environment variables
function loadEnvironmentConfig(): any {
  return {
    environment: process.env.NODE_ENV || process.env.ENVIRONMENT,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    logLevel: process.env.LOG_LEVEL,

    truthVerification: {
      defaultThreshold: process.env.TRUTH_THRESHOLD ? parseFloat(process.env.TRUTH_THRESHOLD) : undefined,
      enableCaching: process.env.ENABLE_TRUTH_CACHE ? process.env.ENABLE_TRUTH_CACHE === 'true' : undefined,
      cacheTimeout: process.env.TRUTH_CACHE_TIMEOUT ? parseInt(process.env.TRUTH_CACHE_TIMEOUT, 10) : undefined,
    },

    agentCoordination: {
      maxAgents: process.env.MAX_AGENTS ? parseInt(process.env.MAX_AGENTS, 10) : undefined,
      defaultTopology: process.env.DEFAULT_TOPOLOGY as any,
      enableAutoScaling: process.env.ENABLE_AUTO_SCALING ? process.env.ENABLE_AUTO_SCALING === 'true' : undefined,
      resourceCheckInterval: process.env.RESOURCE_CHECK_INTERVAL ? parseInt(process.env.RESOURCE_CHECK_INTERVAL, 10) : undefined,
    },

    github: {
      apiBaseUrl: process.env.GITHUB_API_BASE_URL,
      timeout: process.env.GITHUB_TIMEOUT ? parseInt(process.env.GITHUB_TIMEOUT, 10) : undefined,
      rateLimitBuffer: process.env.GITHUB_RATE_LIMIT_BUFFER ? parseInt(process.env.GITHUB_RATE_LIMIT_BUFFER, 10) : undefined,
    },

    security: {
      enableRealTimeScanning: process.env.ENABLE_REAL_TIME_SCANNING ? process.env.ENABLE_REAL_TIME_SCANNING === 'true' : undefined,
      scanTimeout: process.env.SCAN_TIMEOUT ? parseInt(process.env.SCAN_TIMEOUT, 10) : undefined,
      maxConcurrentScans: process.env.MAX_CONCURRENT_SCANS ? parseInt(process.env.MAX_CONCURRENT_SCANS, 10) : undefined,
      vulnerabilityDatabaseUrl: process.env.VULNERABILITY_DATABASE_URL,
    },

    performance: {
      metricsInterval: process.env.METRICS_INTERVAL ? parseInt(process.env.METRICS_INTERVAL, 10) : undefined,
      retentionPeriod: process.env.METRICS_RETENTION_PERIOD ? parseInt(process.env.METRICS_RETENTION_PERIOD, 10) : undefined,
      enableBenchmarks: process.env.ENABLE_BENCHMARKS ? process.env.ENABLE_BENCHMARKS === 'true' : undefined,
      alertThresholds: {
        cpu: process.env.CPU_ALERT_THRESHOLD ? parseFloat(process.env.CPU_ALERT_THRESHOLD) : undefined,
        memory: process.env.MEMORY_ALERT_THRESHOLD ? parseFloat(process.env.MEMORY_ALERT_THRESHOLD) : undefined,
        responseTime: process.env.RESPONSE_TIME_ALERT_THRESHOLD ? parseInt(process.env.RESPONSE_TIME_ALERT_THRESHOLD, 10) : undefined,
      },
    },

    database: {
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
      name: process.env.DB_NAME,
      ssl: process.env.DB_SSL ? process.env.DB_SSL === 'true' : undefined,
    },

    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
    },

    auth: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiration: process.env.JWT_EXPIRATION,
      bcryptRounds: process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS, 10) : undefined,
    },

    cors: {
      origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : undefined,
      credentials: process.env.CORS_CREDENTIALS ? process.env.CORS_CREDENTIALS === 'true' : undefined,
    },

    websocket: {
      heartbeatInterval: process.env.WS_HEARTBEAT_INTERVAL ? parseInt(process.env.WS_HEARTBEAT_INTERVAL, 10) : undefined,
      maxConnections: process.env.WS_MAX_CONNECTIONS ? parseInt(process.env.WS_MAX_CONNECTIONS, 10) : undefined,
      messageSizeLimit: process.env.WS_MESSAGE_SIZE_LIMIT ? parseInt(process.env.WS_MESSAGE_SIZE_LIMIT, 10) : undefined,
      allowedOrigins: process.env.WS_ALLOWED_ORIGINS ? process.env.WS_ALLOWED_ORIGINS.split(',') : undefined,
      requireOrigin: process.env.WS_REQUIRE_ORIGIN ? process.env.WS_REQUIRE_ORIGIN === 'true' : undefined,
      enableCompression: process.env.WS_ENABLE_COMPRESSION ? process.env.WS_ENABLE_COMPRESSION === 'true' : undefined,
      verifyClient: process.env.WS_VERIFY_CLIENT ? process.env.WS_VERIFY_CLIENT === 'true' : undefined,
    },

    ml: {
      enabled: process.env.ML_ENABLED ? process.env.ML_ENABLED === 'true' : undefined,
      modelPath: process.env.ML_MODEL_PATH,
      trainingDataPath: process.env.ML_TRAINING_DATA_PATH,
      apiEndpoint: process.env.ML_API_ENDPOINT,
    },
  };
}

// Validate and export configuration
function createConfig() {
  const envConfig = loadEnvironmentConfig();

  try {
    const config = configSchema.parse(envConfig);

    // CRITICAL: Security validation
    if (config.environment === 'production') {
      // JWT Secret must be set and strong in production
      if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
        throw new Error(
          'CRITICAL: JWT_SECRET must be set and be at least 32 characters in production'
        );
      }

      // WebSocket origins must be configured
      if (!config.websocket.allowedOrigins || config.websocket.allowedOrigins.length === 0) {
        throw new Error(
          'CRITICAL: WS_ALLOWED_ORIGINS must be configured with specific allowed origins'
        );
      }

      // CORS origins must be configured
      if (!config.cors.origins || config.cors.origins.length === 0) {
        throw new Error(
          'CRITICAL: CORS_ORIGINS must be configured with specific allowed origins'
        );
      }
    }

    // Log configuration (without sensitive data)
    console.log('📋 Configuration loaded successfully');
    console.log(`🌍 Environment: ${config.environment}`);
    console.log(`🚀 Port: ${config.port}`);
    console.log(`📊 Log Level: ${config.logLevel}`);
    console.log(`🔒 Security: JWT ${config.auth.jwtSecret ? 'configured' : 'NOT CONFIGURED'}`);
    console.log(`🌐 WebSocket Origins: ${config.websocket.allowedOrigins?.length || 0} configured`);

    return config;
  } catch (error) {
    console.error('❌ Configuration validation failed:', error);
    console.error('\n🚨 SECURITY ALERT: Invalid configuration detected.');
    console.error('Please check your environment variables and ensure all required security settings are configured.\n');
    throw error;
  }
}

// Export the validated configuration
export const config = createConfig();

// Configuration type for TypeScript
export type Config = z.infer<typeof configSchema>;

// Helper functions for getting specific configuration sections
export function getTruthVerificationConfig() {
  return config.truthVerification;
}

export function getAgentCoordinationConfig() {
  return config.agentCoordination;
}

export function getGitHubConfig() {
  return config.github;
}

export function getSecurityConfig() {
  return config.security;
}

export function getPerformanceConfig() {
  return config.performance;
}

export function getDatabaseConfig() {
  return config.database;
}

export function getRedisConfig() {
  return config.redis;
}

export function getAuthConfig() {
  return config.auth;
}

export function getCorsConfig() {
  return config.cors;
}

export function getWebSocketConfig() {
  return config.websocket;
}

export function getMLConfig() {
  return config.ml;
}

// Environment detection helpers
export function isDevelopment() {
  return config.environment === 'development';
}

export function isStaging() {
  return config.environment === 'staging';
}

export function isProduction() {
  return config.environment === 'production';
}

export function isTest() {
  return config.environment === 'test';
}

// Default configurations for different environments
export function getDefaultsForEnvironment(env: string) {
  switch (env) {
    case 'production':
      return {
        logLevel: 'info',
        enableDebugMode: false,
        enableStackTrace: false,
        enableDetailedLogs: false,
      };
    case 'staging':
      return {
        logLevel: 'debug',
        enableDebugMode: true,
        enableStackTrace: true,
        enableDetailedLogs: true,
      };
    case 'development':
    default:
      return {
        logLevel: 'debug',
        enableDebugMode: true,
        enableStackTrace: true,
        enableDetailedLogs: true,
      };
  }
}