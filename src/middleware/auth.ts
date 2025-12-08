/**
 * Authentication and Authorization Middleware
 * Critical security middleware to protect API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthManager } from '../security/auth/AuthManager.js';
import { SecureAPIManager } from '../security/api/SecureAPIManager.js';
import { SecurityConfig } from '../security/core/SecurityConfig.js';

// Extend Express Request type for user authentication
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        roles: string[];
        permissions: string[];
      };
      sessionId?: string;
    }
  }
}

// Initialize security components - CRITICAL: JWT Secret must be set
if (!config.auth.jwtSecret) {
  throw new Error(
    'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. ' +
    'This is a production security vulnerability. Please set JWT_SECRET to a ' +
    'strong, randomly generated value of at least 32 characters.'
  );
}

const securityConfig: SecurityConfig = {
  environment: config.environment,
  jwtSecret: config.auth.jwtSecret, // No fallback - must be explicitly set
  tokenExpiry: 24,
  sessionTimeout: 60,
  maxLoginAttempts: 5,
  mfaRequired: config.environment === 'production',
  passwordPolicy: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },
  apiSecurity: {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100
    },
    inputValidation: {
      maxRequestBodySize: '10mb',
      allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded']
    }
  },
  encryptionSettings: {
    algorithm: 'aes-256-gcm',
    enableDataInTransitEncryption: true,
    enableDataAtRestEncryption: true
  }
};

const authManager = new AuthManager(securityConfig);
const apiSecurityManager = new SecureAPIManager(securityConfig, authManager, {} as any);

/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and sets user context
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Skip authentication for public paths
    const publicPaths = ['/health', '/api/health', '/login', '/register', '/public'];
    const path = req.path;

    if (publicPaths.some(publicPath => path.startsWith(publicPath))) {
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication token required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate JWT token
    const tokenValidation = await authManager.validateToken(token);

    if (!tokenValidation.valid) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: tokenValidation.reason || 'Invalid authentication token',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Set user context
    req.user = {
      id: tokenValidation.userId!,
      username: tokenValidation.userId, // Would need to fetch from user store
      roles: ['user'], // Would need to fetch from user store
      permissions: tokenValidation.permissions || []
    };

    req.sessionId = tokenValidation.sessionId;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed due to internal error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Authorization Middleware
 * Checks if user has required permissions
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Check if user has required permission
    const hasPermission = req.user.permissions.includes(permission) ||
                         req.user.permissions.includes('*') ||
                         req.user.roles.includes('admin');

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Required permission: ${permission}`,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
};

/**
 * Role-based Authorization Middleware
 */
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (!req.user.roles.includes(role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: `Required role: ${role}`,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
};

/**
 * API Security Middleware
 * Comprehensive security validation and protection
 */
export const apiSecurity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Create secure request wrapper
    const secureReq = {
      url: req.url,
      method: req.method,
      headers: req.headers as Record<string, string | undefined>,
      ip: req.ip,
      body: req.body,
      query: req.query
    };

    // Create secure response wrapper
    const secureRes = {
      statusCode: res.statusCode,
      headers: res.getHeaders() as Record<string, string>,
      json: (data: any) => {
        res.json(data);
      }
    };

    // Apply security checks
    await apiSecurityManager.secureEndpoint(secureReq, secureRes, () => {
      // Update request with user context if available
      if (req.user) {
        secureReq.user = {
          id: req.user.id,
          permissions: req.user.permissions
        };
      }

      next();
    });
  } catch (error) {
    console.error('API security error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SECURITY_ERROR',
        message: 'Security validation failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Rate Limiting Middleware
 */
export const rateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const requestRecord = requests.get(key);

    if (!requestRecord || now > requestRecord.resetTime) {
      requests.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (requestRecord.count >= maxRequests) {
      const resetTime = Math.ceil((requestRecord.resetTime - now) / 1000);
      res.set('Retry-After', resetTime.toString());

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: resetTime,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    requestRecord.count++;
    next();
  };
};

/**
 * Input Validation Middleware
 */
export const validateInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Validate request size
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (contentLength > maxSize) {
      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body too large',
          maxSize: `${maxSize / 1024 / 1024}MB`,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate content type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      const allowedTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data'
      ];

      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        res.status(415).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Unsupported content type',
            allowedTypes,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
    }

    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          // Basic XSS prevention
          req.query[key] = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        }
      }
    }

    next();
  } catch (error) {
    console.error('Input validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Security Headers Middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict-Transport-Security (HTTPS only in production)
  if (config.environment === 'production') {
    res.setHeader('Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy',
    'geolocation=(), ' +
    'microphone=(), ' +
    'camera=(), ' +
    'payment=(), ' +
    'usb=(), ' +
    'magnetometer=(), ' +
    'gyroscope=(), ' +
    'accelerometer=()'
  );

  // Remove server information
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Comprehensive Security Middleware Stack
 * Applies all security middleware in correct order
 */
export const applySecurityMiddleware = (app: any): void => {
  // Apply security headers first
  app.use(securityHeaders);

  // Apply rate limiting
  app.use(rateLimit());

  // Apply input validation
  app.use(validateInput);

  // Apply API security
  app.use(apiSecurity);

  // Apply authentication (except for public paths)
  app.use(authenticateToken);
};