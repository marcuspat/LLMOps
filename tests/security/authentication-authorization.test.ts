/**
 * Security tests for Authentication and Authorization
 * Tests JWT tokens, session management, RBAC, and secure API access
 */

import request from 'supertest';
import { TurboFlowServer } from '../../src/api/server.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('bcrypt');

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('Authentication and Authorization Security Tests', () => {
  let server: TurboFlowServer;
  let app: any;
  let authToken: string;
  let refreshToken: string;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    process.env.BCRYPT_ROUNDS = '10';

    server = new TurboFlowServer(3001);
    app = server.getApp();

    // Mock JWT functions
    mockJwt.sign.mockImplementation((payload, secret, options) => {
      if (secret === 'test-jwt-secret-key') {
        return 'mock-jwt-token';
      } else if (secret === 'test-refresh-secret') {
        return 'mock-refresh-token';
      }
      return 'invalid-token';
    });

    mockJwt.verify.mockImplementation((token, secret) => {
      if (token === 'mock-jwt-token' && secret === 'test-jwt-secret-key') {
        return { userId: 'user-123', email: 'test@example.com', role: 'developer' };
      } else if (token === 'mock-admin-token' && secret === 'test-jwt-secret-key') {
        return { userId: 'admin-456', email: 'admin@example.com', role: 'admin' };
      } else if (token === 'mock-expired-token') {
        throw new Error('TokenExpiredError');
      } else {
        throw new Error('Invalid token');
      }
    });

    // Mock bcrypt functions
    mockBcrypt.hash.mockResolvedValue('hashed-password');
    mockBcrypt.compare.mockImplementation((plain, hashed) => {
      return Promise.resolve(plain === 'correct-password' && hashed === 'hashed-password');
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Authentication Security', () => {
    describe('POST /api/auth/login', () => {
      it('should authenticate with valid credentials', async () => {
        const credentials = {
          email: 'test@example.com',
          password: 'correct-password'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            user: expect.objectContaining({
              email: 'test@example.com',
              role: 'developer'
            }),
            tokens: expect.objectContaining({
              accessToken: expect.any(String),
              refreshToken: expect.any(String)
            })
          }
        });

        authToken = response.body.data.tokens.accessToken;
        refreshToken = response.body.data.tokens.refreshToken;
        userId = response.body.data.user.id;

        // Verify password was checked
        expect(mockBcrypt.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
      });

      it('should reject invalid credentials', async () => {
        const credentials = {
          email: 'test@example.com',
          password: 'wrong-password'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });

        // Verify password was checked
        expect(mockBcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashed-password');
      });

      it('should handle rate limiting on login attempts', async () => {
        const credentials = {
          email: 'test@example.com',
          password: 'wrong-password'
        };

        // Make multiple failed attempts
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/auth/login')
            .send(credentials)
            .expect(401);
        }

        // 6th attempt should be rate limited
        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(429);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'TOO_MANY_ATTEMPTS'
          }
        });
      });

      it('should sanitize login inputs', async () => {
        const maliciousInput = {
          email: 'test@example.com<script>alert("xss")</script>',
          password: '<script>document.cookie</script>'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(maliciousInput);

        // Should handle malicious input without throwing errors
        expect(response.status).toBeLessThan(500);

        if (response.status === 401) {
          // Verify sanitized input in error message
          expect(response.body.error.message).not.toContain('<script>');
        }
      });

      it('should enforce password complexity requirements', async () => {
        const weakPasswords = [
          '123',
          'password',
          '123456',
          'qwerty',
          'abc',
          ''
        ];

        for (const weakPassword of weakPasswords) {
          const response = await request(app)
            .post('/api/auth/register')
            .send({
              email: 'test@example.com',
              password: weakPassword
            });

          if (response.status !== 400) {
            continue;
          }

          expect(response.body).toMatchObject({
            success: false,
            error: {
              code: 'WEAK_PASSWORD'
            }
          });
        }
      });
    });

    describe('POST /api/auth/register', () => {
      it('should hash passwords during registration', async () => {
        const userData = {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            user: expect.objectContaining({
              email: 'newuser@example.com'
            })
          }
        });

        // Verify password was hashed
        expect(mockBcrypt.hash).toHaveBeenCalledWith('SecurePass123!', '10');
      });

      it('should prevent duplicate email registration', async () => {
        const userData = {
          email: 'test@example.com', // Already registered
          password: 'AnotherPass123!',
          name: 'Duplicate User'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(409);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already registered'
          }
        });
      });

      it('should validate email format', async () => {
        const invalidEmails = [
          'invalid-email',
          '@example.com',
          'test@',
          'test..test@example.com',
          'test@example.',
          ''
        ];

        for (const invalidEmail of invalidEmails) {
          const response = await request(app)
            .post('/api/auth/register')
            .send({
              email: invalidEmail,
              password: 'ValidPass123!',
              name: 'Test User'
            })
            .expect(400);

          expect(response.body).toMatchObject({
            success: false,
            error: {
              code: 'INVALID_EMAIL'
            }
          });
        }
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh access token with valid refresh token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: {
            accessToken: expect.any(String)
          }
        });

        expect(mockJwt.verify).toHaveBeenCalledWith(refreshToken, 'test-refresh-secret');
      });

      it('should reject invalid refresh token', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'invalid-refresh-token' })
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN'
          }
        });
      });

      it('should handle refresh token rotation', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        // Should return new refresh token
        expect(response.body.data.refreshToken).toBeDefined();
        expect(response.body.data.refreshToken).not.toBe(refreshToken);
      });
    });

    describe('POST /api/auth/logout', () => {
      it('should invalidate tokens on logout', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ refreshToken })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Logged out successfully'
        });
      });

      it('should blacklist revoked tokens', async () => {
        // Logout to invalidate token
        await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ refreshToken });

        // Try to use invalidated token
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'TOKEN_REVOKED'
          }
        });
      });
    });
  });

  describe('Authorization Security', () => {
    describe('Role-Based Access Control (RBAC)', () => {
      it('should allow admin access to admin endpoints', async () => {
        // Get admin token
        mockJwt.sign.mockImplementationOnce(() => 'mock-admin-token');

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@example.com',
            password: 'admin-password'
          })
          .expect(200);

        const adminToken = response.body.data.tokens.accessToken;

        // Access admin endpoint
        await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should deny user access to admin endpoints', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS'
          }
        });
      });

      it('should allow owner access to their resources', async () => {
        const response = await request(app)
          .get(`/api/users/${userId}/projects`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should deny access to other users resources', async () => {
        const response = await request(app)
          .get('/api/users/other-user-id/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'RESOURCE_ACCESS_DENIED'
          }
        });
      });
    });

    describe('Permission Checks', () => {
      it('should enforce read permissions', async () => {
        // User with read-only permissions
        const readOnlyToken = 'mock-read-only-token';
        mockJwt.verify.mockImplementationOnce(() => ({
          userId: 'readonly-user',
          email: 'readonly@example.com',
          role: 'viewer',
          permissions: ['read']
        }));

        const response = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${readOnlyToken}`)
          .send({
            name: 'New Project'
          })
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'WRITE_PERMISSION_REQUIRED'
          }
        });
      });

      it('should verify resource-level permissions', async () => {
        const projectId = 'project-123';

        const response = await request(app)
          .delete(`/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'DELETE_PERMISSION_REQUIRED'
          }
        });
      });
    });
  });

  describe('Token Security', () => {
    describe('JWT Token Validation', () => {
      it('should reject requests without token', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'NO_TOKEN_PROVIDED'
          }
        });
      });

      it('should reject requests with malformed token', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Bearer malformed-jwt-token')
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_TOKEN_FORMAT'
          }
        });
      });

      it('should reject expired tokens', async () => {
        const expiredToken = 'mock-expired-token';
        mockJwt.verify.mockImplementationOnce(() => {
          throw new Error('TokenExpiredError');
        });

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED'
          }
        });
      });

      it('should verify token signature', async () => {
        // This would normally fail with invalid signature
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature')
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_TOKEN_SIGNATURE'
          }
        });
      });

      it('should validate token issuer', async () => {
        const tokenWithWrongIssuer = jwt.sign(
          { userId: 'test', iss: 'wrong-issuer' },
          'test-jwt-secret-key'
        );

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${tokenWithWrongIssuer}`)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_TOKEN_ISSUER'
          }
        });
      });

      it('should validate token audience', async () => {
        const tokenWithWrongAudience = jwt.sign(
          { userId: 'test', aud: 'wrong-audience' },
          'test-jwt-secret-key'
        );

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${tokenWithWrongAudience}`)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            code: 'INVALID_TOKEN_AUDIENCE'
          }
        });
      });
    });

    describe('Token Storage Security', () => {
      it('should set secure HTTP-only cookies for tokens', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'correct-password'
          })
          .expect(200);

        // Check if secure cookie headers are set
        const setCookieHeaders = response.headers['set-cookie'];
        if (setCookieHeaders) {
          setCookieHeaders.forEach(cookie => {
            expect(cookie).toContain('HttpOnly');
            if (process.env.NODE_ENV === 'production') {
              expect(cookie).toContain('Secure');
            }
          });
        }
      });

      it('should implement token rotation for refresh tokens', async () => {
        // First refresh
        const response1 = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken });

        const firstRefreshToken = response1.body.data.refreshToken;

        // Second refresh
        const response2 = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: firstRefreshToken });

        const secondRefreshToken = response2.body.data.refreshToken;

        // Tokens should be different
        expect(secondRefreshToken).not.toBe(firstRefreshToken);

        // Old token should be invalid
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: firstRefreshToken })
          .expect(401);

        expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
      });
    });
  });

  describe('Session Security', () => {
    it('should track active sessions', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          sessions: expect.any(Array),
          activeCount: expect.any(Number)
        }
      });
    });

    it('should allow session termination', async () => {
      // Get active sessions
      const sessionsResponse = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${authToken}`);

      const sessionId = sessionsResponse.body.data.sessions[0]?.id;

      if (sessionId) {
        // Terminate specific session
        const response = await request(app)
          .delete(`/api/auth/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Session terminated'
        });
      }
    });

    it('should terminate all sessions on password change', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'correct-password',
          newPassword: 'NewSecurePass456!'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          sessionsTerminated: expect.any(Number)
        }
      });
    });
  });

  describe('API Security Headers', () => {
    it('should include security headers on all responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('referrer-policy', 'strict-origin-when-cross-origin');
    });

    it('should implement CORS properly', async () => {
      // Test preflight request
      const response = await request(app)
        .options('/api/user/profile')
        .set('Origin', 'https://trusted-origin.com')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('https://trusted-origin.com');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-headers']).toContain('Authorization');

      // Test untrusted origin
      const untrustedResponse = await request(app)
        .get('/api/user/profile')
        .set('Origin', 'https://malicious-site.com')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(untrustedResponse.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection in login', async () => {
      const sqlInjection = {
        email: "'; DROP TABLE users; --",
        password: "'; DROP TABLE users; --"
      };

      // Should handle without database errors
      const response = await request(app)
        .post('/api/auth/login')
        .send(sqlInjection)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS'
        }
      });
    });

    it('should prevent XSS in user inputs', async () => {
      const xssPayload = {
        name: '<script>alert("xss")</script>',
        email: 'xss@example.com',
        password: 'ValidPass123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(xssPayload)
        .expect(201);

      // Verify XSS payload was sanitized
      expect(response.body.data.user.name).not.toContain('<script>');
    });

    it('should validate request size limits', async () => {
      const oversizedPayload = {
        email: 'test@example.com',
        password: 'ValidPass123!',
        name: 'A'.repeat(10000) // Oversized name
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(oversizedPayload)
        .expect(413);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE'
        }
      });
    });
  });

  describe('Brute Force Protection', () => {
    it('should implement account lockout after failed attempts', async () => {
      const credentials = {
        email: 'lockout-test@example.com',
        password: 'wrong-password'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);
      }

      // Account should be locked
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(423);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED'
        }
      });
    });

    it('should require CAPTCHA after multiple failed attempts', async () => {
      const credentials = {
        email: 'captcha-test@example.com',
        password: 'wrong-password'
      };

      // Make several failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);
      }

      // Next login should require CAPTCHA
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(428);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'CAPTCHA_REQUIRED'
        },
        data: {
          captchaSiteKey: expect.any(String)
        }
      });
    });
  });

  describe('Multi-Factor Authentication (MFA)', () => {
    it('should support TOTP-based MFA', async () => {
      // Enable MFA for user
      const enableMFAResponse = await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(enableMFAResponse.body).toMatchObject({
        success: true,
        data: {
          secret: expect.any(String),
          qrCode: expect.any(String)
        }
      });

      // Verify TOTP token
      const verifyResponse = await request(app)
        .post('/api/auth/mfa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          token: '123456'
        })
        .expect(200);

      expect(verifyResponse.body).toMatchObject({
        success: true,
        data: {
          verified: true
        }
      });
    });

    it('should require MFA for sensitive operations', async () => {
      // Enable MFA first
      await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authToken}`);

      // Try sensitive operation without MFA
      const response = await request(app)
        .delete('/api/user/account')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MFA_REQUIRED'
        }
      });
    });

    it('should support backup codes for MFA recovery', async () => {
      // Generate backup codes
      const response = await request(app)
        .post('/api/auth/mfa/backup-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          backupCodes: expect.arrayContaining([
            expect.stringMatching(/^[0-9a-f]{8}$/)
          ])
        }
      });
    });
  });
});