import express from 'express';
import { createServer } from 'http';
import { BaseComponent } from '../shared/base-classes.js';
import { TruthVerificationCore } from '../verification/TruthVerificationCore.js';
import { AgentCoordination } from '../core/AgentCoordination.js';
import { GitHubIntegration } from '../core/GitHubIntegration.js';
import { SecurityScanning } from '../core/SecurityScanning.js';
import { PerformanceMonitoring } from '../core/PerformanceMonitoring.js';
import { MiddlewareManager } from './middleware/MiddlewareManager.js';
import { RouteManager } from './routes/RouteManager.js';
import { WebSocketManager } from './websocket/WebSocketManager.js';

export interface TurboFlowServerConfig {
  port?: number;
  enableWebSocket?: boolean;
  enableSecurity?: boolean;
  enableLogging?: boolean;
  maxWebSocketConnections?: number;
  allowedWebSocketOrigins?: string[];
}

export class TurboFlowServer extends BaseComponent {
  private app: express.Application;
  private server: any;
  private port: number;
  private config: Required<TurboFlowServerConfig>;

  // Core systems
  private truthVerification: TruthVerificationCore;
  private agentCoordination: AgentCoordination;
  private githubIntegration: GitHubIntegration;
  private securityScanning: SecurityScanning;
  private performanceMonitoring: PerformanceMonitoring;

  // Management components
  private middlewareManager: MiddlewareManager;
  private routeManager: RouteManager;
  private webSocketManager?: WebSocketManager;

