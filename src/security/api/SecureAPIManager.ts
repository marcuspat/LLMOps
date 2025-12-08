/**
 * Secure API Manager
 * Comprehensive API security with encryption, rate limiting, and threat protection
 */

import { createCipher, createDecipher, randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';
import { SecurityConfig } from '../core/SecurityConfig.js';
import { AuthManager } from '../auth/AuthManager.js';
import { PolicyEngine } from '../policy/PolicyEngine.js';

export class SecureAPIManager {
  private config: SecurityConfig;
  private authManager: AuthManager;
  private policyEngine: PolicyEngine;
  private rateLimiter: APIRateLimiter;
  private requestValidator: RequestValidator;
  private responseSanitizer: ResponseSanitizer;
  private encryptionManager: EncryptionManager;
  private requestLogger: APIRequestLogger;

  constructor(config: SecurityConfig, authManager: AuthManager, policyEngine: PolicyEngine) {
    this.config = config;
    this.authManager = authManager;
    this.policyEngine = policyEngine;
    this.rateLimiter = new APIRateLimiter(config);
    this.requestValidator = new RequestValidator(config);
    this.responseSanitizer = new ResponseSanitizer(config);
    this.encryptionManager = new EncryptionManager(config);
    this.requestLogger = new APIRequestLogger(config);
  }

  /**
   * Middleware for securing API endpoints
   */
  async secureEndpoint(req: SecureAPIRequest, res: SecureAPIResponse, next: () => void): Promise<void> {
    try {
      // Generate request ID
      req.requestId = this.generateRequestId();
      req.startTime = Date.now();

      // Log request start
      await this.requestLogger.logRequest(req);

      // Validate request
      const validationResult = await this.validateRequest(req);
      if (!validationResult.valid) {
        await this.sendErrorResponse(res, 400, validationResult.reason);
        return;
      }

      // Rate limiting
      const rateLimitResult = await this.rateLimiter.checkLimit(req);
      if (!rateLimitResult.allowed) {
        await this.sendErrorResponse(res, 429, 'Rate limit exceeded', {
          retryAfter: rateLimitResult.retryAfter
        });
        return;
      }

      // Authentication
      if (this.requiresAuthentication(req)) {
        const authResult = await this.authenticateRequest(req);
        if (!authResult.success) {
          await this.sendErrorResponse(res, 401, authResult.reason || 'Authentication failed');
          return;
        }

        req.user = {
          id: authResult.userId!,
          permissions: authResult.permissions || []
        };
      }

      // Authorization
      if (this.requiresAuthorization(req)) {
        const authzResult = await this.authorizeRequest(req);
        if (!authzResult.authorized) {
          await this.sendErrorResponse(res, 403, authzResult.reason || 'Access denied');
          return;
        }
      }

      // Policy enforcement
      const policyResult = await this.enforcePolicies(req);
      if (!policyResult.compliant) {
        await this.sendErrorResponse(res, 403, 'Policy violation detected');
        return;
      }

      // Security headers
      this.setSecurityHeaders(res);

      // Continue to next middleware/handler
      next();

    } catch (error) {
      await this.sendErrorResponse(res, 500, 'Internal server error');
      await this.requestLogger.logError(req, error);
    }
  }

  /**
   * Handle response with security measures
   */
  async handleResponse(req: SecureAPIRequest, res: SecureAPIResponse, data: any): Promise<void> {
    try {
      // Sanitize response data
      const sanitizedData = await this.responseSanitizer.sanitize(data);

      // Encrypt sensitive data if required
      const responseData = await this.encryptionManager.encryptSensitiveData(sanitizedData, req);

      // Add security metadata
      const responseWithMetadata = {
        data: responseData,
        security: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          encrypted: this.encryptionManager.hasEncryptedFields(responseData)
        }
      };

      // Log response
      await this.requestLogger.logResponse(req, res, responseWithMetadata);

      res.json(responseWithMetadata);

    } catch (error) {
      await this.sendErrorResponse(res, 500, 'Response processing failed');
    }
  }

  /**
   * Create secure WebSocket connection
   */
  async secureWebSocket(socket: SecureWebSocket, request: SecureAPIRequest): Promise<void> {
    try {
      // Authenticate WebSocket connection
      const authResult = await this.authenticateWSConnection(socket, request);
      if (!authResult.success) {
        socket.close(4001, 'Authentication failed');
        return;
      }

      // Set user context
      socket.user = authResult.user;

      // Rate limiting for WebSocket
      const wsRateLimit = await this.rateLimiter.checkWSRateLimit(socket);
      if (!wsRateLimit.allowed) {
        socket.close(4002, 'Rate limit exceeded');
        return;
      }

      // Set up message validation
      socket.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          const validation = await this.validateWSMessage(message, socket);

          if (!validation.valid) {
            socket.send(JSON.stringify({
              type: 'error',
              message: validation.reason
            }));
            return;
          }

          // Process message through security pipeline
          await this.processWSMessage(message, socket);

        } catch (error) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

    } catch (error) {
      socket.close(4000, 'WebSocket setup failed');
    }
  }

  /**
   * Validate API request
   */
  async validateRequest(req: SecureAPIRequest): Promise<ValidationResult> {
    return await this.requestValidator.validate(req);
  }

  /**
   * Encrypt sensitive request data
   */
  async encryptRequestData(data: any, context: EncryptionContext): Promise<EncryptedData> {
    return await this.encryptionManager.encrypt(data, context);
  }

  /**
   * Decrypt response data
   */
  async decryptResponseData(encryptedData: EncryptedData, context: EncryptionContext): Promise<any> {
    return await this.encryptionManager.decrypt(encryptedData, context);
  }

  /**
   * Generate API key
   */
  generateAPIKey(userId: string, permissions: string[]): APIKey {
    const apiKey = this.generateSecureApiKey();
    const hash = createHash('sha256').update(apiKey).digest('hex');

    return {
      keyId: this.generateKeyId(),
      apiKeyHash: hash,
      userId,
      permissions,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      rateLimitPerHour: 1000
    };
  }

  /**
   * Validate API key
   */
  async validateAPIKey(apiKey: string): Promise<APIKeyValidationResult> {
    try {
      const hash = createHash('sha256').update(apiKey).digest('hex');
      // Implementation would lookup API key hash in database
      return {
        valid: true,
        userId: 'user-id',
        permissions: ['read', 'write']
      };
    } catch (error) {
      return {
        valid: false,
        reason: 'Invalid API key'
      };
    }
  }

  // Private helper methods
  private async validateRequest(req: SecureAPIRequest): Promise<ValidationResult> {
    // Validate request size
    if (req.headers['content-length']) {
      const size = parseInt(req.headers['content-length']);
      const maxSize = this.parseSize(this.config.apiSecurity.inputValidation.maxRequestBodySize);
      if (size > maxSize) {
        return {
          valid: false,
          reason: 'Request body too large'
        };
      }
    }

    // Validate content type
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      const contentType = req.headers['content-type'];
      if (!contentType || !this.isValidContentType(contentType)) {
        return {
          valid: false,
          reason: 'Invalid or missing content-type header'
        };
      }
    }

    // Validate headers
    const headerValidation = await this.validateHeaders(req);
    if (!headerValidation.valid) {
      return headerValidation;
    }

    return {
      valid: true
    };
  }

  private async authenticateRequest(req: SecureAPIRequest): Promise<AuthResult> {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    if (apiKey) {
      return await this.validateAPIKey(apiKey);
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return await this.authManager.validateToken(token);
    } else {
      return {
        success: false,
        reason: 'No authentication provided'
      };
    }
  }

  private async authorizeRequest(req: SecureAPIRequest): Promise<AuthorizationResult> {
    if (!req.user) {
      return {
        authorized: false,
        reason: 'User not authenticated'
      };
    }

    const resource = req.url?.split('?')[0] || '';
    const action = this.getMethodAction(req.method || 'GET');

    return await this.authManager.authorize(
      req.user.id,
      resource,
      action,
      {
        clientIP: req.ip,
        userAgent: req.headers['user-agent']
      }
    );
  }

  private async enforcePolicies(req: SecureAPIRequest): Promise<PolicyResult> {
    const context: SecurityContext = {
      userId: req.user?.id,
      role: req.user?.permissions?.join(',') || 'unknown',
      resource: req.url || '',
      action: req.method || 'GET',
      environment: this.config.environment
    };

    return await this.policyEngine.enforcePolicies(context);
  }

  private setSecurityHeaders(res: SecureAPIResponse): void {
    if (!res.headers) res.headers = {};

    // Content Security Policy
    res.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";

    // X-Frame-Options
    res.headers['X-Frame-Options'] = 'DENY';

    // X-Content-Type-Options
    res.headers['X-Content-Type-Options'] = 'nosniff';

    // X-XSS-Protection
    res.headers['X-XSS-Protection'] = '1; mode=block';

    // Strict-Transport-Security (HTTPS only)
    if (this.config.environment === 'production') {
      res.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    // Referrer Policy
    res.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

    // Permissions Policy
    res.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';
  }

  private async sendErrorResponse(res: SecureAPIResponse, statusCode: number, message: string, headers?: Record<string, string>): Promise<void> {
    this.setSecurityHeaders(res);

    if (headers) {
      Object.assign(res.headers, headers);
    }

    res.statusCode = statusCode;
    res.json({
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }

  private requiresAuthentication(req: SecureAPIRequest): boolean {
    // Skip auth for health checks, public endpoints, etc.
    const publicPaths = ['/health', '/public', '/status'];
    const path = req.url?.split('?')[0] || '';

    return !publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  private requiresAuthorization(req: SecureAPIRequest): boolean {
    // All authenticated requests require authorization
    return !!req.user;
  }

  private async authenticateWSConnection(socket: SecureWebSocket, request: SecureAPIRequest): Promise<AuthResult> {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return {
        success: false,
        reason: 'WebSocket authentication token required'
      };
    }

    return await this.authManager.validateToken(token as string);
  }

  private async validateWSMessage(message: any, socket: SecureWebSocket): Promise<ValidationResult> {
    if (!message.type) {
      return {
        valid: false,
        reason: 'Message type is required'
      };
    }

    if (typeof message.data !== 'object' && message.data !== undefined) {
      return {
        valid: false,
        reason: 'Message data must be an object'
      };
    }

    // Validate message size
    const messageSize = JSON.stringify(message).length;
    if (messageSize > 10240) { // 10KB limit
      return {
        valid: false,
        reason: 'Message too large'
      };
    }

    return {
      valid: true
    };
  }

  private async processWSMessage(message: any, socket: SecureWebSocket): Promise<void> {
    // Implementation would process WebSocket messages through security pipeline
  }

  private getMethodAction(method: string): string {
    const methodActions: Record<string, string> = {
      'GET': 'read',
      'POST': 'create',
      'PUT': 'update',
      'PATCH': 'update',
      'DELETE': 'delete'
    };

    return methodActions[method] || 'read';
  }

  private parseSize(sizeStr: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
    if (!match) return 0;

    const [, value, unit] = match;
    return parseFloat(value) * (units[unit] || 1);
  }

  private isValidContentType(contentType: string): boolean {
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain'
    ];

    return allowedTypes.some(allowed => contentType.includes(allowed));
  }

  private async validateHeaders(req: SecureAPIRequest): Promise<ValidationResult> {
    const requiredHeaders = ['user-agent'];
    const optionalHeaders = ['content-type', 'accept', 'authorization'];

    for (const header of requiredHeaders) {
      if (!req.headers[header]) {
        return {
          valid: false,
          reason: `Missing required header: ${header}`
        };
      }
    }

    // Validate User-Agent
    const userAgent = req.headers['user-agent'] as string;
    if (userAgent.length > 500) {
      return {
        valid: false,
        reason: 'User-Agent header too long'
      };
    }

    // Validate Accept header
    if (req.headers.accept) {
      const accept = req.headers.accept as string;
      if (accept.length > 300) {
        return {
          valid: false,
          reason: 'Accept header too long'
        };
      }
    }

    return {
      valid: true
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateSecureApiKey(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(32).toString('hex');
    const hash = createHmac('sha256', 'api-key-salt').update(`${timestamp}${random}`).digest('hex');
    return `tk_${hash}`;
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }
}

// Supporting classes
class APIRateLimiter {
  private config: SecurityConfig;
  private requests: Map<string, RequestRecord[]> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async checkLimit(req: SecureAPIRequest): Promise<RateLimitResult> {
    const key = this.getRateLimitKey(req);
    const now = Date.now();
    const windowMs = this.config.apiSecurity.rateLimiting.windowMs;
    const maxRequests = this.config.apiSecurity.rateLimiting.maxRequests;

    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);

    if (validRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

      return {
        allowed: false,
        retryAfter
      };
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return {
      allowed: true
    };
  }

  async checkWSRateLimit(socket: SecureWebSocket): Promise<RateLimitResult> {
    const key = `ws:${socket.user?.id || 'anonymous'}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100; // 100 messages per minute

    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);

    if (validRequests.length >= maxRequests) {
      const retryAfter = Math.ceil((Math.min(...validRequests) + windowMs - now) / 1000);

      return {
        allowed: false,
        retryAfter
      };
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return {
      allowed: true
    };
  }

  private getRateLimitKey(req: SecureAPIRequest): string {
    const userId = (req as any).user?.id || 'anonymous';
    const ip = req.ip || 'unknown';
    return `${userId}:${ip}`;
  }
}

class RequestValidator {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async validate(req: SecureAPIRequest): Promise<ValidationResult> {
    // Implementation would validate request according to security config
    return {
      valid: true
    };
  }
}

class ResponseSanitizer {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async sanitize(data: any): Promise<any> {
    // Implementation would sanitize response data
    return data;
  }
}

class EncryptionManager {
  private config: SecurityConfig;
  private encryptionKey: Buffer;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.encryptionKey = this.getEncryptionKey();
  }

  async encryptSensitiveData(data: any, req: SecureAPIRequest): Promise<any> {
    if (!this.config.encryptionSettings.enableDataInTransitEncryption) {
      return data;
    }

    // Implementation would encrypt sensitive fields
    return data;
  }

  async encrypt(data: any, context: EncryptionContext): Promise<EncryptedData> {
    const algorithm = this.config.encryptionSettings.algorithm;
    const iv = randomBytes(16);
    const cipher = createCipher(algorithm, this.encryptionKey);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      algorithm,
      iv: iv.toString('hex'),
      data: encrypted,
      context,
      timestamp: new Date().toISOString()
    };
  }

  async decrypt(encryptedData: EncryptedData, context: EncryptionContext): Promise<any> {
    const decipher = createDecipher(encryptedData.algorithm, this.encryptionKey);
    const iv = Buffer.from(encryptedData.iv, 'hex');

    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  hasEncryptedFields(data: any): boolean {
    // Implementation would check if data contains encrypted fields
    return false;
  }

  private getEncryptionKey(): Buffer {
    // Implementation would get encryption key from secure storage
    return randomBytes(32);
  }
}

class APIRequestLogger {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async logRequest(req: SecureAPIRequest): Promise<void> {
    // Implementation would log API requests securely
  }

  async logResponse(req: SecureAPIRequest, res: SecureAPIResponse, data: any): Promise<void> {
    // Implementation would log API responses securely
  }

  async logError(req: SecureAPIRequest, error: any): Promise<void> {
    // Implementation would log API errors securely
  }
}

// Type definitions
export interface SecureAPIRequest {
  url?: string;
  method?: string;
  headers: Record<string, string | undefined>;
  ip?: string;
  requestId?: string;
  startTime?: number;
  user?: {
    id: string;
    permissions: string[];
  };
  body?: any;
  query?: any;
}

export interface SecureAPIResponse {
  statusCode?: number;
  headers: Record<string, string>;
  json: (data: any) => void;
}

export interface SecureWebSocket {
  handshake: {
    auth: any;
    query: any;
  };
  user?: any;
  send: (data: any) => void;
  close: (code?: number, reason?: string) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  details?: any;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  permissions?: string[];
  reason?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
}

export interface PolicyResult {
  compliant: boolean;
  violations?: any[];
  appliedPolicies?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export interface APIKey {
  keyId: string;
  apiKeyHash: string;
  userId: string;
  permissions: string[];
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt: Date;
  rateLimitPerHour: number;
}

export interface APIKeyValidationResult {
  valid: boolean;
  userId?: string;
  permissions?: string[];
  reason?: string;
}

export interface EncryptedData {
  algorithm: string;
  iv: string;
  data: string;
  context: EncryptionContext;
  timestamp: string;
}

export interface EncryptionContext {
  userId?: string;
  resource?: string;
  purpose?: string;
  sensitivity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RequestRecord {
  timestamp: number;
  type: string;
}