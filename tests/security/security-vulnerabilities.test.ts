/**
 * Security Vulnerability Tests
 * Tests to ensure critical security vulnerabilities are patched
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { TurboFlowServer } from '../../src/api/server.js';
import { SecurityValidator } from '../../src/config/SecurityValidator.js';

describe('Security Vulnerability Tests', () => {
  let server: TurboFlowServer;
  const validator = SecurityValidator.getInstance();

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test_jwt_secret_minimum_32_characters_for_testing';
    process.env.WS_ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';

    server = new TurboFlowServer(3001);
    await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('JWT Secret Security (CVSS 7.5)', () => {
    it('should reject requests when JWT_SECRET is not configured', async () => {
      // Temporarily remove JWT secret
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      // Server should fail to start without JWT secret
      expect(() => {
        new TurboFlowServer(3002);
      }).toThrow('JWT_SECRET environment variable is not set');

      // Restore secret
      process.env.JWT_SECRET = originalSecret;
    });

    it('should reject JWT secrets shorter than 32 characters', async () => {
      const shortSecrets = [
        'short',
        '1234567890123456789012345678901', // 31 chars
        'weak_secret',
        'password123'
      ];

      for (const secret of shortSecrets) {
        const validation = validator.validateSecurity();
        if (secret === process.env.JWT_SECRET) {
          // Current test secret should pass
          continue;
        }

        // Temporarily set short secret
        const originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;

        const result = validator.validateSecurity();
        expect(result.isValid).toBe(false);
        expect(result.criticalIssues).toContain(
          expect.stringContaining('JWT_SECRET is too short')
        );

        // Restore secret
        process.env.JWT_SECRET = originalSecret;
      }
    });

    it('should reject common weak JWT secrets', async () => {
      const weakSecrets = [
        'default-secret-change-in-production',
        'secret',
        'jwt_secret',
        'your-secret-key',
        'change-me'
      ];

      for (const weakSecret of weakSecrets) {
        const originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = weakSecret;

        const result = validator.validateSecurity();
        expect(result.isValid).toBe(false);
        expect(result.criticalIssues).toContain(
          expect.stringContaining('appears to be a weak or default value')
        );

        process.env.JWT_SECRET = originalSecret;
      }
    });
  });

  describe('WebSocket Origin Validation (CVSS 7.0)', () => {
    it('should reject WebSocket connections from unauthorized origins', async () => {
      // This test requires WebSocket client setup
      // For now, we'll test the validation logic directly

      const WebSocket = require('ws');
      const wsUrl = 'ws://localhost:3001';

      // Try to connect with unauthorized origin
      const ws = new WebSocket(wsUrl, {
        headers: {
          origin: 'https://malicious-site.com'
        }
      });

      const connectionClosed = new Promise((resolve) => {
        ws.on('close', (code: number, reason: string) => {
          resolve({ code, reason });
        });
      });

      const result = await connectionClosed as any;
      expect(result.code).toBe(1008); // Policy violation
      expect(result.reason).toBe('Invalid origin');
    });

    it('should accept WebSocket connections from authorized origins', async () => {
      const WebSocket = require('ws');
      const wsUrl = 'ws://localhost:3001';

      const ws = new WebSocket(wsUrl, {
        headers: {
          origin: 'http://localhost:3000'
        }
      });

      const connectionOpen = new Promise((resolve) => {
        ws.on('open', () => {
          resolve(true);
          ws.close();
        });

        ws.on('error', () => {
          resolve(false);
        });
      });

      const result = await connectionOpen;
      expect(result).toBe(true);
    });

    it('should reject WebSocket connections when WS_ALLOWED_ORIGINS is not configured', async () => {
      const originalOrigins = process.env.WS_ALLOWED_ORIGINS;
      delete process.env.WS_ALLOWED_ORIGINS;

      const result = validator.validateSecurity();
      expect(result.isValid).toBe(false);
      expect(result.criticalIssues).toContain(
        expect.stringContaining('WS_ALLOWED_ORIGINS is not configured')
      );

      process.env.WS_ALLOWED_ORIGINS = originalOrigins;
    });
  });

  describe('Additional Security Controls', () => {
    it('should have proper security headers', async () => {
      const response = await request(server['app'])
        .get('/health')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should reject requests without proper content-type', async () => {
      await request(server['app'])
        .post('/auth/login')
        .set('Content-Type', 'text/plain')
        .send('invalid')
        .expect(415);
    });

    it('should implement rate limiting', async () => {
      const endpoint = '/health';

      // Make many requests quickly
      const promises = Array.from({ length: 200 }, () =>
        request(server['app']).get(endpoint)
      );

      const results = await Promise.allSettled(promises);
      const rejected = results.filter(r =>
        r.status === 'rejected' ||
        (r.status === 'fulfilled' && r.value.status === 429)
      );

      expect(rejected.length).toBeGreaterThan(0);
    });

    it('should validate CORS configuration', async () => {
      // Test preflight request
      const response = await request(server['app'])
        .options('/api/test')
        .set('Origin', 'https://unauthorized-domain.com')
        .set('Access-Control-Request-Method', 'POST')
        .expect(403); // Should be rejected by CORS
    });
  });

  describe('Environment Security Validation', () => {
    it('should pass security validation in test environment', () => {
      const result = validator.validateSecurity();
      expect(result.isValid).toBe(true);
      expect(result.criticalIssues).toHaveLength(0);
    });

    it('should detect production security requirements', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = validator.validateSecurity();

      // Should warn about HTTPS in production
      expect(result.warnings).toContain(
        expect.stringContaining('HTTPS should be enforced')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should validate database SSL requirement in production', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSSL = process.env.DB_SSL;

      process.env.NODE_ENV = 'production';
      process.env.DB_SSL = 'false';

      const result = validator.validateSecurity();
      expect(result.criticalIssues).toContain(
        expect.stringContaining('Database connections must use SSL')
      );

      process.env.NODE_ENV = originalEnv;
      process.env.DB_SSL = originalSSL;
    });
  });

  describe('Input Validation Security', () => {
    it('should sanitize query parameters', async () => {
      const maliciousQuery = {
        search: '<script>alert("xss")</script>',
        redirect: 'javascript:alert("xss")',
        onclick: 'alert("xss")'
      };

      const response = await request(server['app'])
        .get('/health')
        .query(maliciousQuery)
        .expect(200);

      // The response should not contain unescaped scripts
      expect(response.text).not.toContain('<script>');
      expect(response.text).not.toContain('javascript:');
      expect(response.text).not.toContain('onclick');
    });

    it('should reject oversized request bodies', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB

      await request(server['app'])
        .post('/test')
        .send(largePayload)
        .expect(413);
    });
  });
});