/**
 * Secure Logging Utility
 * Prevents sensitive data leakage in logs
 */

import { createHash, randomBytes } from 'crypto';
import { config } from '../config/index.js';

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  context?: Record<string, any>;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  stack?: string;
}

interface SanitizedContext {
  [key: string]: any;
}

/**
 * Sensitive data patterns to redact from logs
 */
const SENSITIVE_PATTERNS = [
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },

  // Phone numbers
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },

  // Credit card numbers (basic pattern)
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[REDACTED_CARD]' },

  // Social Security Numbers
  { pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g, replacement: '[REDACTED_SSN]' },

  // API keys and tokens
  { pattern: /\b[A-Za-z0-9]{20,}\b/g, replacement: '[REDACTED_TOKEN]' },

  // Passwords in JSON
  { pattern: /"password"\s*:\s*"[^"]*"/gi, replacement: '"password":"[REDACTED]"' },

  // JWT tokens
  { pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: '[REDACTED_JWT]' },

  // AWS access keys
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED_AWS_KEY]' },

  // Database connection strings
  { pattern: /mongodb:\/\/[^@\s]+@[^\/\s]+/g, replacement: '[REDACTED_DB_URL]' },
  { pattern: /postgres:\/\/[^@\s]+@[^\/\s]+/g, replacement: '[REDACTED_DB_URL]' },
  { pattern: /mysql:\/\/[^@\s]+@[^\/\s]+/g, replacement: '[REDACTED_DB_URL]' },

  // Private keys
  { pattern: /-----BEGIN [A-Z]+ KEY-----[\s\S]*?-----END [A-Z]+ KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },

  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, replacement: 'Bearer [REDACTED_TOKEN]' },

  // Session IDs
  { pattern: /sid_[A-Za-z0-9]{32,}/g, replacement: '[REDACTED_SESSION]' },

  // UUIDs (unless in allowed list)
  { pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, replacement: '[REDACTED_UUID]' }
];

/**
 * Allowed fields that can contain UUIDs or similar identifiers
 */
const ALLOWED_ID_FIELDS = [
  'requestId',
  'correlationId',
  'traceId',
  'spanId',
  'transactionId',
  'sessionId'
];

/**
 * Hashes sensitive data for tracking purposes
 */
export const hashSensitiveData = (data: string): string => {
  return createHash('sha256').update(data).digest('hex').substring(0, 8);
};

/**
 * Sanitizes log data by redacting sensitive information
 */
export const sanitizeLogData = (data: any, fieldPath: string = ''): any => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    let sanitized = data;

    // Apply all sensitive patterns
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(data)) {
      const currentPath = fieldPath ? `${fieldPath}.${key}` : key;

      // Skip entire object if it's marked as sensitive
      if (key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('private') ||
          key.toLowerCase().includes('confidential')) {
        sanitized[key] = '[REDACTED_SENSITIVE_OBJECT]';
        continue;
      }

      // Allow certain ID fields
      if (ALLOWED_ID_FIELDS.includes(key)) {
        sanitized[key] = value;
        continue;
      }

      sanitized[key] = sanitizeLogData(value, currentPath);
    }

    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map((item, index) => sanitizeLogData(item, `${fieldPath}[${index}]`));
  }

  return data;
};

/**
 * Creates a sanitized context object for logging
 */
export const createSanitizedContext = (context?: Record<string, any>): SanitizedContext | undefined => {
  if (!context) {
    return undefined;
  }

  return sanitizeLogData(context) as SanitizedContext;
};

