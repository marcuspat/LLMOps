/**
 * Input Validation Security Tests
 * Tests for input sanitization, validation, and XSS prevention
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { z } from 'zod';
import express from 'express';
import request from 'supertest';
import {
  validateBody,
  validateQuery,
  validateParams,
  validateInput,
  commonSchemas,
  sanitizeString,
  sanitizeObject,
  xssPatterns,
  sqlInjectionPatterns
} from '../../src/input-validation.js';

describe('Input Validation Security Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
  });

  describe('String Sanitization', () => {
    it('should remove script tags', () => {
      const malicious = '<script>alert("xss")</script>';
      const sanitized = sanitizeString(malicious);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).not.toContain('xss');
    });

    it('should remove JavaScript URLs', () => {
      const malicious = 'javascript:alert("xss")';
      const sanitized = sanitizeString(malicious);
      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove data URLs with JavaScript', () => {
      const malicious = 'data:text/html,<script>alert("xss")</script>';
      const sanitized = sanitizeString(malicious);
      expect(sanitized).not.toContain('data:text/html');
    });

    it('should remove VBScript', () => {
      const malicious = 'vbscript:msgbox("xss")';
      const sanitized = sanitizeString(malicious);
      expect(sanitized).not.toContain('vbscript:');
    });

    it('should handle HTML entities', () => {
      const malicious = '&lt;script&gt;alert("xss")&lt;/script&gt;';
      const sanitized = sanitizeString(malicious);
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove on* event handlers', () => {
      const malicious = '<div onclick="alert(\'xss\')">Click me</div>';
      const sanitized = sanitizeString(malicious);
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove iframe tags', () => {
      const malicious = '<iframe src="javascript:alert(\'xss\')"></iframe>';
      const sanitized = sanitizeString(malicious);
      expect(sanitized).not.toContain('<iframe');
    });

    it('should remove object and embed tags', () => {
      const malicious = '<object data="malicious.swf"></object><embed src="malicious.swf">';
      const sanitized = sanitizeString(malicious);
      expect(sanitized).not.toContain('<object');
      expect(sanitized).not.toContain('<embed');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(15000);
      const sanitized = sanitizeString(longString);
      expect(sanitized.length).toBeLessThanOrEqual(10000);
    });

    it('should preserve safe content', () => {
      const safe = 'This is safe content with numbers 123 and symbols !@#$%';
      const sanitized = sanitizeString(safe);
      expect(sanitized).toBe(safe);
    });
  });

  describe('Object Sanitization', () => {
    it('should sanitize nested objects', () => {
      const malicious = {
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
        profile: {
          bio: 'javascript:alert("xss")',
          interests: ['<div>safe</div>', '<img src=x onerror=alert(1)>'],
          social: {
            twitter: '@safeuser',
            website: 'javascript:void(0)'
          }
        }
      };

      const sanitized = sanitizeObject(malicious);

      expect(sanitized.name).toBe('[REDACTED_SCRIPT]');
      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.profile.bio).toBe('[REDACTED_JAVASCRIPT]');
      expect(sanitized.profile.interests[0]).toBe('<div>safe</div>');
      expect(sanitized.profile.interests[1]).toBe('[REDACTED_IMG]');
      expect(sanitized.profile.social.twitter).toBe('@safeuser');
      expect(sanitized.profile.social.website).toBe('[REDACTED_JAVASCRIPT]');
    });

    it('should handle arrays of objects', () => {
      const malicious = [
        { name: '<script>alert(1)</script>', id: 1 },
        { name: 'safe', id: 2 },
        { nested: { dangerous: '<img src=x onerror=alert(1)>' }, id: 3 }
      ];

      const sanitized = sanitizeObject(malicious);

      expect(sanitized[0].name).toBe('[REDACTED_SCRIPT]');
      expect(sanitized[1].name).toBe('safe');
      expect(sanitized[2].nested.dangerous).toBe('[REDACTED_IMG]');
    });

    it('should handle null and undefined values', () => {
      const data = {
        nullValue: null,
        undefinedValue: undefined,
        safeValue: 'safe content'
      };

      const sanitized = sanitizeObject(data);

      expect(sanitized.nullValue).toBe(null);
      expect(sanitized.undefinedValue).toBe(undefined);
      expect(sanitized.safeValue).toBe('safe content');
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      expect(() => sanitizeObject(obj)).not.toThrow();
    });
  });

  describe('Zod Schema Validation', () => {
    it('should validate with common schemas', () => {
      expect(commonSchemas.email.parse('test@example.com')).toBe('test@example.com');
      expect(commonSchemas.password.parse('ValidPass123!')).toBe('ValidPass123!');
      expect(commonSchemas.id.parse(123)).toBe(123);
      expect(commonSchemas.uuid.parse('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'plainaddress',
        '@missing-local.org',
        'user@.com',
        'user@.com',
        'user..name@example.com',
        'user@name@example..com'
      ];

      for (const email of invalidEmails) {
        expect(() => commonSchemas.email.parse(email)).toThrow();
      }
    });

    it('should enforce password complexity', () => {
      const weakPasswords = [
        'password',
        '12345678',
        'Password',
        'password123',
        'PASSWORD123',
        'pass123!',
        'SHORT1!',
        'toolongpassword1234567890!'
      ];

      for (const password of weakPasswords) {
        expect(() => commonSchemas.password.parse(password)).toThrow();
      }

      expect(() => commonSchemas.password.parse('ValidPass123!')).not.toThrow();
    });

    it('should validate safe HTML content', () => {
      const safeHtml = '<p>This is <strong>safe</strong> content</p>';
      expect(commonSchemas.safeHtml.parse(safeHtml)).toBe(safeHtml);

      const dangerousHtml = '<script>alert("xss")</script><p>content</p>';
      expect(() => commonSchemas.safeHtml.parse(dangerousHtml)).toThrow();
    });
  });

  describe('Middleware Body Validation', () => {
    it('should accept valid request body', async () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().min(0)
      });

      app.post('/test', validateBody(schema), (req, res) => {
        res.status(200).json({ success: true, data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({ name: 'John', age: 30 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('John');
      expect(response.body.data.age).toBe(30);
    });

    it('should reject invalid request body', async () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().min(0)
      });

      app.post('/test', validateBody(schema), (req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({ name: '', age: -5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should sanitize malicious content in body', async () => {
      const schema = z.object({
        content: z.string(),
        metadata: z.object({
          description: z.string().optional()
        }).optional()
      });

      app.post('/test', validateBody(schema), (req, res) => {
        res.status(200).json({ success: true, data: req.body });
      });

      const maliciousData = {
        content: '<script>alert("xss")</script>',
        metadata: {
          description: 'javascript:alert("xss")'
        }
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousData)
        .expect(200);

      expect(response.body.success).toBe(true);
      // The malicious content should be sanitized by the middleware
    });

    it('should handle array validation', async () => {
      const schema = z.object({
        items: z.array(z.object({
          id: z.number(),
          name: z.string()
        }))
      });

      app.post('/test', validateBody(schema), (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/test')
        .send({
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' }
          ]
        })
        .expect(200);

      await request(app)
        .post('/test')
        .send({ items: 'not an array' })
        .expect(400);
    });
  });

  describe('Middleware Query Validation', () => {
    it('should validate query parameters', async () => {
      const schema = z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(10)
      });

      app.get('/test', validateQuery(schema), (req, res) => {
        res.status(200).json({ success: true, query: req.query });
      });

      const response = await request(app)
        .get('/test?page=2&limit=20')
        .expect(200);

      expect(response.body.query.page).toBe(2);
      expect(response.body.query.limit).toBe(20);
    });

    it('should reject invalid query parameters', async () => {
      const schema = z.object({
        page: z.coerce.number().min(1),
        limit: z.coerce.number().min(1).max(100)
      });

      app.get('/test', validateQuery(schema), (req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .get('/test?page=0&limit=200')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Middleware Params Validation', () => {
    it('should validate route parameters', async () => {
      const schema = z.object({
        id: z.string().uuid()
      });

      app.get('/test/:id', validateParams(schema), (req, res) => {
        res.status(200).json({ success: true, params: req.params });
      });

      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/test/${validId}`)
        .expect(200);

      expect(response.body.params.id).toBe(validId);
    });

    it('should reject invalid route parameters', async () => {
      const schema = z.object({
        id: z.string().uuid()
      });

      app.get('/test/:id', validateParams(schema), (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .get('/test/invalid-uuid')
        .expect(400);
    });
  });

  describe('Comprehensive Input Validation Middleware', () => {
    it('should validate all request inputs', async () => {
      const schemas = {
        body: z.object({
          name: z.string().min(1),
          email: commonSchemas.email
        }),
        query: z.object({
          ref: z.string().optional()
        }),
        params: z.object({
          id: commonSchemas.id
        })
      };

      app.post('/test/:id', validateInput(schemas), (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/test/123')
        .query({ ref: 'source' })
        .send({ name: 'John', email: 'john@example.com' })
        .expect(200);

      await request(app)
        .post('/test/invalid')
        .send({ name: '', email: 'invalid' })
        .expect(400);
    });

    it('should enforce content-type validation', async () => {
      app.post('/test', validateInput({
        body: z.object({
          data: z.string()
        })
      }), (req, res) => {
        res.status(200).json({ success: true });
      });

      // Valid JSON content-type
      await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send({ data: 'test' })
        .expect(200);

      // Invalid content-type
      await request(app)
        .post('/test')
        .set('Content-Type', 'text/plain')
        .send('not json')
        .expect(400);
    });

    it('should validate request size limits', async () => {
      app.use('/test', validateInput({
        body: z.object({
          data: z.string()
        })
      }, { maxBodySize: '1kb' }));

      app.post('/test', (req, res) => {
        res.status(200).json({ success: true });
      });

      // Small payload should pass
      await request(app)
        .post('/test')
        .send({ data: 'small' })
        .expect(200);

      // Large payload should be rejected
      const largeData = 'x'.repeat(2048);
      await request(app)
        .post('/test')
        .send({ data: largeData })
        .expect(413);
    });
  });

  describe('XSS Pattern Detection', () => {
    it('should detect various XSS patterns', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
        '<select onfocus=alert(1) autofocus>',
        '<textarea onfocus=alert(1) autofocus>',
        '<keygen onfocus=alert(1) autofocus>',
        '<video><source onerror="alert(1)">',
        '<audio src=x onerror=alert(1)>',
        '<details open ontoggle=alert(1)>',
        '<marquee onstart=alert(1)>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)'
      ];

      for (const xss of xssAttempts) {
        const sanitized = sanitizeString(xss);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('vbscript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('onfocus=');
      }
    });
  });

  describe('SQL Injection Pattern Detection', () => {
    it('should detect SQL injection attempts', () => {
      const sqlAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        '" OR "1"="1',
        "1'; DELETE FROM users; --",
        "UNION SELECT * FROM passwords",
        "'; INSERT INTO users VALUES ('hacker', 'pass'); --",
        "' AND (SELECT COUNT(*) FROM users) > 0 --",
        "'; EXEC xp_cmdshell('format c:'); --",
        "'; COPY users TO '/tmp/users.csv'; --",
        "' OR 1=1 #",
        '" OR 1=1 --',
        "'; GRANT ALL PRIVILEGES ON *.* TO 'hacker'@'%'; --"
      ];

      for (const sql of sqlAttempts) {
        const sanitized = sanitizeString(sql);
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('--');
        expect(sanitized).not.toContain('/*');
        expect(sanitized).not.toContain('DROP');
        expect(sanitized).not.toContain('UNION');
        expect(sanitized).not.toContain('DELETE');
        expect(sanitized).not.toContain('INSERT');
        expect(sanitized).not.toContain('EXEC');
        expect(sanitized).not.toContain('GRANT');
      }
    });
  });
});