import { Router, Request, Response } from 'express';
import { BaseAPIService } from '../../shared/base-classes.js';
import { MiddlewareManager } from '../middleware/MiddlewareManager.js';
import { TruthVerificationRouteHandler } from './TruthVerificationRouteHandler.js';
import { AgentCoordinationRouteHandler } from './AgentCoordinationRouteHandler.js';
import { GitHubIntegrationRouteHandler } from './GitHubIntegrationRouteHandler.js';
import { SecurityScanningRouteHandler } from './SecurityScanningRouteHandler.js';
import { PerformanceMonitoringRouteHandler } from './PerformanceMonitoringRouteHandler.js';
import { SystemRouteHandler } from './SystemRouteHandler.js';

interface CoreServices {
  truthVerification: any;
  agentCoordination: any;
  githubIntegration: any;
  securityScanning: any;
  performanceMonitoring: any;
}

export class RouteManager extends BaseAPIService {
  private middlewareManager: MiddlewareManager;
  private coreServices: CoreServices;
  private routeHandlers: Map<string, any> = new Map();

  constructor(middlewareManager: MiddlewareManager, coreServices: CoreServices) {
    super();
    this.middlewareManager = middlewareManager;
    this.coreServices = coreServices;
    this.initializeRouteHandlers();
  }

  public setupRoutes(app: any): void {
    // Health check endpoint (public, no auth required)
    app.get('/health',
      this.middlewareManager.getCorsMiddleware('public'),
      this.middlewareManager.getValidationMiddleware('query'),
      this.middlewareManager.createHealthCheckMiddleware()
    );

    // Authentication routes (public)
    this.setupAuthRoutes(app);

    // API Routes (all require authentication)
    this.setupAPIRoutes(app);

    // 404 handler
    app.use('*', (req: Request, res: Response) => {
      if (req.logger) {
        req.logger.warn('Route not found', {
          method: req.method,
          path: req.originalUrl,
          ip: req.ip
        });
      }

      res.status(404).json(this.createErrorResponse('NOT_FOUND',
        `Route ${req.method} ${req.originalUrl} not found`));
    });
  }

  private initializeRouteHandlers(): void {
    this.routeHandlers.set('truth', new TruthVerificationRouteHandler(
      this.coreServices.truthVerification,
      this.middlewareManager
    ));

    this.routeHandlers.set('agents', new AgentCoordinationRouteHandler(
      this.coreServices.agentCoordination,
      this.middlewareManager
    ));

    this.routeHandlers.set('github', new GitHubIntegrationRouteHandler(
      this.coreServices.githubIntegration,
      this.middlewareManager
    ));

    this.routeHandlers.set('security', new SecurityScanningRouteHandler(
      this.coreServices.securityScanning,
      this.middlewareManager
    ));

    this.routeHandlers.set('performance', new PerformanceMonitoringRouteHandler(
      this.coreServices.performanceMonitoring,
      this.middlewareManager
    ));

    this.routeHandlers.set('system', new SystemRouteHandler(this.middlewareManager));
  }

  private setupAuthRoutes(app: any): void {
    const publicCors = this.middlewareManager.getCorsMiddleware('public');

    // Login route
    app.post('/auth/login',
      publicCors,
      this.middlewareManager.getValidationMiddleware('body', this.getLoginSchema()),
      async (req: Request, res: Response) => {
        await this.handleAuthRequest('login', req, res);
      }
    );

    // Logout route (requires auth)
    app.post('/auth/logout',
      publicCors,
      this.middlewareManager.getAuthMiddleware(),
      async (req: Request, res: Response) => {
        await this.handleAuthRequest('logout', req, res);
      }
    );
  }

  private setupAPIRoutes(app: any): void {
    // Apply API-specific CORS and authentication to all API routes
    const apiCors = this.middlewareManager.getCorsMiddleware('api');
    const auth = this.middlewareManager.getAuthMiddleware();

    // Truth verification routes
    app.use('/api/truth', apiCors, auth,
      this.routeHandlers.get('truth')!.getRouter()
    );

    // Agent coordination routes
    app.use('/api/agents', apiCors, auth,
      this.routeHandlers.get('agents')!.getRouter()
    );

    // GitHub integration routes
    app.use('/api/github', apiCors, auth,
      this.routeHandlers.get('github')!.getRouter()
    );

    // Security scanning routes
    app.use('/api/security', apiCors, auth,
      this.routeHandlers.get('security')!.getRouter()
    );

    // Performance monitoring routes
    app.use('/api/performance', apiCors, auth,
      this.routeHandlers.get('performance')!.getRouter()
    );

    // System routes
    app.use('/api/system', apiCors, auth,
      this.routeHandlers.get('system')!.getRouter()
    );
  }

  private async handleAuthRequest(type: 'login' | 'logout', req: Request, res: Response): Promise<void> {
    try {
      const { result, error } = await this.handleRequest(async () => {
        // TODO: Implement actual authentication logic
        if (type === 'login') {
          // Login logic would go here
          return { message: 'Login endpoint - implementation needed' };
        } else {
          // Logout logic
          if (req.logger) {
            // securityLogger.logout(req.user!.id, req.ip || 'unknown');
          }
          return { message: 'Logged out successfully' };
        }
      }, 'AUTH_ERROR', `${type} failed`);

      if (result.success) {
        res.json(this.createSuccessResponse(result.data));
      } else {
        res.status(500).json(this.createErrorResponse(result.error.code, result.error.message));
      }
    } catch (error) {
      this.handleError(error as Error, `Auth ${type} error`);
      res.status(500).json(this.createErrorResponse('AUTH_ERROR', `${type} failed`));
    }
  }

  private getLoginSchema(): any {
    // Return Zod schema for login validation
    return {
      username: { type: 'string', min: 1, max: 100 },
      password: { type: 'string', min: 1, max: 500 },
      mfaToken: { type: 'string', optional: true }
    };
  }

  public getRouteHandler(name: string): any {
    return this.routeHandlers.get(name);
  }

  public getAllRouteHandlers(): Map<string, any> {
    return new Map(this.routeHandlers);
  }
}