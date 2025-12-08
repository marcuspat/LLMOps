import express, { Application, Request, Response, NextFunction } from 'express';
import { BaseAPIService } from '../../shared/base-classes.js';
import {
  applySecurityMiddleware,
  authenticateToken,
  requirePermission,
  requireRole,
  rateLimit,
  securityHeaders
} from '../auth.js';
import { validateInput, validateBody, validateQuery, validateParams, commonSchemas } from '../input-validation.js';
import { secureCors, apiCors, publicCors, webSocketCors } from '../cors-security.js';
import { loggerMiddleware, logger, securityLogger } from '../../utils/secure-logger.js';

export interface MiddlewareConfig {
  enableSecurity?: boolean;
  enableLogging?: boolean;
  enableValidation?: boolean;
  enableRateLimiting?: boolean;
  customMiddleware?: express.RequestHandler[];
}

export class MiddlewareManager extends BaseAPIService {
  private app: Application;
  private config: MiddlewareConfig;

  constructor(app: Application, config: MiddlewareConfig = {}) {
    super();
    this.app = app;
    this.config = {
      enableSecurity: true,
      enableLogging: true,
      enableValidation: true,
      enableRateLimiting: true,
      ...config
    };
  }

  public setupMiddleware(): void {
    this.setupSecurityMiddleware();
    this.setupLoggingMiddleware();
    this.setupBodyParsingMiddleware();
    this.setupErrorHandlingMiddleware();
    this.setupCustomMiddleware();
  }

  private setupSecurityMiddleware(): void {
    if (!this.config.enableSecurity) return;

    // Apply comprehensive security middleware stack
    applySecurityMiddleware(this.app);

    if (this.config.enableRateLimiting) {
      this.app.use(rateLimit);
    }
  }

  private setupLoggingMiddleware(): void {
    if (!this.config.enableLogging) return;

    // Request logging middleware (after security but before routes)
    this.app.use(loggerMiddleware);
  }

  private setupBodyParsingMiddleware(): void {
    // Body parsing middleware with enhanced security
    this.app.use(express.json({
      limit: '10mb',
      strict: true
    }));

    this.app.use(express.urlencoded({
      extended: true,
      limit: '10mb',
      parameterLimit: 1000
    }));
  }

  private setupErrorHandlingMiddleware(): void {
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.handleError(err, 'Middleware error');

      if (req.logger) {
        req.logger.error('Unhandled error in middleware', {}, err);
      } else {
        logger.error('Unhandled error in middleware', {}, err);
      }

      // Don't expose error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(500).json(this.createErrorResponse(
        'INTERNAL_ERROR',
        isDevelopment ? err.message : 'Internal server error'
      ));
    });
  }

  private setupCustomMiddleware(): void {
    if (this.config.customMiddleware) {
      this.config.customMiddleware.forEach(middleware => {
        this.app.use(middleware);
      });
    }
  }

  public getCorsMiddleware(type: 'public' | 'api' | 'websocket' = 'api') {
    switch (type) {
      case 'public':
        return publicCors;
      case 'websocket':
        return webSocketCors;
      default:
        return apiCors;
    }
  }

  public getAuthMiddleware() {
    return authenticateToken;
  }

  public getPermissionMiddleware(permission: string) {
    return requirePermission(permission);
  }

  public getRoleMiddleware(role: string) {
    return requireRole(role);
  }

  public getValidationMiddleware(type: 'body' | 'query' | 'params', schema?: any) {
    switch (type) {
      case 'query':
        return validateQuery(schema || commonSchemas.dateRange);
      case 'params':
        return validateParams(schema || commonSchemas.idParam);
      case 'body':
      default:
        return validateBody(schema || commonSchemas.any);
    }
  }

  public createHealthCheckMiddleware(healthCheck?: () => Promise<any>) {
    return async (req: Request, res: Response) => {
      try {
        if (req.logger) {
          req.logger.info('Health check accessed', {
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
        }

        let healthData = {
          status: 'healthy',
          timestamp: new Date(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        };

        if (healthCheck) {
          const customHealth = await healthCheck();
          healthData = { ...healthData, ...customHealth };
        }

        res.json(this.createSuccessResponse(healthData));
      } catch (error) {
        this.handleError(error as Error, 'Health check failed');
        res.status(503).json(this.createErrorResponse('HEALTH_CHECK_ERROR', 'Service unavailable'));
      }
    };
  }
}