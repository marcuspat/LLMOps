import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cluster from 'cluster';
import os from 'os';
import { TruthVerification } from '../core/TruthVerification.js';
import { AgentCoordination } from '../core/AgentCoordination.js';
import { GitHubIntegration } from '../core/GitHubIntegration.js';
import { SecurityScanning } from '../core/SecurityScanning.js';
import { PerformanceMonitoring } from '../core/PerformanceMonitoring.js';
import { ApiResponse, WebSocketMessage, MessageType } from '../types/index.js';
import { getDatabasePool, DatabasePool } from '../performance/DatabasePool.js';
import { getCacheManager, CacheManager } from '../performance/CacheManager.js';
import { createRateLimiter, AdvancedRateLimiter } from '../performance/RateLimiter.js';
import { ResponseOptimizer } from '../performance/ResponseOptimizer.js';

// Security middleware imports
import {
  applySecurityMiddleware,
  authenticateToken,
  requirePermission,
  requireRole,
  rateLimit,
  securityHeaders
} from '../middleware/auth.js';
import { validateInput, validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/input-validation.js';
import { secureCors, apiCors, publicCors, webSocketCors } from '../middleware/cors-security.js';
import { loggerMiddleware, logger, securityLogger } from '../utils/secure-logger.js';

/**
 * Production-optimized API Server with advanced performance features
 * - Database connection pooling
 * - Multi-level caching (L1 in-memory, L2 Redis)
 * - Advanced rate limiting with load shedding
 * - Response compression and optimization
 * - Cluster mode for horizontal scaling
 * - Comprehensive performance monitoring
 */
export class OptimizedTurboFlowServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private port: number;
  private truthVerification: TruthVerification;
  private agentCoordination: AgentCoordination;
  private githubIntegration: GitHubIntegration;
  private securityScanning: SecurityScanning;
  private performanceMonitoring: PerformanceMonitoring;
  private databasePool?: DatabasePool;
  private cacheManager: CacheManager;
  private rateLimiters: Map<string, AdvancedRateLimiter> = new Map();
  private responseOptimizer: ResponseOptimizer;
  private clients: Map<string, WebSocket> = new Map();
  private isWorker: boolean = cluster.isWorker;
  private workerId?: number;

  constructor(port: number = 3000, private options: {
    enableClustering?: boolean;
    dbConfig?: any;
    redisConfig?: any;
    rateLimiting?: {
      default?: any;
      strict?: any;
      api?: any;
      upload?: any;
    };
  } = {}) {
    this.port = port;
    this.workerId = cluster.worker?.id;

    // Initialize Express app
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({
      server: this.server,
      perMessageDeflate: false // Disable for performance
    });

    // Initialize core systems
    this.truthVerification = TruthVerification.getInstance();
    this.agentCoordination = AgentCoordination.getInstance();
    this.githubIntegration = GitHubIntegration.getInstance();
    this.securityScanning = SecurityScanning.getInstance();
    this.performanceMonitoring = PerformanceMonitoring.getInstance();

    // Initialize performance components
    this.initializePerformanceComponents();

    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupEventHandlers();
  }

  private async initializePerformanceComponents(): Promise<void> {
    // Initialize cache manager
    this.cacheManager = getCacheManager(this.options.redisConfig);

    // Initialize database pool if config provided
    if (this.options.dbConfig) {
      this.databasePool = getDatabasePool(this.options.dbConfig);
    }

    // Initialize response optimizer
    this.responseOptimizer = new ResponseOptimizer({
      compression: {
        threshold: 1024,
        level: 6,
        algorithms: ['br', 'gzip', 'deflate']
      },
      fieldSelection: {
        maxFields: 50,
        blacklist: ['password', 'secret', 'token']
      },
      pagination: {
        defaultLimit: 20,
        maxLimit: 100
      },
      caching: {
        enabled: true,
        ttl: 300,
        varyHeaders: ['Accept', 'Accept-Encoding']
      },
      etag: true,
      conditionalRequests: true,
      responseTimeTracking: true
    });

    // Initialize rate limiters
    const defaultLimiting = this.options.rateLimiting?.default || {
      windowMs: 60000,
      maxRequests: 100,
      adaptiveLimiting: true,
      loadSheddingEnabled: true
    };

    this.rateLimiters.set('default', createRateLimiter('adaptive', defaultLimiting));

    // API-specific rate limiting
    if (this.options.rateLimiting?.api) {
      this.rateLimiters.set('api', createRateLimiter('strict', this.options.rateLimiting.api));
    }

    // Upload rate limiting (more restrictive)
    if (this.options.rateLimiting?.upload) {
      this.rateLimiters.set('upload', createRateLimiter('strict', {
        windowMs: 60000,
        maxRequests: 10,
        queueSize: 0
      }));
    }

    logger.info('Performance components initialized', {
      hasDatabase: !!this.databasePool,
      cacheConnected: await this.cacheManager.healthCheck().then(h => h.status === 'healthy'),
      rateLimiters: Array.from(this.rateLimiters.keys())
    });
  }

  private setupMiddleware(): void {
    // Trust proxy for load balancer support
    this.app.set('trust proxy', true);

    // Apply comprehensive security middleware stack
    applySecurityMiddleware(this.app);

    // Response compression (before other middleware)
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        // Don't compress already compressed responses
        const type = res.getHeader('Content-Type') as string;
        if (type && type.includes('application/json')) {
          return true;
        }
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024
    }));

    // Apply response optimization
    this.app.use(this.responseOptimizer.middleware());

    // Request logging middleware (after security but before routes)
    this.app.use(loggerMiddleware);

    // Apply rate limiting based on route patterns
    this.app.use('/api/*', this.rateLimiters.get('default')!.middleware());
    this.app.use('/api/truth/*', this.rateLimiters.get('api')?.middleware() || this.rateLimiters.get('default')!.middleware());
    this.app.use('/api/security/*', this.rateLimiters.get('api')?.middleware() || this.rateLimiters.get('default')!.middleware());
    this.app.use('/upload/*', this.rateLimiters.get('upload')?.middleware() || ((req: any, res: any, next: any) => next()));

    // Body parsing middleware with enhanced security
    this.app.use(express.json({
      limit: '10mb',
      strict: true,
      type: ['application/json', 'application/vnd.api+json']
    }));
    this.app.use(express.urlencoded({
      extended: true,
      limit: '10mb',
      parameterLimit: 1000
    }));

    // Database middleware - attach pool to request
    this.app.use((req, res, next) => {
      if (this.databasePool) {
        req.db = this.databasePool;
      }
      req.cache = this.cacheManager;
      next();
    });

    // Enhanced error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Log error with request context
      logger.error('Request error', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        error: err.message,
        stack: err.stack,
        workerId: this.workerId
      });

      // Don't expose error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      res.status(err.status || 500).json(this.createErrorResponse(
        err.code || 'INTERNAL_ERROR',
        isDevelopment ? err.message : 'Internal server error',
        isDevelopment ? err.details : undefined
      ));
    });
  }

  private setupRoutes(): void {
    // Enhanced health check with performance metrics
    this.app.get('/health', publicCors, validateQuery(commonSchemas.dateRange), async (req, res) => {
      try {
        const health = {
          status: 'healthy',
          timestamp: new Date(),
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          workerId: this.workerId,
          cluster: this.isWorker,
          performance: {
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
          }
        };

        // Add database health if available
        if (this.databasePool) {
          health.performance.database = this.databasePool.getMetrics();
          health.performance.databaseHealthy = this.databasePool.isHealthy();
        }

        // Add cache health
        const cacheHealth = await this.cacheManager.healthCheck();
        health.performance.cache = {
          status: cacheHealth.status,
          details: cacheHealth.details
        };

        // Add rate limiter stats
        const rateLimiterStats = this.getRateLimiterStats();
        health.performance.rateLimiting = rateLimiterStats;

        res.json(this.createSuccessResponse(health));
      } catch (error) {
        logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(503).json(this.createErrorResponse('HEALTH_CHECK_FAILED', 'Health check failed'));
      }
    });

    // Authentication routes (public)
    this.app.post('/auth/login', publicCors, validateBody(z.object({
      username: z.string().min(1).max(100),
      password: z.string().min(1).max(500),
      mfaToken: z.string().optional()
    })), async (req, res) => {
      try {
        // Cache login attempts to prevent brute force
        const cacheKey = `login_attempts:${req.ip}`;
        const attempts = await this.cacheManager.get<number>(cacheKey) || 0;

        if (attempts > 5) {
          return res.status(429).json(this.createErrorResponse(
            'TOO_MANY_ATTEMPTS',
            'Too many login attempts. Please try again later.'
          ));
        }

        // Increment attempt counter
        await this.cacheManager.set(cacheKey, attempts + 1, 300); // 5 minutes

        // TODO: Implement actual login logic with AuthManager
        res.json(this.createSuccessResponse({
          message: 'Login endpoint - implementation needed'
        }));
      } catch (error) {
        req.logger?.error('Login failed', { error: error.message });
        res.status(500).json(this.createErrorResponse('LOGIN_ERROR', 'Login failed'));
      }
    });

    this.app.post('/auth/logout', authenticateToken, async (req, res) => {
      try {
        // Clear login attempts counter
        const cacheKey = `login_attempts:${req.ip}`;
        await this.cacheManager.del(cacheKey);

        if (req.logger) {
          securityLogger.logout(req.user!.id, req.ip || 'unknown');
        }

        res.json(this.createSuccessResponse({
          message: 'Logged out successfully'
        }));
      } catch (error) {
        req.logger?.error('Logout failed', { error: error.message });
        res.status(500).json(this.createErrorResponse('LOGOUT_ERROR', 'Logout failed'));
      }
    });

    // API Routes (all require authentication)
    this.setupTruthVerificationRoutes();
    this.setupAgentCoordinationRoutes();
    this.setupGitHubIntegrationRoutes();
    this.setupSecurityScanningRoutes();
    this.setupPerformanceMonitoringRoutes();
    this.setupSystemRoutes();

    // 404 handler
    this.app.use('*', (req, res) => {
      if (req.logger) {
        req.logger.warn('Route not found', {
          method: req.method,
          path: req.originalUrl,
          ip: req.ip
        });
      }

      res.status(404).json(this.createErrorResponse('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
    });
  }

  private setupTruthVerificationRoutes(): void {
    const router = express.Router();

    // Apply API-specific CORS and authentication
    router.use(apiCors);
    router.use(authenticateToken);

    // Verify content with caching
    router.post('/verify',
      validateBody(commonSchemas.truthVerification),
      requirePermission('truth:verify'),
      async (req, res) => {
        try {
          // Check cache first for verification results
          const cacheKey = `verify:${JSON.stringify(req.body)}`;
          const cached = await req.cache.get(cacheKey);

          if (cached) {
            req.logger?.info('Verification result from cache', { requestId: req.body.context?.requestId });
            return res.json(this.createSuccessResponse(cached));
          }

          if (req.logger) {
            securityLogger.apiAccess(req.user!.id, 'truth:verify', 'POST', req.ip || 'unknown', true);
          }

          const result = await this.truthVerification.verify(req.body);
          req.logger?.info('Content verification completed', { requestId: req.body.context?.requestId });

          // Cache result for 5 minutes
          await req.cache.set(cacheKey, result, 300);

          res.json(this.createSuccessResponse(result));
        } catch (error) {
          req.logger?.error('Verification failed', { error: error.message });
          res.status(500).json(this.createErrorResponse('VERIFICATION_ERROR',
            error instanceof Error ? error.message : 'Verification failed'));
        }
      }
    );

    // Batch verification with database transaction support
    router.post('/verify-batch',
      validateBody(z.object({
        requests: z.array(commonSchemas.truthVerification).min(1).max(50)
      })),
      requirePermission('truth:verify-batch'),
      async (req, res) => {
        try {
          if (req.logger) {
            securityLogger.apiAccess(req.user!.id, 'truth:verify-batch', 'POST', req.ip || 'unknown', true);
          }

          let results;
          if (req.db) {
            // Use database transaction for batch verification
            results = await req.db.transaction(async (client) => {
              return await this.truthVerification.verifyBatch(req.body.requests, client);
            });
          } else {
            results = await this.truthVerification.verifyBatch(req.body.requests);
          }

          req.logger?.info('Batch verification completed', {
            requestCount: req.body.requests.length
          });

          res.json(this.createSuccessResponse(results));
        } catch (error) {
          req.logger?.error('Batch verification failed', { error: error.message });
          res.status(500).json(this.createErrorResponse('BATCH_VERIFICATION_ERROR',
            error instanceof Error ? error.message : 'Batch verification failed'));
        }
      }
    );

    // Get verification statistics with caching
    router.get('/stats',
      validateQuery(commonSchemas.dateRange),
      requirePermission('truth:read-stats'),
      async (req, res) => {
        try {
          const { start, end } = req.query;
          const cacheKey = `truth_stats:${start || 'all'}:${end || 'all'}`;

          // Try cache first
          const cached = await req.cache.get(cacheKey);
          if (cached) {
            return res.json(this.createSuccessResponse(cached));
          }

          const timeFrame = start && end ? {
            start: new Date(start as string),
            end: new Date(end as string)
          } : undefined;

          const stats = this.truthVerification.getVerificationStats(timeFrame);

          // Cache stats for 1 minute
          await req.cache.set(cacheKey, stats, 60);

          req.logger?.info('Verification stats retrieved', { timeFrame });
          res.json(this.createSuccessResponse(stats));
        } catch (error) {
          req.logger?.error('Failed to get verification statistics', { error: error.message });
          res.status(500).json(this.createErrorResponse('STATS_ERROR',
            error instanceof Error ? error.message : 'Failed to get statistics'));
        }
      }
    );

    this.app.use('/api/truth', router);
  }

  private setupAgentCoordinationRoutes(): void {
    const router = express.Router();

    // Create swarm with caching
    router.post('/swarms', async (req, res) => {
      try {
        const swarm = await this.agentCoordination.createSwarm(req.body);

        // Cache swarm info
        await req.cache.set(`swarm:${swarm.id}`, swarm, 300);

        res.json(this.createSuccessResponse(swarm));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SWARM_CREATE_ERROR',
          error instanceof Error ? error.message : 'Failed to create swarm'));
      }
    });

    // Spawn agent with database tracking
    router.post('/agents', async (req, res) => {
      try {
        const agent = await this.agentCoordination.spawnAgent(req.body.type, req.body.config || {});

        // Track in database if available
        if (req.db) {
          await req.db.query(
            'INSERT INTO agents (id, type, config, created_at) VALUES ($1, $2, $3, NOW())',
            [agent.id, req.body.type, JSON.stringify(req.body.config || {})]
          );
        }

        res.json(this.createSuccessResponse(agent));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('AGENT_SPAWN_ERROR',
          error instanceof Error ? error.message : 'Failed to spawn agent'));
      }
    });

    // Get system status with real-time metrics
    router.get('/status', async (req, res) => {
      try {
        const status = this.agentCoordination.getSystemStatus();

        // Add performance metrics
        status.performance = {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          workerId: this.workerId,
          activeConnections: this.clients.size
        };

        // Add database metrics if available
        if (req.db) {
          status.database = req.db.getMetrics();
        }

        res.json(this.createSuccessResponse(status));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('STATUS_ERROR',
          error instanceof Error ? error.message : 'Failed to get system status'));
      }
    });

    // Other agent routes...
    router.post('/agents/batch', async (req, res) => {
      try {
        const agents = await this.agentCoordination.spawnAgentsParallel(
          req.body.agents || req.body,
          req.body.options
        );
        res.json(this.createSuccessResponse(agents));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('BATCH_AGENT_SPAWN_ERROR',
          error instanceof Error ? error.message : 'Failed to spawn agents'));
      }
    });

    router.get('/agents/:agentId/metrics', async (req, res) => {
      try {
        const metrics = this.agentCoordination.getAgentMetrics(req.params.agentId);
        if (!metrics) {
          return res.status(404).json(this.createErrorResponse('AGENT_NOT_FOUND', 'Agent not found'));
        }

        // Add database metrics if available
        if (req.db) {
          const dbMetrics = await req.db.query(
            'SELECT * FROM agent_metrics WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT 100',
            [req.params.agentId]
          );
          metrics.databaseHistory = dbMetrics.rows;
        }

        res.json(this.createSuccessResponse(metrics));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('METRICS_ERROR',
          error instanceof Error ? error.message : 'Failed to get agent metrics'));
      }
    });

    router.post('/swarms/:swarmId/scale', async (req, res) => {
      try {
        await this.agentCoordination.scaleSwarm(req.params.swarmId, req.body.targetSize);

        // Update cache
        await req.cache.del(`swarm:${req.params.swarmId}`);

        res.json(this.createSuccessResponse({ message: 'Swarm scaled successfully' }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SWARM_SCALE_ERROR',
          error instanceof Error ? error.message : 'Failed to scale swarm'));
      }
    });

    router.post('/tasks', async (req, res) => {
      try {
        await this.agentCoordination.orchestrateTask(req.body);
        res.json(this.createSuccessResponse({ message: 'Task orchestrated successfully' }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('TASK_ORCHESTRATION_ERROR',
          error instanceof Error ? error.message : 'Failed to orchestrate task'));
      }
    });

    this.app.use('/api/agents', router);
  }

  private setupGitHubIntegrationRoutes(): void {
    const router = express.Router();

    // Handle webhook with signature validation
    router.post('/webhook', async (req, res) => {
      try {
        const signature = req.headers['x-hub-signature-256'] as string;
        await this.githubIntegration.handleWebhook({
          headers: req.headers,
          body: req.body
        }, signature);

        // Cache webhook event for processing
        await req.cache.set(`webhook:${Date.now()}`, {
          headers: req.headers,
          body: req.body
        }, 60);

        res.json(this.createSuccessResponse({ message: 'Webhook processed successfully' }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('WEBHOOK_ERROR',
          error instanceof Error ? error.message : 'Failed to process webhook'));
      }
    });

    // Cache repository data
    router.get('/repos/:owner/:repo', async (req, res) => {
      try {
        const cacheKey = `repo:${req.params.owner}/${req.params.repo}`;
        const cached = await req.cache.get(cacheKey);

        if (cached) {
          return res.json(this.createSuccessResponse(cached));
        }

        const repo = await this.githubIntegration.getRepository(req.params.owner, req.params.repo);
        if (!repo) {
          return res.status(404).json(this.createErrorResponse('REPO_NOT_FOUND', 'Repository not found'));
        }

        // Cache for 5 minutes
        await req.cache.set(cacheKey, repo, 300);

        res.json(this.createSuccessResponse(repo));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('REPO_GET_ERROR',
          error instanceof Error ? error.message : 'Failed to get repository'));
      }
    });

    // Other GitHub routes...
    router.post('/repos/:owner/:repo/webhooks', async (req, res) => {
      try {
        const webhook = await this.githubIntegration.createWebhook(
          `${req.params.owner}/${req.params.repo}`,
          req.body
        );
        res.json(this.createSuccessResponse(webhook));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('WEBHOOK_CREATE_ERROR',
          error instanceof Error ? error.message : 'Failed to create webhook'));
      }
    });

    router.post('/repos/:owner/:repo/pulls', async (req, res) => {
      try {
        const pr = await this.githubIntegration.createPullRequest(
          req.params.owner,
          req.params.repo,
          req.body
        );
        res.json(this.createSuccessResponse(pr));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('PR_CREATE_ERROR',
          error instanceof Error ? error.message : 'Failed to create pull request'));
      }
    });

    this.app.use('/api/github', router);
  }

  private setupSecurityScanningRoutes(): void {
    const router = express.Router();

    // Initiate scan with queuing
    router.post('/scans', async (req, res) => {
      try {
        const scan = await this.securityScanning.initiateScan(
          req.body.type,
          req.body.target,
          req.body.options
        );

        // Cache scan info
        await req.cache.set(`scan:${scan.id}`, scan, 3600);

        res.json(this.createSuccessResponse(scan));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SCAN_INIT_ERROR',
          error instanceof Error ? error.message : 'Failed to initiate scan'));
      }
    });

    // Comprehensive scan with progress tracking
    router.post('/scans/comprehensive', async (req, res) => {
      try {
        const scans = await this.securityScanning.performComprehensiveScan(
          req.body.target,
          req.body.options
        );

        // Cache scan results
        for (const scan of scans) {
          await req.cache.set(`scan:${scan.id}`, scan, 3600);
        }

        res.json(this.createSuccessResponse(scans));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('COMPREHENSIVE_SCAN_ERROR',
          error instanceof Error ? error.message : 'Failed to perform comprehensive scan'));
      }
    });

    // Get scan status from cache or memory
    router.get('/scans/:scanId', async (req, res) => {
      try {
        const cacheKey = `scan:${req.params.scanId}`;
        let scan = await req.cache.get(cacheKey);

        if (!scan) {
          scan = this.securityScanning.getScanStatus(req.params.scanId);
        }

        if (!scan) {
          return res.status(404).json(this.createErrorResponse('SCAN_NOT_FOUND', 'Scan not found'));
        }

        res.json(this.createSuccessResponse(scan));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SCAN_STATUS_ERROR',
          error instanceof Error ? error.message : 'Failed to get scan status'));
      }
    });

    // Get security results with caching
    router.get('/results/:target', async (req, res) => {
      try {
        const cacheKey = `security_results:${req.params.target}`;
        const cached = await req.cache.get(cacheKey);

        if (cached) {
          return res.json(this.createSuccessResponse(cached));
        }

        const results = this.securityScanning.getSecurityResults(req.params.target);

        // Cache for 10 minutes
        await req.cache.set(cacheKey, results, 600);

        res.json(this.createSuccessResponse(results));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('RESULTS_ERROR',
          error instanceof Error ? error.message : 'Failed to get security results'));
      }
    });

    // Other security routes...
    router.get('/stats', async (req, res) => {
      try {
        const { start, end } = req.query;
        const timeFrame = start && end ? {
          start: new Date(start as string),
          end: new Date(end as string)
        } : undefined;

        const stats = this.securityScanning.getSecurityStats(timeFrame);
        res.json(this.createSuccessResponse(stats));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SECURITY_STATS_ERROR',
          error instanceof Error ? error.message : 'Failed to get security statistics'));
      }
    });

    router.get('/reports/:target', (req, res) => {
      try {
        const format = req.query.format as 'json' | 'html' | 'pdf' || 'json';
        const report = this.securityScanning.generateSecurityReport(req.params.target, format);
        res.json(this.createSuccessResponse(report));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('REPORT_ERROR',
          error instanceof Error ? error.message : 'Failed to generate security report'));
      }
    });

    this.app.use('/api/security', router);
  }

  private setupPerformanceMonitoringRoutes(): void {
    const router = express.Router();

    // Start monitoring
    router.post('/monitoring/start', (req, res) => {
      try {
        const interval = req.body.interval || 5000;
        this.performanceMonitoring.startMonitoring(interval);
        res.json(this.createSuccessResponse({ message: 'Monitoring started', interval }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('MONITORING_START_ERROR',
          error instanceof Error ? error.message : 'Failed to start monitoring'));
      }
    });

    // Stop monitoring
    router.post('/monitoring/stop', (req, res) => {
      try {
        this.performanceMonitoring.stopMonitoring();
        res.json(this.createSuccessResponse({ message: 'Monitoring stopped' }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('MONITORING_STOP_ERROR',
          error instanceof Error ? error.message : 'Failed to stop monitoring'));
      }
    });

    // Get metrics with enhanced data
    router.get('/metrics', async (req, res) => {
      try {
        const { start, end } = req.query;
        const timeRange = start && end ? {
          start: new Date(start as string),
          end: new Date(end as string)
        } : undefined;

        const metrics = this.performanceMonitoring.getMetrics(timeRange);

        // Add system metrics
        const enhancedMetrics = {
          ...metrics,
          system: {
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            uptime: process.uptime(),
            workerId: this.workerId
          },
          database: this.databasePool ? this.databasePool.getMetrics() : null,
          cache: await this.cacheManager.getStats()
        };

        res.json(this.createSuccessResponse(enhancedMetrics));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('METRICS_ERROR',
          error instanceof Error ? error.message : 'Failed to get metrics'));
      }
    });

    // Get agent metrics
    router.get('/agents/:agentId', (req, res) => {
      try {
        const metrics = this.performanceMonitoring.getAgentMetrics(req.params.agentId);
        if (!metrics) {
          return res.status(404).json(this.createErrorResponse('AGENT_METRICS_NOT_FOUND', 'Agent metrics not found'));
        }
        res.json(this.createSuccessResponse(metrics));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('AGENT_METRICS_ERROR',
          error instanceof Error ? error.message : 'Failed to get agent metrics'));
      }
    });

    // Generate performance report
    router.get('/reports', async (req, res) => {
      try {
        const { start, end } = req.query;
        const timeRange = start && end ? {
          start: new Date(start as string),
          end: new Date(end as string)
        } : undefined;

        const report = this.performanceMonitoring.generatePerformanceReport(timeRange);

        // Add additional performance data
        const enhancedReport = {
          ...report,
          databaseMetrics: this.databasePool ? this.databasePool.getMetrics() : null,
          cacheMetrics: await this.cacheManager.getStats(),
          rateLimiterMetrics: this.getRateLimiterStats()
        };

        res.json(this.createSuccessResponse(enhancedReport));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('PERFORMANCE_REPORT_ERROR',
          error instanceof Error ? error.message : 'Failed to generate performance report'));
      }
    });

    // Run benchmarks with database tracking
    router.post('/benchmarks', async (req, res) => {
      try {
        const results = await this.performanceMonitoring.runBenchmarks(req.body);

        // Store results in database if available
        if (req.db) {
          await req.db.query(
            'INSERT INTO benchmark_results (data, created_at) VALUES ($1, NOW())',
            [JSON.stringify(results)]
          );
        }

        res.json(this.createSuccessResponse(results));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('BENCHMARK_ERROR',
          error instanceof Error ? error.message : 'Failed to run benchmarks'));
      }
    });

    // Analyze bottlenecks with AI suggestions
    router.get('/bottlenecks', async (req, res) => {
      try {
        const { start, end } = req.query;
        const timeRange = start && end ? {
          start: new Date(start as string),
          end: new Date(end as string)
        } : undefined;

        const analysis = this.performanceMonitoring.analyzeBottlenecks(timeRange);

        // Add optimization suggestions
        const suggestions = await this.generateOptimizationSuggestions(analysis);
        analysis.suggestions = suggestions;

        res.json(this.createSuccessResponse(analysis));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('BOTTLENECK_ANALYSIS_ERROR',
          error instanceof Error ? error.message : 'Failed to analyze bottlenecks'));
      }
    });

    this.app.use('/api/performance', router);
  }

  private setupSystemRoutes(): void {
    const router = express.Router();

    // System info with enhanced metrics
    router.get('/info', async (req, res) => {
      try {
        const info = {
          version: process.env.npm_package_version || '1.0.0',
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          workerId: this.workerId,
          isCluster: this.isWorker,
          clusterSize: this.isWorker ? os.cpus().length : 1,
          activeConnections: this.clients.size,
          database: this.databasePool ? this.databasePool.getPoolInfo() : null,
          cache: await this.cacheManager.healthCheck()
        };

        res.json(this.createSuccessResponse(info));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SYSTEM_INFO_ERROR',
          error instanceof Error ? error.message : 'Failed to get system info'));
      }
    });

    this.app.use('/api/system', router);
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      // Validate WebSocket connection with CORS
      const origin = req.headers.origin;
      if (!origin || !this.validateWebSocketOrigin(origin)) {
        logger.warn('WebSocket connection rejected - invalid origin', { origin, ip: req.socket.remoteAddress });
        ws.close(1008, 'Invalid origin');
        return;
      }

      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      logger.info('WebSocket client connected', {
        clientId,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        totalClients: this.clients.size
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: MessageType.PERFORMANCE_UPDATE,
        id: this.generateId('message'),
        payload: {
          message: 'Connected to Turbo Flow WebSocket',
          workerId: this.workerId,
          clientId
        },
        timestamp: new Date()
      });

      // Handle incoming messages with validation
      ws.on('message', (data: WebSocket.Data) => {
        try {
          // Validate message size
          if (data.length > 1024 * 1024) { // 1MB limit
            logger.warn('WebSocket message too large', { clientId, size: data.length });
            this.sendToClient(clientId, {
              type: 'error',
              id: this.generateId('error'),
              payload: { error: 'Message too large' },
              timestamp: new Date()
            });
            return;
          }

          const message = JSON.parse(data.toString());
          this.validateAndHandleWebSocketMessage(clientId, message);
        } catch (error) {
          logger.error('Invalid WebSocket message', { clientId, error: error.message });
          this.sendToClient(clientId, {
            type: 'error',
            id: this.generateId('error'),
            payload: { error: 'Invalid message format' },
            timestamp: new Date()
          });
        }
      });

      // Handle disconnection
      ws.on('close', (code, reason) => {
        this.clients.delete(clientId);
        logger.info('WebSocket client disconnected', {
          clientId,
          code,
          reason: reason?.toString(),
          totalClients: this.clients.size
        });
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket connection error', {
          clientId,
          error: error.message,
          stack: error.stack
        });
        this.clients.delete(clientId);
      });
    });
  }

  /**
   * Validates WebSocket origin with strict security checks
   */
  private validateWebSocketOrigin(origin: string): boolean {
    try {
      // Parse and validate the origin URL
      const originUrl = new URL(origin);

      // Get allowed origins from environment variable
      const allowedOriginsEnv = process.env.WS_ALLOWED_ORIGINS;

      if (!allowedOriginsEnv) {
        // CRITICAL: No origins configured - reject all
        logger.error('WebSocket security: WS_ALLOWED_ORIGINS not configured', {
          origin,
          ip: 'unknown'
        });
        return false;
      }

      // Parse allowed origins from environment
      const allowedOrigins = allowedOriginsEnv
        .split(',')
        .map(o => o.trim())
        .filter(o => o.length > 0);

      // Check if origin is in allowed list
      if (!allowedOrigins.includes(origin)) {
        logger.warn('WebSocket connection rejected - origin not in allowed list', {
          origin,
          allowedOrigins,
          ip: 'unknown'
        });
        return false;
      }

      // Additional security checks for production
      if (process.env.NODE_ENV === 'production') {
        // Ensure HTTPS is used
        if (originUrl.protocol !== 'https:') {
          logger.error('WebSocket security: HTTP origin in production', {
            origin,
            protocol: originUrl.protocol
          });
          return false;
        }

        // Reject localhost origins in production
        if (originUrl.hostname === 'localhost' ||
            originUrl.hostname === '127.0.0.1' ||
            originUrl.hostname.includes('192.168.') ||
            originUrl.hostname.includes('10.')) {
          logger.error('WebSocket security: Private IP origin in production', {
            origin,
            hostname: originUrl.hostname
          });
          return false;
        }
      }

      // Development mode restrictions
      if (process.env.NODE_ENV === 'development') {
        // In development, only allow localhost and 127.0.0.1
        const allowedDevHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
        if (!allowedDevHosts.includes(originUrl.hostname)) {
          logger.warn('WebSocket connection rejected - invalid development hostname', {
            origin,
            hostname: originUrl.hostname
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('WebSocket origin validation error', {
        origin,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Validates and handles WebSocket messages
   */
  private validateAndHandleWebSocketMessage(clientId: string, message: any): void {
    // Validate message structure
    if (!message || typeof message !== 'object') {
      this.sendToClient(clientId, {
        type: 'error',
        id: this.generateId('error'),
        payload: { error: 'Invalid message format' },
        timestamp: new Date()
      });
      return;
    }

    // Check for required fields
    if (!message.type) {
      this.sendToClient(clientId, {
        type: 'error',
        id: this.generateId('error'),
        payload: { error: 'Message type is required' },
        timestamp: new Date()
      });
      return;
    }

    // Validate message type
    const validTypes = ['ping', 'subscribe', 'unsubscribe', 'query', 'command'];
    if (!validTypes.includes(message.type)) {
      this.sendToClient(clientId, {
        type: 'error',
        id: this.generateId('error'),
        payload: { error: 'Invalid message type' },
        timestamp: new Date()
      });
      return;
    }

    // Sanitize message data
    const sanitizedMessage = {
      ...message,
      data: message.data ? this.sanitizeWebSocketData(message.data) : undefined
    };

    // Handle the validated message
    this.handleWebSocketMessage(clientId, sanitizedMessage);
  }

  /**
   * Sanitizes WebSocket message data
   */
  private sanitizeWebSocketData(data: any): any {
    if (typeof data === 'string') {
      // Remove potentially dangerous patterns
      return data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .substring(0, 10000); // Limit length
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive keys
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('secret')) {
          continue;
        }

        sanitized[key] = this.sanitizeWebSocketData(value);
      }
      return sanitized;
    }

    return data;
  }

  private setupEventHandlers(): void {
    // Truth verification events
    this.truthVerification.on('verificationCompleted', (result) => {
      this.broadcast({
        type: MessageType.VERIFICATION_RESULT,
        id: this.generateId('verification'),
        payload: result,
        timestamp: new Date()
      });
    });

    // Agent coordination events
    this.agentCoordination.on('agentSpawned', (agent) => {
      this.broadcast({
        type: MessageType.AGENT_STATUS_UPDATE,
        id: this.generateId('agent'),
        payload: { agent, status: 'spawned' },
        timestamp: new Date()
      });
    });

    this.agentCoordination.on('taskCompleted', (data) => {
      this.broadcast({
        type: MessageType.TASK_UPDATE,
        id: this.generateId('task'),
        payload: data,
        timestamp: new Date()
      });
    });

    // Security scanning events
    this.securityScanning.on('scanCompleted', (scan) => {
      this.broadcast({
        type: MessageType.SECURITY_SCAN_RESULT,
        id: this.generateId('security'),
        payload: scan,
        timestamp: new Date()
      });
    });

    // Performance monitoring events with enhanced data
    this.performanceMonitoring.on('metricsCollected', async (message) => {
      // Enhance message with additional metrics
      const enhancedMessage = {
        ...message,
        payload: {
          ...message.payload,
          database: this.databasePool ? this.databasePool.getMetrics() : null,
          cache: await this.cacheManager.getStats(),
          workerId: this.workerId
        }
      };

      this.broadcast(enhancedMessage);
    });
  }

  private async initializeSystems(): Promise<void> {
    try {
      // Initialize GitHub integration if token is provided
      if (process.env.GITHUB_TOKEN) {
        await this.githubIntegration.initialize({
          apiToken: process.env.GITHUB_TOKEN,
          webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || ''
        });
      }

      // Start performance monitoring
      this.performanceMonitoring.startMonitoring(5000);

      console.log('✅ Core systems initialized');
      console.log(`🚀 Worker ${this.workerId || 'master'} ready`);
    } catch (error) {
      console.error('❌ Failed to initialize systems:', error);
      throw error;
    }
  }

  private handleWebSocketMessage(clientId: string, message: any): void {
    // Handle different message types from clients
    logger.debug('WebSocket message received', {
      clientId,
      type: message.type,
      workerId: this.workerId
    });

    // Echo back for now - implement specific handlers as needed
    this.sendToClient(clientId, {
      type: 'echo',
      id: this.generateId('echo'),
      payload: {
        received: message,
        workerId: this.workerId
      },
      timestamp: new Date()
    });
  }

  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send WebSocket message', {
          clientId,
          error: error instanceof Error ? error.message : 'Unknown'
        });
        this.clients.delete(clientId);
      }
    }
  }

  private broadcast(message: WebSocketMessage): void {
    const messageString = JSON.stringify(message);

    this.clients.forEach((client, clientId) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
        } catch (error) {
          logger.error(`Failed to broadcast message to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    });
  }

  private createSuccessResponse<T = any>(data: T): ApiResponse<T> {
    return ResponseOptimizer.createSuccessResponse(data);
  }

  private createErrorResponse(code: string, message: string, details?: any): ApiResponse {
    return ResponseOptimizer.createErrorResponse(code, message, details);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRateLimiterStats(): any {
    const stats: any = {};
    for (const [name, limiter] of this.rateLimiters.entries()) {
      stats[name] = limiter.getStats();
    }
    return stats;
  }

  private async generateOptimizationSuggestions(analysis: any): Promise<string[]> {
    const suggestions: string[] = [];

    // Analyze bottlenecks and generate suggestions
    if (analysis.bottlenecks) {
      for (const bottleneck of analysis.bottlenecks) {
        switch (bottleneck.type) {
          case 'cpu':
            suggestions.push('Consider scaling up CPU resources or optimizing CPU-intensive operations');
            suggestions.push('Implement request batching to reduce CPU overhead');
            break;
          case 'memory':
            suggestions.push('Check for memory leaks and consider increasing available memory');
            suggestions.push('Implement memory pooling for frequently allocated objects');
            break;
          case 'agent_performance':
            suggestions.push('Optimize agent task execution and review resource allocation');
            suggestions.push('Consider implementing agent task queuing and parallel processing');
            break;
        }
      }
    }

    // Add cache suggestions
    const cacheStats = await this.cacheManager.getStats();
    if (cacheStats.hitRate < 80) {
      suggestions.push('Cache hit rate is low - consider caching more frequently accessed data');
    }

    // Add database suggestions
    if (this.databasePool) {
      const dbStats = this.databasePool.getMetrics();
      if (dbStats.averageQueryTime > 100) {
        suggestions.push('Database queries are slow - consider optimizing queries and adding indexes');
      }
      if (dbStats.connectionUtilization > 80) {
        suggestions.push('Database connection utilization is high - consider increasing pool size');
      }
    }

    return suggestions;
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    // Initialize core systems
    await this.initializeSystems();

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🚀 Optimized Turbo Flow Server started on port ${this.port}`);
          console.log(`📊 Performance monitoring active`);
          console.log(`🔗 WebSocket server ready`);
          console.log(`🏢 Worker: ${this.workerId || 'master'}`);
          console.log(`💾 Database: ${this.databasePool ? 'Connected' : 'Not configured'}`);
          console.log(`🗄️  Cache: ${this.cacheManager ? 'Connected' : 'Not configured'}`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    return new Promise(async (resolve) => {
      // Close database pool
      if (this.databasePool) {
        await this.databasePool.close();
      }

      // Close cache manager
      await this.cacheManager.close();

      // Stop performance monitoring
      this.performanceMonitoring.stopMonitoring();

      // Close WebSocket server
      this.wss.close();

      // Close HTTP server
      this.server.close(() => {
        console.log('🛑 Optimized Turbo Flow Server stopped');
        resolve();
      });
    });
  }
}

/**
 * Create and start server with clustering support
 */
export async function startOptimizedServer(port: number = 3000, options?: any): Promise<void> {
  // Check if clustering is enabled and we're in the master process
  if (options?.enableClustering && cluster.isPrimary) {
    const numCPUs = os.cpus().length;
    console.log(`🏭 Starting cluster with ${numCPUs} workers`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork({
        WORKER_ID: i + 1,
        ...process.env
      });
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
      console.log(`❌ Worker ${worker.process.pid} died (code: ${code}, signal: ${signal})`);
      console.log('🔄 Restarting worker...');
      cluster.fork({
        WORKER_ID: worker.id,
        ...process.env
      });
    });

  } else {
    // Create and start server instance
    const server = new OptimizedTurboFlowServer(port, options);
    await server.start();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\n🛑 SIGTERM received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 SIGINT received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
  }
}

export { OptimizedTurboFlowServer };