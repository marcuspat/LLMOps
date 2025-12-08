/**
 * Security Hardening Middleware
 * Additional security layers for production deployment
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/secure-logger.js';

/**
 * Rate limiting with memory store
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
  lastAccess: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Enhanced rate limiting with progressive penalties
 */
export const enhancedRateLimit = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000
) => {
  // Clean up expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // New window or expired window
      record = {
        count: 1,
        resetTime: now + windowMs,
        lastAccess: now
      };
      rateLimitStore.set(key, record);
      return next();
    }

    // Increment counter
    record.count++;
    record.lastAccess = now;

    // Check if limit exceeded
    if (record.count > maxRequests) {
      const resetTime = Math.ceil((record.resetTime - now) / 1000);

      // Add progressive delay for repeated violations
      if (record.count > maxRequests * 2) {
        const delayMs = Math.min(record.count * 100, 5000);
        setTimeout(() => {
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests. Please try again later.',
              retryAfter: resetTime,
              retryAfterMs: resetTime * 1000,
              timestamp: new Date().toISOString()
            }
          });
        }, delayMs);
        return;
      }

      res.set('Retry-After', resetTime.toString());
      res.set('X-RateLimit-Limit', maxRequests.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', record.resetTime.toString());

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          retryAfter: resetTime,
          retryAfterMs: resetTime * 1000,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Add rate limit headers
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
    res.set('X-RateLimit-Reset', record.resetTime.toString());

    next();
  };
};

/**
 * Request Size Limiter with protection against large payloads
 */
export const requestSizeLimiter = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];

    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (size > maxSize) {
        logger.warn('Request size limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          size,
          maxSize
        });

        res.status(413).json({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request entity too large',
            maxSize: `${maxSize / 1024 / 1024}MB`,
            receivedSize: `${size / 1024 / 1024}MB`,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
    }

    next();
  };
};

/**
 * IP-based blocking for suspicious activity
 */
const blockedIPs = new Set<string>();
const suspiciousActivity = new Map<string, { count: number; lastActivity: number }>();

export const ipBlocker = () => {
  // Clean up old records
  setInterval(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [ip, activity] of suspiciousActivity.entries()) {
      if (now - activity.lastActivity > oneHour) {
        suspiciousActivity.delete(ip);
        blockedIPs.delete(ip);
      }
    }
  }, 10 * 60 * 1000); // Clean up every 10 minutes

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Check if IP is blocked
    if (blockedIPs.has(ip)) {
      logger.warn('Blocked IP attempted access', { ip });

      res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: 'Access denied',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Track suspicious activity
    const userAgent = req.get('User-Agent') || '';

    // Detect suspicious patterns
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /sqlmap/i,
      /nikto/i,
      /nmap/i
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));

    if (isSuspicious) {
      const activity = suspiciousActivity.get(ip) || { count: 0, lastActivity: 0 };
      activity.count++;
      activity.lastActivity = Date.now();
      suspiciousActivity.set(ip, activity);

      // Block after multiple suspicious requests
      if (activity.count > 10) {
        blockedIPs.add(ip);
        logger.warn('IP blocked due to suspicious activity', {
          ip,
          userAgent,
          count: activity.count
        });
      }
    }

    next();
  };
};

/**
 * HTTP Parameter Pollution Protection
 */
export const parameterPollutionProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Check for parameter pollution in query string
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value) && value.length > 1) {
        logger.warn('Parameter pollution attempt detected', {
          ip: req.ip,
          parameter: key,
          values: value
        });

        // Use only the first value
        req.query[key] = value[0];
      }
    }
  }

  // Check for parameter pollution in request body
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (Array.isArray(value) && value.length > 1) {
        logger.warn('Parameter pollution attempt in body', {
          ip: req.ip,
          parameter: key,
          values: value
        });

        // Use only the first value
        req.body[key] = value[0];
      }
    }
  }

  next();
};

/**
 * Content Type Validation
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];

      if (!contentType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CONTENT_TYPE',
            message: 'Content-Type header is required',
            allowedTypes,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const isAllowed = allowedTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()));

      if (!isAllowed) {
        logger.warn('Invalid content type', {
          ip: req.ip,
          contentType,
          allowedTypes
        });

        res.status(415).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Unsupported content type',
            contentType,
            allowedTypes,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
    }

    next();
  };
};

/**
 * Security Hardening Middleware Stack
 * Applies all security middleware in the correct order
 */
export const applySecurityHardening = (app: any): void => {
  // Apply IP blocking first
  app.use(ipBlocker());

  // Apply request size limiting
  app.use(requestSizeLimiter());

  // Apply enhanced rate limiting
  app.use(enhancedRateLimit(
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10)
  ));

  // Apply parameter pollution protection
  app.use(parameterPollutionProtection);

  // Apply content type validation
  app.use(validateContentType(['application/json', 'application/x-www-form-urlencoded']));

  logger.info('Security hardening middleware applied');
};