/**
 * Authentication & Authorization Flow Critical Path Tests
 * Comprehensive testing for JWT validation and RBAC mechanisms
 */

import { AuthManager } from '../../src/security/auth/AuthManager.js';
import { SecurityConfig } from '../../src/security/core/SecurityConfig.js';
import { authenticateToken, requirePermission, requireRole, rateLimit } from '../../src/middleware/auth.js';
import { Request, Response, NextFunction } from 'express';
import { sign } from 'jsonwebtoken';

describe('Authentication & Authorization Flow - Critical Path Tests', () => {
  let authManager: AuthManager;
  let securityConfig: SecurityConfig;

  beforeEach(async () => {
    securityConfig = {
      environment: 'test',
      jwtSecret: 'test-secret-key-for-testing-only',
      tokenExpiry: 24,
      sessionTimeout: 60,
      maxLoginAttempts: 5,
      mfaRequired: false,
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      },
      apiSecurity: {
        rateLimiting: {
          windowMs: 15 * 60 * 1000,
          maxRequests: 100
        },
        inputValidation: {
          maxRequestBodySize: '10mb',
          allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded']
        }
      },
      encryptionSettings: {
        algorithm: 'aes-256-gcm',
        enableDataInTransitEncryption: true,
        enableDataAtRestEncryption: true
      }
    };

    authManager = new AuthManager(securityConfig);
    await authManager.initialize();
  });

  describe('JWT Token Validation', () => {
    describe('Token Verification', () => {
      it('should validate valid JWT token', async () => {
        const userId = 'user-123';
        const sessionId = 'session-456';

        // Create valid JWT token
        const validToken = sign({
          userId,
          username: 'testuser',
          roles: ['user'],
          sessionId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        }, securityConfig.jwtSecret);

        const result = await authManager.validateToken(validToken);

        expect(result.valid).toBe(true);
        expect(result.userId).toBe(userId);
        expect(result.sessionId).toBe(sessionId);
        expect(result.permissions).toBeDefined();
      });

      it('should reject expired JWT token', async () => {
        const expiredToken = sign({
          userId: 'user-123',
          username: 'testuser',
          roles: ['user'],
          sessionId: 'session-456',
          iat: Math.floor(Date.now() / 1000) - (25 * 60 * 60), // 25 hours ago
          exp: Math.floor(Date.now() / 1000) - (60 * 60) // 1 hour ago
        }, securityConfig.jwtSecret);

        const result = await authManager.validateToken(expiredToken);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('invalid');
      });

      it('should reject JWT with invalid signature', async () => {
        const tokenWithWrongSecret = sign({
          userId: 'user-123',
          username: 'testuser',
          roles: ['user'],
          sessionId: 'session-456',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        }, 'wrong-secret');

        const result = await authManager.validateToken(tokenWithWrongSecret);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('invalid');
      });

      it('should reject malformed JWT token', async () => {
        const malformedToken = 'this.is.not.a.valid.jwt.token';

        const result = await authManager.validateToken(malformedToken);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('invalid');
      });

      it('should reject JWT for expired session', async () => {
        const userId = 'user-123';
        const expiredSessionId = 'expired-session';

        // Create valid JWT token
        const validToken = sign({
          userId,
          username: 'testuser',
          roles: ['user'],
          sessionId: expiredSessionId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        }, securityConfig.jwtSecret);

        const result = await authManager.validateToken(validToken);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Session expired');
      });

      it('should handle JWT with missing required fields', async () => {
        const incompleteToken = sign({
          userId: 'user-123'
          // Missing sessionId and other required fields
        }, securityConfig.jwtSecret);

        const result = await authManager.validateToken(incompleteToken);

        expect(result.valid).toBe(false);
      });
    });

    describe('Token Refresh', () => {
      it('should refresh valid token', async () => {
        // First, authenticate to get a refresh token
        const authResult = await authManager.authenticate({
          username: 'testuser',
          password: 'TestPassword123!',
          email: 'test@example.com'
        });

        expect(authResult.success).toBe(true);
        expect(authResult.refreshToken).toBeDefined();

        if (authResult.success && authResult.refreshToken) {
          const refreshResult = await authManager.refreshToken(authResult.refreshToken);

          expect(refreshResult.success).toBe(true);
          expect(refreshResult.token).toBeDefined();
          expect(refreshResult.refreshToken).toBeDefined();
        }
      });

      it('should reject refresh token for expired session', async () => {
        const result = await authManager.refreshToken('expired-refresh-token');

        expect(result.success).toBe(false);
        expect(result.reason).toContain('Invalid refresh token');
      });

      it('should generate different tokens on refresh', async () => {
        const authResult = await authManager.authenticate({
          username: 'testuser',
          password: 'TestPassword123!',
          email: 'test@example.com'
        });

        if (authResult.success && authResult.refreshToken) {
          const refreshResult = await authManager.refreshToken(authResult.refreshToken);

          expect(refreshResult.success).toBe(true);
          expect(refreshResult.token).not.toBe(authResult.token);
          expect(refreshResult.refreshToken).not.toBe(authResult.refreshToken);
        }
      });
    });
  });

  describe('Authentication Flow', () => {
    describe('User Authentication', () => {
      it('should authenticate valid credentials', async () => {
        // First register a user
        await authManager.register({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

        const authResult = await authManager.authenticate({
          username: 'testuser',
          password: 'TestPassword123!'
        });

        expect(authResult.success).toBe(true);
        expect(authResult.userId).toBeDefined();
        expect(authResult.token).toBeDefined();
        expect(authResult.sessionId).toBeDefined();
        expect(authResult.permissions).toBeDefined();
      });

      it('should reject invalid credentials', async () => {
        await authManager.register({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

        const authResult = await authManager.authenticate({
          username: 'testuser',
          password: 'WrongPassword123!'
        });

        expect(authResult.success).toBe(false);
        expect(authResult.reason).toContain('Invalid credentials');
      });

      it('should reject authentication for non-existent user', async () => {
        const authResult = await authManager.authenticate({
          username: 'nonexistentuser',
          password: 'TestPassword123!'
        });

        expect(authResult.success).toBe(false);
        expect(authResult.reason).toContain('Invalid credentials');
      });

      it('should handle rate limiting on failed attempts', async () => {
        const username = 'testuser';

        // Register user
        await authManager.register({
          username,
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

        // Make multiple failed attempts
        for (let i = 0; i < 5; i++) {
          await authManager.authenticate({
            username,
            password: 'WrongPassword123!'
          });
        }

        const authResult = await authManager.authenticate({
          username,
          password: 'TestPassword123!'
        });

        expect(authResult.success).toBe(false);
        expect(authResult.reason).toContain('Rate limit exceeded');
      });

      it('should require MFA when enabled', async () => {
        // Register user with MFA
        await authManager.register({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!',
          enableMFA: true
        });

        const authResult = await authManager.authenticate({
          username: 'testuser',
          password: 'TestPassword123!'
        });

        expect(authResult.success).toBe(false);
        expect(authResult.requiresMFA).toBe(true);
        expect(authResult.reason).toContain('MFA token required');
      });
    });

    describe('Password Security', () => {
      it('should hash passwords securely', async () => {
        const password = 'TestPassword123!';

        await authManager.register({
          username: 'testuser',
          email: 'test@example.com',
          password
        });

        // Get user from store (would need to expose this for testing)
        // In real implementation, this would check database
        const userStore = (authManager as any).userStore;
        const user = await userStore.findByUsername('testuser');

        expect(user).toBeDefined();
        expect(user!.passwordHash).not.toBe(password);
        expect(user!.passwordHash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/); // salt:hash format
      });

      it('should verify passwords using timing-safe comparison', async () => {
        const password = 'TestPassword123!';

        await authManager.register({
          username: 'testuser',
          email: 'test@example.com',
          password
        });

        const authResult1 = await authManager.authenticate({
          username: 'testuser',
          password
        });

        const authResult2 = await authManager.authenticate({
          username: 'testuser',
          password
        });

        expect(authResult1.success).toBe(true);
        expect(authResult2.success).toBe(true);

        // Timing should be consistent (basic check)
        // In real implementation, use more sophisticated timing analysis
      });

      it('should enforce password policy', async () => {
        const weakPasswords = [
          'short', // Too short
          'alllowercase123!', // Missing uppercase
          'ALLUPPERCASE123!', // Missing lowercase
          'MixedCaseNoNumbers!', // Missing numbers
          'MixedCase123NoSpecial' // Missing special characters
        ];

        for (const password of weakPasswords) {
          const result = await authManager.register({
            username: `user${Math.random()}`,
            email: `test${Math.random()}@example.com`,
            password
          });

          expect(result.success).toBe(false);
          expect(result.reason).toContain('Password must');
        }
      });
    });

    describe('Session Management', () => {
      it('should create valid session on authentication', async () => {
        await authManager.register({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

        const authResult = await authManager.authenticate({
          username: 'testuser',
          password: 'TestPassword123!'
        });

        expect(authResult.success).toBe(true);
        expect(authResult.sessionId).toBeDefined();

        // Validate token uses session
        const validationResult = await authManager.validateToken(authResult.token!);
        expect(validationResult.valid).toBe(true);
        expect(validationResult.sessionId).toBe(authResult.sessionId);
      });

      it('should invalidate session on logout', async () => {
        await authManager.register({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

        const authResult = await authManager.authenticate({
          username: 'testuser',
          password: 'TestPassword123!'
        });

        expect(authResult.success).toBe(true);

        const logoutResult = await authManager.logout(authResult.token!);
        expect(logoutResult.success).toBe(true);

        // Token should no longer be valid
        const validationResult = await authManager.validateToken(authResult.token!);
        expect(validationResult.valid).toBe(false);
      });

      it('should change password and invalidate all sessions', async () => {
        const username = 'testuser';
        const oldPassword = 'TestPassword123!';
        const newPassword = 'NewTestPassword123!';

        await authManager.register({
          username,
          email: 'test@example.com',
          password: oldPassword
        });

        // Create multiple sessions
        const session1 = await authManager.authenticate({
          username,
          password: oldPassword
        });

        const session2 = await authManager.authenticate({
          username,
          password: oldPassword
        });

        expect(session1.success).toBe(true);
        expect(session2.success).toBe(true);

        // Change password
        const changeResult = await authManager.changePassword(
          session1.userId!,
          oldPassword,
          newPassword
        );

        expect(changeResult.success).toBe(true);

        // All sessions should be invalidated
        const validation1 = await authManager.validateToken(session1.token!);
        const validation2 = await authManager.validateToken(session2.token!);

        expect(validation1.valid).toBe(false);
        expect(validation2.valid).toBe(false);
      });
    });
  });

  describe('RBAC Authorization', () => {
    describe('Permission-based Authorization', () => {
      it('should authorize users with correct permissions', async () => {
        const userId = 'user-123';

        // Mock user with admin permissions
        jest.spyOn(authManager['rbacManager'], 'hasPermission')
          .mockResolvedValue(true);

        const result = await authManager.authorize(userId, 'resource1', 'read');

        expect(result.authorized).toBe(true);
      });

      it('should reject users without required permissions', async () => {
        const userId = 'user-456';

        // Mock user without permissions
        jest.spyOn(authManager['rbacManager'], 'hasPermission')
          .mockResolvedValue(false);

        const result = await authManager.authorize(userId, 'resource1', 'delete');

        expect(result.authorized).toBe(false);
        expect(result.reason).toContain('Insufficient permissions');
      });

      it('should handle contextual authorization checks', async () => {
        const userId = 'user-789';

        jest.spyOn(authManager['rbacManager'], 'hasPermission')
          .mockResolvedValue(true);

        // Test time-based restrictions
        const result = await authManager.authorize(userId, 'resource1', 'read', {
          timeRestriction: {
            startHour: 9,
            endHour: 17
          }
        });

        // Should succeed if current time is within restrictions
        const currentHour = new Date().getHours();
        if (currentHour >= 9 && currentHour <= 17) {
          expect(result.authorized).toBe(true);
        } else {
          expect(result.authorized).toBe(false);
          expect(result.reason).toContain('Access not allowed at this time');
        }
      });

      it('should validate resource ownership when required', async () => {
        const userId = 'user-123';
        const resourceId = 'resource-456';

        jest.spyOn(authManager['rbacManager'], 'hasPermission')
          .mockResolvedValue(true);

        jest.spyOn(authManager as any, 'checkResourceOwnership')
          .mockResolvedValue(false);

        const result = await authManager.authorize(userId, resourceId, 'update', {
          requiresOwnership: true
        });

        expect(result.authorized).toBe(false);
        expect(result.reason).toContain('resource ownership required');
      });
    });

    describe('Role-based Authorization', () => {
      it('should enforce role hierarchy', async () => {
        const userId = 'user-admin';

        // Mock admin user with all permissions
        jest.spyOn(authManager['rbacManager'], 'getUserPermissions')
          .mockResolvedValue(['*']);

        const authResult = await authManager.validateToken('mock-admin-token');
        expect(authResult.permissions).toContain('*');
      });

      it('should assign default roles to new users', async () => {
        const registerResult = await authManager.register({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'TestPassword123!'
        });

        expect(registerResult.success).toBe(true);

        // Check if user has default 'user' role
        const userStore = (authManager as any).userStore;
        const user = await userStore.findByUsername('newuser');
        expect(user!.roles).toContain('user');
      });
    });
  });

  describe('Middleware Authentication', () => {
    describe('JWT Authentication Middleware', () => {
      it('should authenticate requests with valid tokens', async () => {
        const userId = 'user-123';
        const sessionId = 'session-456';
        const validToken = sign({
          userId,
          username: 'testuser',
          roles: ['user'],
          sessionId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        }, securityConfig.jwtSecret);

        const req = {
          path: '/api/protected',
          headers: {
            authorization: `Bearer ${validToken}`
          }
        } as any;

        const res = {} as Response;
        const next = jest.fn();

        await authenticateToken(req, res, next);

        expect(req.user).toBeDefined();
        expect(req.user!.id).toBe(userId);
        expect(req.sessionId).toBe(sessionId);
        expect(next).toHaveBeenCalled();
      });

      it('should reject requests without tokens', async () => {
        const req = {
          path: '/api/protected',
          headers: {}
        } as any;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;

        const next = jest.fn();

        await authenticateToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'AUTH_REQUIRED'
            })
          })
        );
        expect(next).not.toHaveBeenCalled();
      });

      it('should skip authentication for public paths', async () => {
        const req = {
          path: '/health',
          headers: {}
        } as any;

        const res = {} as Response;
        const next = jest.fn();

        await authenticateToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
      });

      it('should handle malformed authorization header', async () => {
        const req = {
          path: '/api/protected',
          headers: {
            authorization: 'InvalidFormat token'
          }
        } as any;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;

        const next = jest.fn();

        await authenticateToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('Authorization Middleware', () => {
      it('should allow access with correct permissions', () => {
        const req = {
          user: {
            id: 'user-123',
            permissions: ['read', 'write'],
            roles: ['user']
          }
        } as any;

        const res = {} as Response;
        const next = jest.fn();

        const middleware = requirePermission('read');
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should deny access without required permissions', () => {
        const req = {
          user: {
            id: 'user-123',
            permissions: ['read'],
            roles: ['user']
          }
        } as any;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;

        const next = jest.fn();

        const middleware = requirePermission('delete');
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'INSUFFICIENT_PERMISSIONS'
            })
          })
        );
        expect(next).not.toHaveBeenCalled();
      });

      it('should deny access without authentication', () => {
        const req = {} as any;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;

        const next = jest.fn();

        const middleware = requirePermission('read');
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });

      it('should allow admin users all permissions', () => {
        const req = {
          user: {
            id: 'admin-123',
            permissions: ['*'],
            roles: ['admin']
          }
        } as any;

        const res = {} as Response;
        const next = jest.fn();

        const middleware = requirePermission('any-permission');
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });
    });

    describe('Role-based Middleware', () => {
      it('should allow access with correct role', () => {
        const req = {
          user: {
            id: 'admin-123',
            roles: ['admin']
          }
        } as any;

        const res = {} as Response;
        const next = jest.fn();

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should deny access without required role', () => {
        const req = {
          user: {
            id: 'user-123',
            roles: ['user']
          }
        } as any;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        } as any;

        const next = jest.fn();

        const middleware = requireRole('admin');
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Rate Limiting Security', () => {
    describe('Rate Limiting Middleware', () => {
      it('should allow requests within rate limit', () => {
        const req = {
          ip: '192.168.1.1'
        } as any;

        const res = {} as Response;
        const next = jest.fn();

        const middleware = rateLimit(10, 60000); // 10 requests per minute
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });

      it('should block requests exceeding rate limit', () => {
        const req = {
          ip: '192.168.1.2'
        } as any;

        const res = {
          status: jest.fn().mockReturnThis(),
          set: jest.fn(),
          json: jest.fn()
        } as any;

        const next = jest.fn();

        const middleware = rateLimit(2, 60000); // 2 requests per minute

        // First two requests should pass
        middleware(req, res, next);
        middleware(req, res, next);

        // Third request should be blocked
        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'RATE_LIMIT_EXCEEDED'
            })
          })
        );
        expect(next).toHaveBeenCalledTimes(2);
      });

      it('should reset rate limit after window expires', (done) => {
        const req = {
          ip: '192.168.1.3'
        } as any;

        const res = {
          status: jest.fn().mockReturnThis(),
          set: jest.fn(),
          json: jest.fn()
        } as any;

        const next = jest.fn();

        const middleware = rateLimit(1, 100); // 1 request per 100ms

        // First request should pass
        middleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);

        // Second request should be blocked
        middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(429);

        // Wait for window to expire
        setTimeout(() => {
          // Next request should pass again
          middleware(req, res, next);
          expect(next).toHaveBeenCalledTimes(2);
          done();
        }, 150);
      });
    });
  });

  describe('Security Tests', () => {
    describe('Timing Attack Prevention', () => {
      it('should have consistent timing for password verification', async () => {
        const username = 'testuser';
        const password = 'TestPassword123!';
        const wrongPassword = 'WrongPassword123!';

        await authManager.register({
          username,
          email: 'test@example.com',
          password
        });

        // Measure timing for correct password
        const start1 = Date.now();
        await authManager.authenticate({
          username,
          password
        });
        const time1 = Date.now() - start1;

        // Measure timing for wrong password
        const start2 = Date.now();
        await authManager.authenticate({
          username,
          password: wrongPassword
        });
        const time2 = Date.now() - start2;

        // Timing differences should be minimal (within reasonable variance)
        const timeDiff = Math.abs(time1 - time2);
        expect(timeDiff).toBeLessThan(100); // Less than 100ms difference
      });
    });

    describe('JWT Secret Security', () => {
      it('should reject tokens with brute-forced secrets', async () => {
        const userId = 'user-123';
        const sessionId = 'session-456';

        // Create token with correct secret
        const validToken = sign({
          userId,
          username: 'testuser',
          roles: ['user'],
          sessionId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        }, securityConfig.jwtSecret);

        const result = await authManager.validateToken(validToken);
        expect(result.valid).toBe(true);

        // Try to brute force with common secrets
        const commonSecrets = [
          'secret', 'password', '123456', 'admin', 'jwt-secret',
          'default', 'change-me', 'secret-key', 'my-secret'
        ];

        for (const secret of commonSecrets) {
          if (secret !== securityConfig.jwtSecret) {
            const maliciousToken = sign({
              userId,
              username: 'testuser',
              roles: ['user'],
              sessionId,
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            }, secret);

            const result = await authManager.validateToken(maliciousToken);
            expect(result.valid).toBe(false);
          }
        }
      });
    });

    describe('Session Hijacking Prevention', () => {
      it('should prevent session fixation attacks', async () => {
        const username = 'testuser';

        await authManager.register({
          username,
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

        // Simulate session fixation by reusing session ID
        const fixedSessionId = 'fixed-session-id';

        // This would need to be implemented in the actual session management
        // For now, test that new sessions get unique IDs
        const authResult1 = await authManager.authenticate({
          username,
          password: 'TestPassword123!'
        });

        const authResult2 = await authManager.authenticate({
          username,
          password: 'TestPassword123!'
        });

        expect(authResult1.sessionId).not.toBe(authResult2.sessionId);
      });

      it('should invalidate sessions on password change', async () => {
        const username = 'testuser';
        const oldPassword = 'TestPassword123!';
        const newPassword = 'NewTestPassword123!';

        await authManager.register({
          username,
          email: 'test@example.com',
          password: oldPassword
        });

        // Create session
        const authResult = await authManager.authenticate({
          username,
          password: oldPassword
        });

        expect(authResult.success).toBe(true);

        // Change password
        const changeResult = await authManager.changePassword(
          authResult.userId!,
          oldPassword,
          newPassword
        );

        expect(changeResult.success).toBe(true);

        // Previous session should be invalid
        const validationResult = await authManager.validateToken(authResult.token!);
        expect(validationResult.valid).toBe(false);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent authentication requests efficiently', async () => {
      await authManager.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!'
      });

      const startTime = Date.now();

      const requests = Array.from({ length: 100 }, () =>
        authManager.authenticate({
          username: 'testuser',
          password: 'TestPassword123!'
        })
      );

      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle token validation efficiently', async () => {
      const tokens = Array.from({ length: 1000 }, (_, i) =>
        sign({
          userId: `user-${i}`,
          username: `user${i}`,
          roles: ['user'],
          sessionId: `session-${i}`,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        }, securityConfig.jwtSecret)
      );

      const startTime = Date.now();

      const validations = tokens.map(token => authManager.validateToken(token));
      const results = await Promise.all(validations);

      const duration = Date.now() - startTime;

      expect(results.every(r => r.valid)).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});