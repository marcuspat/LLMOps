import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { TruthVerification } from '../core/TruthVerification.js';
import { AgentCoordination } from '../core/AgentCoordination.js';
import { GitHubIntegration } from '../core/GitHubIntegration.js';
import { SecurityScanning } from '../core/SecurityScanning.js';
import { PerformanceMonitoring } from '../core/PerformanceMonitoring.js';
import { ApiResponse, WebSocketMessage, MessageType } from '../types/index.js';

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
 * Main API Server for Turbo Flow Backend
 * RESTful API with WebSocket support for real-time communication
 */
export class TurboFlowServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private port: number;
  private truthVerification: TruthVerification;
  private agentCoordination: AgentCoordination;
  private githubIntegration: GitHubIntegration;
  private securityScanning: SecurityScanning;
  private performanceMonitoring: PerformanceMonitoring;
  private clients: Map<string, WebSocket> = new Map();

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    // Initialize core systems
    this.truthVerification = TruthVerification.getInstance();
    this.agentCoordination = AgentCoordination.getInstance();
    this.githubIntegration = GitHubIntegration.getInstance();
    this.securityScanning = SecurityScanning.getInstance();
    this.performanceMonitoring = PerformanceMonitoring.getInstance();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupEventHandlers();
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
          console.log(`🚀 Turbo Flow Server started on port ${this.port}`);
          console.log(`📊 Performance monitoring active`);
          console.log(`🔗 WebSocket server ready`);
          resolve();
        }
      });
    });
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('🛑 Turbo Flow Server stopped');
        resolve();
      });
    });
  }

  // Private methods

  private setupMiddleware(): void {
    // Apply comprehensive security middleware stack
    applySecurityMiddleware(this.app);

    // Request logging middleware (after security but before routes)
    this.app.use(loggerMiddleware);

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

    // Enhanced error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

  private setupRoutes(): void {
    // Health check endpoint (public, no auth required)
    this.app.get('/health', publicCors, validateQuery(commonSchemas.dateRange), (req, res) => {
      if (req.logger) {
        req.logger.info('Health check accessed', {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      res.json(this.createSuccessResponse({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }));
    });

    // Authentication routes (public)
    this.app.post('/auth/login', publicCors, validateBody(z.object({
      username: z.string().min(1).max(100),
      password: z.string().min(1).max(500),
      mfaToken: z.string().optional()
    })), async (req, res) => {
      try {
        // Login logic would go here
        req.logger?.info('Login attempt', {
          username: req.body.username,
          ip: req.ip
        });

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

    // Verify content
    router.post('/verify',
      validateBody(commonSchemas.truthVerification),
      requirePermission('truth:verify'),
      async (req, res) => {
        try {
          if (req.logger) {
            securityLogger.apiAccess(req.user!.id, 'truth:verify', 'POST', req.ip || 'unknown', true);
          }

          const result = await this.truthVerification.verify(req.body);
          req.logger?.info('Content verification completed', { requestId: req.body.context?.requestId });

          res.json(this.createSuccessResponse(result));
        } catch (error) {
          req.logger?.error('Verification failed', { error: error.message });
          res.status(500).json(this.createErrorResponse('VERIFICATION_ERROR',
            error instanceof Error ? error.message : 'Verification failed'));
        }
      }
    );

    // Batch verification
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

          const results = await this.truthVerification.verifyBatch(req.body.requests);
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

    // Get verification statistics
    router.get('/stats',
      validateQuery(commonSchemas.dateRange),
      requirePermission('truth:read-stats'),
      async (req, res) => {
        try {
          const { start, end } = req.query;
          const timeFrame = start && end ? {
            start: new Date(start as string),
            end: new Date(end as string)
          } : undefined;

          const stats = this.truthVerification.getVerificationStats(timeFrame);

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

    // Create swarm
    router.post('/swarms', async (req, res) => {
      try {
        const swarm = await this.agentCoordination.createSwarm(req.body);
        res.json(this.createSuccessResponse(swarm));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SWARM_CREATE_ERROR',
          error instanceof Error ? error.message : 'Failed to create swarm'));
      }
    });

    // Spawn agent
    router.post('/agents', async (req, res) => {
      try {
        const agent = await this.agentCoordination.spawnAgent(req.body.type, req.body.config || {});
        res.json(this.createSuccessResponse(agent));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('AGENT_SPAWN_ERROR',
          error instanceof Error ? error.message : 'Failed to spawn agent'));
      }
    });

    // Spawn multiple agents
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

    // Get system status
    router.get('/status', (req, res) => {
      try {
        const status = this.agentCoordination.getSystemStatus();
        res.json(this.createSuccessResponse(status));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('STATUS_ERROR',
          error instanceof Error ? error.message : 'Failed to get system status'));
      }
    });

    // Get agent metrics
    router.get('/agents/:agentId/metrics', (req, res) => {
      try {
        const metrics = this.agentCoordination.getAgentMetrics(req.params.agentId);
        if (!metrics) {
          return res.status(404).json(this.createErrorResponse('AGENT_NOT_FOUND', 'Agent not found'));
        }
        res.json(this.createSuccessResponse(metrics));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('METRICS_ERROR',
          error instanceof Error ? error.message : 'Failed to get agent metrics'));
      }
    });

    // Scale swarm
    router.post('/swarms/:swarmId/scale', async (req, res) => {
      try {
        await this.agentCoordination.scaleSwarm(req.params.swarmId, req.body.targetSize);
        res.json(this.createSuccessResponse({ message: 'Swarm scaled successfully' }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SWARM_SCALE_ERROR',
          error instanceof Error ? error.message : 'Failed to scale swarm'));
      }
    });

    // Orchestrate task
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

    // Handle webhook
    router.post('/webhook', async (req, res) => {
      try {
        const signature = req.headers['x-hub-signature-256'] as string;
        await this.githubIntegration.handleWebhook({
          headers: req.headers,
          body: req.body
        }, signature);
        res.json(this.createSuccessResponse({ message: 'Webhook processed successfully' }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('WEBHOOK_ERROR',
          error instanceof Error ? error.message : 'Failed to process webhook'));
      }
    });

    // Create webhook
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

    // Get repository
    router.get('/repos/:owner/:repo', async (req, res) => {
      try {
        const repo = await this.githubIntegration.getRepository(req.params.owner, req.params.repo);
        if (!repo) {
          return res.status(404).json(this.createErrorResponse('REPO_NOT_FOUND', 'Repository not found'));
        }
        res.json(this.createSuccessResponse(repo));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('REPO_GET_ERROR',
          error instanceof Error ? error.message : 'Failed to get repository'));
      }
    });

    // Create pull request
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

    // Initiate scan
    router.post('/scans', async (req, res) => {
      try {
        const scan = await this.securityScanning.initiateScan(
          req.body.type,
          req.body.target,
          req.body.options
        );
        res.json(this.createSuccessResponse(scan));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SCAN_INIT_ERROR',
          error instanceof Error ? error.message : 'Failed to initiate scan'));
      }
    });

    // Comprehensive scan
    router.post('/scans/comprehensive', async (req, res) => {
      try {
        const scans = await this.securityScanning.performComprehensiveScan(
          req.body.target,
          req.body.options
        );
        res.json(this.createSuccessResponse(scans));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('COMPREHENSIVE_SCAN_ERROR',
          error instanceof Error ? error.message : 'Failed to perform comprehensive scan'));
      }
    });

    // Get scan status
    router.get('/scans/:scanId', (req, res) => {
      try {
        const scan = this.securityScanning.getScanStatus(req.params.scanId);
        if (!scan) {
          return res.status(404).json(this.createErrorResponse('SCAN_NOT_FOUND', 'Scan not found'));
        }
        res.json(this.createSuccessResponse(scan));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('SCAN_STATUS_ERROR',
          error instanceof Error ? error.message : 'Failed to get scan status'));
      }
    });

    // Get security results
    router.get('/results/:target', (req, res) => {
      try {
        const results = this.securityScanning.getSecurityResults(req.params.target);
        res.json(this.createSuccessResponse(results));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('RESULTS_ERROR',
          error instanceof Error ? error.message : 'Failed to get security results'));
      }
    });

    // Get security statistics
    router.get('/stats', (req, res) => {
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

    // Generate security report
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

    // Get metrics
    router.get('/metrics', (req, res) => {
      try {
        const { start, end } = req.query;
        const timeRange = start && end ? {
          start: new Date(start as string),
          end: new Date(end as string)
        } : undefined;

        const metrics = this.performanceMonitoring.getMetrics(timeRange);
        res.json(this.createSuccessResponse(metrics));
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
    router.get('/reports', (req, res) => {
      try {
        const { start, end } = req.query;
        const timeRange = start && end ? {
          start: new Date(start as string),
          end: new Date(end as string)
        } : undefined;

        const report = this.performanceMonitoring.generatePerformanceReport(timeRange);
        res.json(this.createSuccessResponse(report));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('PERFORMANCE_REPORT_ERROR',
          error instanceof Error ? error.message : 'Failed to generate performance report'));
      }
    });

    // Run benchmarks
    router.post('/benchmarks', async (req, res) => {
      try {
        const results = await this.performanceMonitoring.runBenchmarks(req.body);
        res.json(this.createSuccessResponse(results));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('BENCHMARK_ERROR',
          error instanceof Error ? error.message : 'Failed to run benchmarks'));
      }
    });

    // Analyze bottlenecks
    router.get('/bottlenecks', (req, res) => {
      try {
        const { start, end } = req.query;
        const timeRange = start && end ? {
          start: new Date(start as string),
          end: new Date(end as string)
        } : undefined;

        const analysis = this.performanceMonitoring.analyzeBottlenecks(timeRange);
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

    // System info
    router.get('/info', (req, res) => {
      try {
        const info = {
          version: process.env.npm_package_version || '1.0.0',
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
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
        userAgent: req.headers['user-agent']
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: MessageType.PERFORMANCE_UPDATE,
        id: this.generateId('message'),
        payload: { message: 'Connected to Turbo Flow WebSocket' },
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
          reason: reason?.toString()
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

    // Performance monitoring events
    this.performanceMonitoring.on('metricsCollected', (message) => {
      this.broadcast(message);
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
    } catch (error) {
      console.error('❌ Failed to initialize systems:', error);
      throw error;
    }
  }

  private handleWebSocketMessage(clientId: string, message: any): void {
    // Handle different message types from clients
    console.log(`📨 Message from client ${clientId}:`, message);

    // Echo back for now - implement specific handlers as needed
    this.sendToClient(clientId, {
      type: 'echo',
      id: this.generateId('echo'),
      payload: { received: message },
      timestamp: new Date()
    });
  }

  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private broadcast(message: WebSocketMessage): void {
    const messageString = JSON.stringify(message);

    this.clients.forEach((client, clientId) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageString);
        } catch (error) {
          console.error(`Failed to send message to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    });
  }

  private createSuccessResponse<T = any>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date()
    };
  }

  private createErrorResponse(code: string, message: string, details?: any): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      timestamp: new Date()
    };
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}