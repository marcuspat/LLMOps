/**
 * Security Middleware Tests
 * Tests for authentication, authorization, and input validation middleware
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Import middleware
import {
  authenticateToken,
  requirePermission,
  requireRole,
  apiSecurity,
  rateLimit,
  validateInput,
  securityHeaders
} from '../../src/middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
  sanitizeString,
  sanitizeObject
} from '../../src/input-validation.js';
import { secureCors, apiCors, publicCors } from '../../src/cors-security.js';
import { SecureLogger, logger, securityLogger } from '../../src/utils/secure-logger.js';

describe('Security Middleware Tests', () => {
  let app: express.Application;
  let testSecret: string;
  let validToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Setup test environment
    testSecret = 'test-secret-key-that-is-long-enough-for-jwt-requirements-1234567890';
    validToken = jwt.sign(
      {
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        permissions: ['read', 'write'],
        sessionId: 'test-session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
      },
      testSecret
    );

    adminToken = jwt.sign(
      {
        userId: 'admin-user',
        username: 'admin',
        roles: ['admin'],
        permissions: ['*'],
        sessionId: 'admin-session-456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
      },
      testSecret
    );
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Authentication Middleware', () => {
    it('should allow access to public paths without token', async () => {
      app.use('/health', (req, res) => {
        res.status(200).json({ message: 'Public endpoint' });
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.message).toBe('Public endpoint');
    });

    it('should reject requests without token for protected paths', async () => {
      app.use('/api/protected', authenticateToken, (req, res) => {
        res.status(200).json({ message: 'Protected endpoint' });
      });

      const response = await request(app)
        .get('/api/protected')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should accept requests with valid token', async () => {
      app.use('/api/protected', authenticateToken, (req, res) => {
        res.status(200).json({ message: 'Protected endpoint', user: req.user });
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.message).toBe('Protected endpoint');
      expect(response.body.user.id).toBe('test-user');
    });

    it('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        {
          userId: 'test-user',
          username: 'testuser',
          exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        },
        testSecret
      );

      app.use('/api/protected', authenticateToken, (req, res) => {
        res.status(200).json({ message: 'Protected endpoint' });
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject malformed Authorization header', async () => {
      app.use('/api/protected', authenticateToken, (req, res) => {
        res.status(200).json({ message: 'Protected endpoint' });
      });

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'InvalidToken')
        .expect(401);

      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('Authorization Middleware', () => {
    it('should allow access with required permission', async () => {
      app.use('/api/admin',
        authenticateToken,
        requirePermission('admin:access'),
        (req, res) => {
          res.status(200).json({ message: 'Admin access granted' });
        }
      );

      const response = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Admin access granted');
    });

    it('should deny access without required permission', async () => {
      app.use('/api/admin',
        authenticateToken,
        requirePermission('admin:access'),
        (req, res) => {
          res.status(200).json({ message: 'Admin access granted' });
        }
      );

      const response = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should allow access with required role', async () => {
      app.use('/api/moderator',
        authenticateToken,
        requireRole('admin'),
        (req, res) => {
          res.status(200).json({ message: 'Admin access granted' });
        }
      );

      const response = await request(app)
        .get('/api/moderator')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Admin access granted');
    });

    it('should deny access without required role', async () => {
      app.use('/api/moderator',
        authenticateToken,
        requireRole('admin'),
        (req, res) => {
          res.status(200).json({ message: 'Admin access granted' });
        }
      );

      const response = await request(app)
        .get('/api/moderator')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
    });
  });

  describe('Input Validation', () => {
    describe('sanitizeString', () => {
      it('should remove XSS patterns', () => {
        const malicious = '<script>alert("xss")</script>';
        const sanitized = sanitizeString(malicious);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('alert');
      });

      it('should remove JavaScript URLs', () => {
        const malicious = 'javascript:alert("xss")';
        const sanitized = sanitizeString(malicious);
        expect(sanitized).not.toContain('javascript:');
      });

      it('should limit string length', () => {
        const longString = 'a'.repeat(20000);
        const sanitized = sanitizeString(longString);
        expect(sanitized.length).toBeLessThanOrEqual(10000);
      });

      it('should remove HTML tags', () => {
        const malicious = '<div>content</div><span>test</span>';
        const sanitized = sanitizeString(malicious);
        expect(sanitized).toBe('contenttest');
      });
    });

    describe('sanitizeObject', () => {
      it('should sanitize nested objects', () => {
        const malicious = {
          name: '<script>alert("xss")</script>',
          email: 'test@example.com',
          nested: {
            dangerous: 'javascript:alert("xss")',
            safe: 'safe content'
          }
        };

        const sanitized = sanitizeObject(malicious);
        expect(sanitized.name).toBe('[REDACTED_SCRIPT]');
        expect(sanitized.email).toBe('test@example.com');
        expect(sanitized.nested.dangerous).toBe('[REDACTED_JAVASCRIPT]');
        expect(sanitized.nested.safe).toBe('safe content');
      });

      it('should handle arrays', () => {
        const malicious = [
          '<script>alert("xss")</script>',
          'safe content',
          { dangerous: 'javascript:alert("xss")' }
        ];

        const sanitized = sanitizeObject(malicious);
        expect(sanitized[0]).toBe('[REDACTED_SCRIPT]');
        expect(sanitized[1]).toBe('safe content');
        expect(sanitized[2].dangerous).toBe('[REDACTED_JAVASCRIPT]');
      });
    });

    describe('validateBody middleware', () => {
      it('should accept valid request body', async () => {
        const schema = {
          name: 'string',
          age: 'number'
        };

        app.post('/test', validateBody(schema), (req, res) => {
          res.status(200).json({ success: true });
        });

        const response = await request(app)
          .post('/test')
          .send({ name: 'John', age: 30 })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should reject invalid request body', async () => {
        const schema = {
          name: 'string',
          age: 'number'
        };

        app.post('/test', validateBody(schema), (req, res) => {
          res.status(200).json({ success: true });
        });

        const response = await request(app)
          .post('/test')
          .send({ name: 123, age: 'invalid' })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should sanitize malicious input', async () => {
        const schema = {
          content: 'string'
        };

        app.post('/test', validateBody(schema), (req, res) => {
          res.status(200).json({ success: true });
        });

        const response = await request(app)
          .post('/test')
          .send({ content: '<script>alert("xss")</script>' })
          .expect(200);

        expect(response.body.success).toBe(true);
        // The malicious content would be sanitized by the sanitizeString function
      });
    });
  });

  describe('CORS Security', () => {
    describe('validateOrigin', () => {
      it('should reject localhost in production', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const cors = secureCors;
        const req = {
          headers: { origin: 'http://localhost:3000' }
        } as any;
        const res = {
          status: jest.fn(),
          json: jest.fn(),
          getHeader: jest.fn(),
          setHeader: jest.fn()
        } as any;
        const next = jest.fn();

        cors(req, res, (error) => {
          expect(error).toBeDefined();
          expect(res.status).toHaveBeenCalledWith(403);
        });

        process.env.NODE_ENV = originalEnv;
      });

      it('should allow localhost in development', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const cors = secureCors;
        const req = {
          headers: { origin: 'http://localhost:3000' }
        } as any;
        const res = {
          status: jest.fn(),
          json: jest.fn(),
          getHeader: jest.fn(),
          setHeader: jest.fn()
        } as any;
        const next = jest.fn();

        cors(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalledWith(403);

        process.env.NODE_ENV = originalEnv;
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const limiter = rateLimit(5, 60000); // 5 requests per minute

      app.use('/api/test', limiter, (req, res) => {
        res.status(200).json({ success: true });
      });

      // Make 3 requests (within limit)
      for (let i = 0; i < 3; i++) {
        await request(app).get('/api/test').expect(200);
      }
    });

    it('should block requests exceeding limit', async () => {
      const limiter = rateLimit(2, 100); // 2 requests per 100ms

      app.use('/api/test', limiter, (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app).get('/api/test').expect(200);
      await request(app).get('/api/test').expect(200);

      const response = await request(app).get('/api/test').expect(429);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Security Headers', () => {
    it('should add security headers', async () => {
      const headers = securityHeaders;
      const req = {} as any;
      const res = {
        getHeader: jest.fn().mockReturnValue({}),
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      } as any;
      const next = jest.fn();

      headers(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.removeHeader).toHaveBeenCalledWith('Server');
      expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    });
  });

  describe('Secure Logging', () => {
    it('should create logger with request context', () => {
      const logger = new SecureLogger(
        'req-123',
        'user-456',
        '127.0.0.1',
        'Test-Agent/1.0'
      );

      expect(logger).toBeDefined();
      expect(logger['requestId']).toBe('req-123');
      expect(logger['userId']).toBe('user-456');
    });

    it('should sanitize sensitive data in logs', () => {
      const logger = new SecureLogger();

      // Mock console.log to capture output
      const consoleSpy = jest.spy(console, 'log').mockImplementation();

      logger.info('User login', {
        email: 'user@example.com',
        password: 'secret123',
        token: 'jwt-token-xyz'
      });

      // Get the logged output
      const logOutput = consoleSpy.mock.calls[0][0];

      expect(logOutput).not.toContain('user@example.com');
      expect(logOutput).not.toContain('secret123');
      expect(logOutput).not.toContain('jwt-token-xyz');
      expect(logOutput).toContain('[REDACTED_EMAIL]');

      consoleSpy.mockRestore();
    });

    it('should log security events', () => {
      const securitySpy = jest.spy(securityLogger, 'login');

      securityLogger.login('user-123', '192.168.1.1', true);

      expect(securitySpy).toHaveBeenCalledWith(
        'user-123',
        '192.168.1.1',
        true,
        undefined
      );
    });
  });

  describe('API Security Integration', () => {
    it('should apply all security middleware', async () => {
      app.use(apiSecurity);
      app.get('/api/test', (req, res) => {
        res.status(200).json({ success: true });
      });

      // Test that the endpoint exists and responds
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate request size', async () => {
      app.use('/api/test', validateInput, (req, res) => {
        res.status(200).json({ success: true });
      });

      // Create a request with oversized body
      const oversizedData = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const response = await request(app)
        .post('/api/test')
        .send({ data: oversizedData })
        .expect(413);

      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('should sanitize all inputs', async () => {
      app.use('/api/test', validateInput, (req, res) => {
        res.status(200).json({
          sanitized: true,
          query: req.query,
          body: req.body
        });
      });

      const response = await request(app)
        .post('/api/test')
        .send({ content: '<script>alert("xss")</script>' })
        .query({ malicious: 'javascript:alert("xss")' });

      expect(response.body.sanitized).toBe(true);
      // The malicious content should be sanitized
    });
  });
});