  constructor(config: TurboFlowServerConfig = {}) {
    super();
    this.config = {
      port: config.port ?? 3000,
      enableWebSocket: config.enableWebSocket ?? true,
      enableSecurity: config.enableSecurity ?? true,
      enableLogging: config.enableLogging ?? true,
      maxWebSocketConnections: config.maxWebSocketConnections ?? 1000,
      allowedWebSocketOrigins: config.allowedWebSocketOrigins ?? []
    };

    this.app = express();
    this.server = createServer(this.app);
    this.port = this.config.port;

    this.initializeCoreSystems();
    this.initializeManagementComponents();
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Initialize core systems
      await this.initializeSystems();

      // Start HTTP server
      await this.startHttpServer();

      // Start WebSocket server if enabled
      if (this.config.enableWebSocket && this.webSocketManager) {
        await this.webSocketManager.start();
      }

      this.setupEventHandlers();

      this.logger.info(`🚀 Turbo Flow Server started on port ${this.port}`);
      this.logger.info(`📊 Performance monitoring active`);
      if (this.config.enableWebSocket) {
        this.logger.info(`🔗 WebSocket server ready on port ${this.webSocketManager!.getConfig().port}`);
      }

      this.emitEvent('server_started', {
        port: this.port,
        config: this.config,
        timestamp: new Date()
      });

    } catch (error) {
      this.handleError(error as Error, 'Failed to start server');
      throw error;
    }
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    try {
      // Stop WebSocket server first
      if (this.webSocketManager) {
        await this.webSocketManager.stop();
      }

      // Stop HTTP server
      await this.stopHttpServer();

      // Shutdown core systems
      await this.shutdownSystems();

      this.logger.info('🛑 Turbo Flow Server stopped');

      this.emitEvent('server_stopped', { timestamp: new Date() });

    } catch (error) {
      this.handleError(error as Error, 'Error during server shutdown');
    }
  }

  private initializeCoreSystems(): void {
    // Initialize singleton instances
    this.truthVerification = TruthVerificationCore.getInstance();
    this.agentCoordination = AgentCoordination.getInstance();
    this.githubIntegration = GitHubIntegration.getInstance();
    this.securityScanning = SecurityScanning.getInstance();
    this.performanceMonitoring = PerformanceMonitoring.getInstance();
  }

  private initializeManagementComponents(): void {
    // Initialize middleware manager
    this.middlewareManager = new MiddlewareManager(this.app, {
      enableSecurity: this.config.enableSecurity,
      enableLogging: this.config.enableLogging
    });

    // Initialize route manager
    this.routeManager = new RouteManager(this.middlewareManager, {
      truthVerification: this.truthVerification,
      agentCoordination: this.agentCoordination,
      githubIntegration: this.githubIntegration,
      securityScanning: this.securityScanning,
      performanceMonitoring: this.performanceMonitoring
    });

    // Initialize WebSocket manager if enabled
    if (this.config.enableWebSocket) {
      this.webSocketManager = new WebSocketManager({
        maxConnections: this.config.maxWebSocketConnections,
        allowedOrigins: this.config.allowedWebSocketOrigins
      });
    }
  }

  private async initializeSystems(): Promise<void> {
    const initPromises = [
      this.initializeGitHubIntegration(),
      this.startPerformanceMonitoring()
    ];

    await Promise.allSettled(initPromises);
  }

  private async initializeGitHubIntegration(): Promise<void> {
    if (process.env.GITHUB_TOKEN) {
      await this.githubIntegration.initialize({
        apiToken: process.env.GITHUB_TOKEN,
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || ''
      });
    }
  }

  private async startPerformanceMonitoring(): Promise<void> {
    this.performanceMonitoring.startMonitoring(5000);
  }

  private async startHttpServer(): Promise<void> {
    // Setup middleware and routes
    this.middlewareManager.setupMiddleware();
    this.routeManager.setupRoutes(this.app);

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async stopHttpServer(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  private async shutdownSystems(): Promise<void> {
    const shutdownPromises = [
      this.stopPerformanceMonitoring()
    ];

    await Promise.allSettled(shutdownPromises);
  }

  private async stopPerformanceMonitoring(): Promise<void> {
    this.performanceMonitoring.stopMonitoring();
  }

  private setupEventHandlers(): void {
    // Forward events from core systems
    this.setupCoreSystemEventHandlers();

    // Setup WebSocket event handlers if enabled
    if (this.webSocketManager) {
      this.setupWebSocketEventHandlers();
    }

    // Setup process event handlers
    this.setupProcessEventHandlers();
  }

  private setupCoreSystemEventHandlers(): void {
    // Truth verification events
    this.truthVerification.on('verification_completed', (event) => {
      this.webSocketManager?.broadcast({
        type: 'verification_result',
        id: event.requestId,
        payload: event,
        timestamp: new Date()
      });
    });

    // Agent coordination events
    this.agentCoordination.on('agent_spawned', (agent) => {
      this.webSocketManager?.broadcast({
        type: 'agent_status_update',
        id: `agent_${agent.id}`,
        payload: { agent, status: 'spawned' },
        timestamp: new Date()
      });
    });

    this.agentCoordination.on('task_completed', (data) => {
      this.webSocketManager?.broadcast({
        type: 'task_update',
        id: `task_${data.taskId}`,
        payload: data,
        timestamp: new Date()
      });
    });

    // Security scanning events
    this.securityScanning.on('scan_completed', (scan) => {
      this.webSocketManager?.broadcast({
        type: 'security_scan_result',
        id: `scan_${scan.id}`,
        payload: scan,
        timestamp: new Date()
      });
    });

    // Performance monitoring events
    this.performanceMonitoring.on('metrics_collected', (message) => {
      this.webSocketManager?.broadcast(message);
    });
  }

  private setupWebSocketEventHandlers(): void {
    if (!this.webSocketManager) return;

    this.webSocketManager.on('client_connected', (event) => {
      this.logger.info('WebSocket client connected', { clientId: event.clientId });
    });

    this.webSocketManager.on('client_disconnected', (event) => {
      this.logger.info('WebSocket client disconnected', { clientId: event.clientId });
    });

    this.webSocketManager.on('message_received', (event) => {
      this.handleWebSocketMessage(event);
    });
  }

  private handleWebSocketMessage(event: any): void {
    const { clientId, message } = event;

    // Handle different message types
    switch (message.type) {
      case 'ping':
        this.webSocketManager?.sendMessage(clientId, {
          type: 'pong',
          id: `pong_${Date.now()}`,
          payload: { timestamp: new Date() },
          timestamp: new Date()
        });
        break;

      case 'subscribe':
        // Handle subscription logic
        break;

      case 'unsubscribe':
        // Handle unsubscription logic
        break;

      default:
        this.logger.warn(`Unknown WebSocket message type: ${message.type}`, { clientId });
    }
  }

  private setupProcessEventHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, starting graceful shutdown...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
  }

  // Public getters for accessing components
  public getApp(): express.Application {
    return this.app;
  }

  public getPort(): number {
    return this.port;
  }

  public getCoreSystems() {
    return {
      truthVerification: this.truthVerification,
      agentCoordination: this.agentCoordination,
      githubIntegration: this.githubIntegration,
      securityScanning: this.securityScanning,
      performanceMonitoring: this.performanceMonitoring
    };
  }

  public getWebSocketManager(): WebSocketManager | undefined {
    return this.webSocketManager;
  }

  public isRunning(): boolean {
    return this.server.listening;
  }
}