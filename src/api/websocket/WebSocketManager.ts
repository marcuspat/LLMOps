import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { BaseWebSocketHandler } from '../../shared/base-classes.js';
import { ClientConnection, WebSocketMessage } from '../../shared/interfaces.js';
import { IdGenerator, ValidationUtils } from '../../shared/utils.js';
import { logger } from '../../utils/secure-logger.js';

export interface WebSocketConfig {
  port?: number;
  maxConnections?: number;
  messageSizeLimit?: number;
  pingInterval?: number;
  allowedOrigins?: string[];
}

export class WebSocketManager extends BaseWebSocketHandler {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private config: Required<WebSocketConfig>;

  constructor(config: WebSocketConfig = {}) {
    super();
    this.config = {
      port: config.port ?? 8080,
      maxConnections: config.maxConnections ?? 1000,
      messageSizeLimit: config.messageSizeLimit ?? 1024 * 1024, // 1MB
      pingInterval: config.pingInterval ?? 30000, // 30 seconds
      allowedOrigins: config.allowedOrigins ?? []
    };

    this.wss = new WebSocketServer({
      port: this.config.port,
      verifyClient: this.verifyClient.bind(this)
    });

    this.setupEventHandlers();
    this.startPingInterval();
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.on('listening', () => {
        logger.info(`WebSocket server started on port ${this.config.port}`);
        resolve();
      });

      this.wss.on('error', (error) => {
        this.handleError(error, 'WebSocket server error');
        reject(error);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.clients.forEach((client) => {
        client.ws.close();
      });
      this.clients.clear();

      this.wss.close(() => {
        logger.info('WebSocket server stopped');
        resolve();
      });
    });
  }

  private verifyClient(info: any): boolean {
    try {
      const origin = info.origin;
      if (!origin) return false;

      // Check connection limit
      if (this.clients.size >= this.config.maxConnections) {
        logger.warn('Connection limit reached', { origin });
        return false;
      }

      // Validate origin
      if (this.config.allowedOrigins.length > 0) {
        const originUrl = new URL(origin);
        const isAllowed = this.config.allowedOrigins.some(allowed =>
          originUrl.hostname === allowed || originUrl.href === allowed
        );

        if (!isAllowed) {
          logger.warn('Invalid origin rejected', { origin });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Client verification error:', error);
      return false;
    }
  }

  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = IdGenerator.generate('client');
    const client: ClientConnection = {
      id: clientId,
      ws,
      lastPing: new Date(),
      permissions: []
    };

    this.clients.set(clientId, client);

    logger.info('WebSocket client connected', {
      clientId,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Set up client event handlers
    this.setupClientHandlers(clientId, ws);

    // Send welcome message
    this.sendMessage(clientId, {
      type: 'connected',
      id: IdGenerator.generate('message'),
      payload: { clientId, message: 'Connected to Turbo Flow WebSocket' },
      timestamp: new Date()
    });

    this.emitEvent('client_connected', { clientId, client });
  }

  private setupClientHandlers(clientId: string, ws: WebSocket): void {
    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    ws.on('error', (error) => {
      this.handleError(error, `WebSocket error for client ${clientId}`);
      this.handleDisconnection(clientId);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = new Date();
      }
    });
  }

  private handleMessage(clientId: string, data: WebSocket.Data): void {
    try {
      // Validate message size
      if (data.length > this.config.messageSizeLimit) {
        logger.warn('Message too large', { clientId, size: data.length });
        this.sendError(clientId, 'Message too large');
        return;
      }

      const message = JSON.parse(data.toString());

      if (!this.validateMessage(message, clientId)) {
        return;
      }

      // Sanitize message data
      const sanitizedMessage = {
        ...message,
        data: message.data ? ValidationUtils.sanitizeObject(message.data) : undefined
      };

      this.emitEvent('message_received', { clientId, message: sanitizedMessage });

    } catch (error) {
      logger.error('Invalid message format', { clientId, error: error.message });
      this.sendError(clientId, 'Invalid message format');
    }
  }

  private handleDisconnection(clientId: string, code?: number, reason?: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);

    logger.info('WebSocket client disconnected', {
      clientId,
      code,
      reason: reason?.toString()
    });

    this.emitEvent('client_disconnected', {
      clientId,
      client,
      code,
      reason
    });
  }

  private startPingInterval(): void {
    setInterval(() => {
      const now = new Date();
      const staleThreshold = this.config.pingInterval * 2;

      this.clients.forEach((client, clientId) => {
        const timeSincePing = now.getTime() - client.lastPing.getTime();

        // Check if client is stale
        if (timeSincePing > staleThreshold) {
          logger.warn('Stale client detected', { clientId, timeSincePing });
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.config.pingInterval);
  }

  // Message handling methods
  protected sendMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      client.ws.send(messageString);
    } catch (error) {
      this.handleError(error as Error, `Failed to send message to client ${clientId}`);
    }
  }

  protected sendError(clientId: string, error: string): void {
    this.sendMessage(clientId, {
      type: 'error',
      id: IdGenerator.generate('error'),
      payload: { error },
      timestamp: new Date()
    });
  }

  public broadcast(message: any, excludeClientId?: string): void {
    const messageString = JSON.stringify(message);

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN && clientId !== excludeClientId) {
        try {
          client.ws.send(messageString);
        } catch (error) {
          logger.error(`Failed to broadcast to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    });
  }

  public sendToSession(sessionId: string, message: any): void {
    this.clients.forEach((client, clientId) => {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(clientId, message);
      }
    });
  }

  // Client management methods
  public getClient(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  public getClientByUserId(userId: string): ClientConnection | undefined {
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        return client;
      }
    }
    return undefined;
  }

  public getClientsBySession(sessionId: string): ClientConnection[] {
    return Array.from(this.clients.values()).filter(
      client => client.sessionId === sessionId
    );
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getServer(): WebSocketServer {
    return this.wss;
  }
}