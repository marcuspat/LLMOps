/**
 * Middleware Performance Optimizer
 * Optimizes Express.js middleware chain for maximum performance
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface MiddlewareMetrics {
  name: string;
  avgExecutionTime: number;
  cacheHitRate: number;
  optimizations: string[];
}

export class MiddlewareOptimizer {
  private middlewareMetrics: Map<string, MiddlewareMetrics> = new Map();
  private securityHeadersCache: any = null;
  private jwtCache: Map<string, { valid: boolean; userId?: string; expires: number }> = new Map();
  private rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    this.precomputeSecurityHeaders();
    this.setupCacheCleanup();
  }

  /**
   * Optimized security headers middleware with caching
   */
  public optimizedSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Use pre-computed headers to avoid repeated string concatenation
    if (!this.securityHeadersCache) {
      this.precomputeSecurityHeaders();
    }

    // Apply all headers in a single operation
    Object.entries(this.securityHeadersCache).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Remove server information
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');

    next();
  };

  /**
   * Optimized JWT authentication with caching
   */
  public optimizedAuthenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = performance.now();

    try {
      // Skip authentication for public paths (optimized with Set)
      const publicPaths = new Set(['/health', '/api/health', '/login', '/register', '/public']);
      if (publicPaths.has(req.path) || Array.from(publicPaths).some(path => req.path.startsWith(path))) {
        return next();
      }

      // Extract and validate token
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

      if (!token) {
        res.status(401).json(this.createErrorResponse('AUTH_REQUIRED', 'Authentication token required'));
        return;
      }

      // Check cache first
      const cached = this.jwtCache.get(token);
      if (cached && cached.expires > Date.now()) {
        if (cached.valid) {
          req.user = {
            id: cached.userId!,
            username: cached.userId,
            roles: ['user'],
            permissions: []
          };
          req.sessionId = 'cached-session';
          return next();
        } else {
          res.status(401).json(this.createErrorResponse('INVALID_TOKEN', 'Invalid authentication token'));
          return;
        }
      }

      // Simulate token validation (in production, would use actual JWT verification)
      const tokenValidation = await this.validateTokenOptimized(token);

      // Cache result for 5 minutes
      this.jwtCache.set(token, {
        valid: tokenValidation.valid,
        userId: tokenValidation.userId,
        expires: Date.now() + 300000
      });

      if (!tokenValidation.valid) {
        res.status(401).json(this.createErrorResponse('INVALID_TOKEN', tokenValidation.reason));
        return;
      }

      // Set user context
      req.user = {
        id: tokenValidation.userId!,
        username: tokenValidation.userId,
        roles: ['user'],
        permissions: tokenValidation.permissions || []
      };
      req.sessionId = tokenValidation.sessionId;

      const executionTime = performance.now() - startTime;
      this.recordMetrics('authenticateToken', executionTime);

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json(this.createErrorResponse('AUTH_ERROR', 'Authentication failed'));
    }
  };

  /**
   * Optimized rate limiting with sliding window
   */
  public optimizedRateLimit = (maxRequests: number = 100, windowMs: number = 900000) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      const requestRecord = this.rateLimitCache.get(key);

      if (!requestRecord || now > requestRecord.resetTime) {
        this.rateLimitCache.set(key, {
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
   * Optimized input validation with pre-processing
   */
  public optimizedValidateInput = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = performance.now();

    try {
      // Fast path: check content length first
      const contentLength = parseInt(req.headers['content-length'] || '0');
      if (contentLength > 10485760) { // 10MB
        res.status(413).json(this.createErrorResponse('PAYLOAD_TOO_LARGE', 'Request body too large'));
        return;
      }

      // Optimized content type check for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        const validTypes = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'];

        if (!contentType || !validTypes.some(type => contentType.includes(type))) {
          res.status(415).json(this.createErrorResponse('UNSUPPORTED_MEDIA_TYPE', 'Unsupported content type'));
          return;
        }
      }

      // Fast query parameter sanitization
      if (req.query) {
        const sanitizedQuery: Record<string, any> = {};
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            // Optimized regex for XSS prevention
            sanitizedQuery[key] = value
              .replace(/<script[^>]*>.*?<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '');
          } else {
            sanitizedQuery[key] = value;
          }
        }
        req.query = sanitizedQuery;
      }

      const executionTime = performance.now() - startTime;
      this.recordMetrics('validateInput', executionTime);

      next();
    } catch (error) {
      console.error('Input validation error:', error);
      res.status(500).json(this.createErrorResponse('VALIDATION_ERROR', 'Input validation failed'));
    }
  };

  /**
   * Pre-compute security headers to avoid repeated computation
   */
  private precomputeSecurityHeaders(): void {
    this.securityHeadersCache = {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    };
  }

  /**
   * Optimized token validation with caching
   */
  private async validateTokenOptimized(token: string): Promise<{ valid: boolean; userId?: string; reason?: string; permissions?: string[]; sessionId?: string }> {
    // Simulate token validation (in production, would use actual JWT verification)
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simple validation logic
        if (token.length < 10) {
          resolve({ valid: false, reason: 'Invalid token format' });
          return;
        }

        // Simulate successful validation
        resolve({
          valid: true,
          userId: 'user-' + Math.random().toString(36).substr(2, 9),
          permissions: ['read', 'write'],
          sessionId: 'session-' + Math.random().toString(36).substr(2, 9)
        });
      }, 1); // Simulate 1ms validation time
    });
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(code: string, message: string): any {
    return {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Record middleware performance metrics
   */
  private recordMetrics(name: string, executionTime: number): void {
    if (!this.middlewareMetrics.has(name)) {
      this.middlewareMetrics.set(name, {
        name,
        avgExecutionTime: 0,
        cacheHitRate: 0,
        optimizations: []
      });
    }

    const metrics = this.middlewareMetrics.get(name)!;
    metrics.avgExecutionTime = (metrics.avgExecutionTime + executionTime) / 2;
  }

  /**
   * Setup cache cleanup to prevent memory leaks
   */
  private setupCacheCleanup(): void {
    // Clean JWT cache every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [token, data] of this.jwtCache.entries()) {
        if (data.expires < now) {
          this.jwtCache.delete(token);
        }
      }
    }, 300000);

    // Clean rate limit cache every 15 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.rateLimitCache.entries()) {
        if (data.resetTime < now) {
          this.rateLimitCache.delete(key);
        }
      }
    }, 900000);
  }

  /**
   * Get middleware performance metrics
   */
  public getMetrics(): Map<string, MiddlewareMetrics> {
    return this.middlewareMetrics;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): any {
    return {
      jwtCacheSize: this.jwtCache.size,
      rateLimitCacheSize: this.rateLimitCache.size,
      securityHeadersCached: !!this.securityHeadersCache
    };
  }
}