/**
 * Generates a secure request ID
 */
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${randomBytes(8).toString('hex')}`;
};

/**
 * Secure Logger Class
 */
export class SecureLogger {
  private requestId?: string;
  private userId?: string;
  private ip?: string;
  private userAgent?: string;

  constructor(requestId?: string, userId?: string, ip?: string, userAgent?: string) {
    this.requestId = requestId;
    this.userId = userId;
    this.ip = ip;
    this.userAgent = userAgent;
  }

  /**
   * Logs debug information
   */
  debug(message: string, context?: Record<string, any>): void {
    if (config.logLevel === 'debug') {
      this.log('debug', message, context);
    }
  }

  /**
   * Logs informational messages
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Logs warning messages
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Logs error messages
   */
  error(message: string, context?: Record<string, any>, error?: Error): void {
    const enhancedContext = {
      ...context,
      error: {
        message: error?.message,
        name: error?.name,
        stack: this.sanitizeStack(error?.stack)
      }
    };

    this.log('error', message, enhancedContext);
  }

  /**
   * Logs critical security events
   */
  critical(message: string, context?: Record<string, any>): void {
    this.log('critical', message, context);

    // In production, critical logs should be sent to security monitoring
    if (config.environment === 'production') {
      this.sendToSecurityMonitoring('critical', message, context);
    }
  }

  /**
   * Logs security events with enhanced tracking
   */
  security(eventType: string, message: string, context?: Record<string, any>): void {
    const securityContext = {
      eventType,
      ...context,
      timestamp: new Date().toISOString(),
      environment: config.environment
    };

    this.critical(`[SECURITY] ${message}`, securityContext);
  }

  /**
   * Creates a child logger with additional context
   */
  child(additionalContext: Record<string, any>): SecureLogger {
    const childLogger = new SecureLogger(this.requestId, this.userId, this.ip, this.userAgent);

    // Store additional context for later use
    (childLogger as any).additionalContext = additionalContext;

    return childLogger;
  }

  /**
   * Core logging method
   */
  private log(level: LogEntry['level'], message: string, context?: Record<string, any>): void {
    const sanitizedContext = createSanitizedContext({
      ...context,
      // Add any additional context from child logger
      ...(this as any).additionalContext
    });

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.sanitizeMessage(message),
      context: sanitizedContext,
      requestId: this.requestId,
      userId: this.userId ? hashSensitiveData(this.userId) : undefined,
      ip: this.ip ? this.hashSensitiveData(this.ip) : undefined,
      userAgent: this.userAgent ? this.truncateUserAgent(this.userAgent) : undefined
    };

    // Output to console (in production, this would go to a proper logging service)
    this.outputLog(logEntry);
  }

  /**
   * Sanitizes log messages
   */
  private sanitizeMessage(message: string): string {
    let sanitized = message;

    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  /**
   * Sanitizes stack traces
   */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) {
      return undefined;
    }

    // Remove sensitive file paths
    const sanitized = stack
      .replace(/\/home\/[^\/\s]+/g, '/home/[USER]')
      .replace(/\/Users\/[^\/\s]+/g, '/Users/[USER]')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]');

    return sanitized;
  }

  /**
   * Truncates user agent to reasonable length
   */
  private truncateUserAgent(userAgent: string): string {
    const maxLength = 200;
    return userAgent.length > maxLength ? userAgent.substring(0, maxLength) + '...' : userAgent;
  }

  /**
   * Outputs log entry
   */
  private outputLog(logEntry: LogEntry): void {
    const logOutput = {
      ...logEntry,
      // Add structured fields for log aggregation
      '@timestamp': logEntry.timestamp,
      '@level': logEntry.level.toUpperCase(),
      '@message': logEntry.message
    };

    // In development, use colored console output
    if (config.environment === 'development') {
      const colors = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
        critical: '\x1b[35m' // magenta
      };

      const reset = '\x1b[0m';
      const color = colors[logEntry.level] || '';

      console.log(`${color}[${logEntry.timestamp}] ${logEntry.level.toUpperCase()}: ${logEntry.message}${reset}`);

      if (logEntry.context) {
        console.log('Context:', JSON.stringify(logEntry.context, null, 2));
      }
    } else {
      // In production, use structured JSON logging
      console.log(JSON.stringify(logOutput));
    }
  }

  /**
   * Sends critical security events to monitoring
   */
  private sendToSecurityMonitoring(level: string, message: string, context?: Record<string, any>): void {
    // This would integrate with security monitoring services
    // For now, we'll just mark it for future implementation
    console.log(`[SECURITY_MONITORING] ${level}: ${message}`, context);
  }
}

/**
 * Default logger instance
 */
export const logger = new SecureLogger();

/**
 * Middleware to create request-scoped logger
 */
export const loggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  const userId = req.user?.id;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];

  // Create request-scoped logger
  req.logger = new SecureLogger(requestId, userId, ip, userAgent);

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Log request start
  req.logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: userAgent ? userAgent.substring(0, 100) : undefined
  });

  next();
};

/**
 * Extend Express Request type for logger
 */
declare global {
  namespace Express {
    interface Request {
      logger?: SecureLogger;
    }
  }
}

/**
 * Security event logger for audit trails
 */
export const securityLogger = {
  login: (userId: string, ip: string, success: boolean, userAgent?: string) => {
    logger.security('LOGIN', success ? 'User login successful' : 'User login failed', {
      userId: hashSensitiveData(userId),
      ip: hashSensitiveData(ip),
      success,
      userAgent: userAgent ? userAgent.substring(0, 100) : undefined
    });
  },

  logout: (userId: string, ip: string) => {
    logger.security('LOGOUT', 'User logout', {
      userId: hashSensitiveData(userId),
      ip: hashSensitiveData(ip)
    });
  },

  apiAccess: (userId: string, resource: string, action: string, ip: string, success: boolean) => {
    logger.security('API_ACCESS', `${success ? 'Authorized' : 'Unauthorized'} ${action} access to ${resource}`, {
      userId: hashSensitiveData(userId),
      resource,
      action,
      ip: hashSensitiveData(ip),
      success
    });
  },

  dataAccess: (userId: string, resource: string, operation: string, recordCount?: number) => {
    logger.security('DATA_ACCESS', `${operation} operation on ${resource}`, {
      userId: hashSensitiveData(userId),
      resource,
      operation,
      recordCount
    });
  },

  configurationChange: (userId: string, setting: string, oldValue?: any, newValue?: any) => {
    logger.security('CONFIG_CHANGE', `Configuration change for ${setting}`, {
      userId: hashSensitiveData(userId),
      setting,
      oldValue: oldValue ? '[CHANGED]' : undefined,
      newValue: newValue ? '[CHANGED]' : undefined
    });
  },

  suspiciousActivity: (description: string, context: Record<string, any>) => {
    logger.security('SUSPICIOUS_ACTIVITY', description, context);
  }
};