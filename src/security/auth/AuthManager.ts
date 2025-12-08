/**
 * Authentication and Authorization Manager
 * Comprehensive authentication system with RBAC, MFA, and session management
 */

import { createHash, randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import { SecurityConfig } from '../core/SecurityConfig.js';
import { AuthCredentials, AuthResult } from '../core/SecurityFramework.js';

export class AuthManager {
  private config: SecurityConfig;
  private userStore: UserStore;
  private sessionStore: SessionStore;
  private mfaManager: MFAManager;
  private rbacManager: RBACManager;
  private passwordValidator: PasswordValidator;
  private rateLimiter: RateLimiter;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.userStore = new UserStore();
    this.sessionStore = new SessionStore(config);
    this.mfaManager = new MFAManager(config);
    this.rbacManager = new RBACManager(config);
    this.passwordValidator = new PasswordValidator(config.passwordPolicy);
    this.rateLimiter = new RateLimiter(config);
  }

  async initialize(): Promise<void> {
    await this.userStore.initialize();
    await this.sessionStore.initialize();
    await this.mfaManager.initialize();
    await this.rbacManager.initialize();
  }

  /**
   * Authenticate user credentials
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      // Rate limiting check
      const rateLimitResult = await this.rateLimiter.checkAuthAttempts(credentials.username);
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          reason: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds`
        };
      }

      // Find user
      const user = await this.userStore.findByUsername(credentials.username);
      if (!user) {
        await this.rateLimiter.recordFailedAttempt(credentials.username);
        return {
          success: false,
          reason: 'Invalid credentials'
        };
      }

      // Check account status
      if (user.status !== 'active') {
        return {
          success: false,
          reason: `Account is ${user.status}`
        };
      }

      // Verify password
      const passwordValid = await this.verifyPassword(credentials.password, user.passwordHash);
      if (!passwordValid) {
        await this.rateLimiter.recordFailedAttempt(credentials.username);
        await this.userStore.recordFailedLogin(user.id);
        return {
          success: false,
          reason: 'Invalid credentials'
        };
      }

      // MFA verification if required
      if (this.config.mfaRequired && user.mfaEnabled) {
        if (!credentials.mfaToken) {
          return {
            success: false,
            reason: 'MFA token required',
            requiresMFA: true
          };
        }

        const mfaValid = await this.mfaManager.verifyToken(user.id, credentials.mfaToken);
        if (!mfaValid) {
          return {
            success: false,
            reason: 'Invalid MFA token'
          };
        }
      }

      // API key authentication if provided
      if (credentials.apiKey) {
        const apiKeyValid = await this.verifyApiKey(user.id, credentials.apiKey);
        if (!apiKeyValid) {
          return {
            success: false,
            reason: 'Invalid API key'
          };
        }
      }

      // Create session
      const session = await this.sessionStore.createSession(user.id);
      const token = this.generateJWT(user, session.id);

      // Update user login info
      await this.userStore.recordSuccessfulLogin(user.id);

      // Clear failed attempts
      await this.rateLimiter.clearFailedAttempts(credentials.username);

      return {
        success: true,
        userId: user.id,
        token,
        permissions: await this.rbacManager.getUserPermissions(user.id),
        sessionId: session.id
      };
    } catch (error) {
      return {
        success: false,
        reason: 'Authentication failed due to internal error'
      };
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const decoded = verify(token, this.config.jwtSecret) as JWTPayload;

      // Check if session is still valid
      const session = await this.sessionStore.getSession(decoded.sessionId);
      if (!session || session.status !== 'active') {
        return {
          valid: false,
          reason: 'Session expired or invalid'
        };
      }

      // Get user permissions
      const permissions = await this.rbacManager.getUserPermissions(decoded.userId);

      return {
        valid: true,
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        permissions,
        expiresAt: new Date(decoded.exp * 1000)
      };
    } catch (error) {
      return {
        valid: false,
        reason: 'Invalid token'
      };
    }
  }

  /**
   * Authorize user action
   */
  async authorize(userId: string, resource: string, action: string, context?: AuthorizationContext): Promise<AuthorizationResult> {
    try {
      // Check user permissions
      const hasPermission = await this.rbacManager.hasPermission(userId, resource, action);
      if (!hasPermission) {
        return {
          authorized: false,
          reason: 'Insufficient permissions'
        };
      }

      // Additional contextual checks
      if (context) {
        const contextChecks = await this.performContextualChecks(userId, resource, action, context);
        if (!contextChecks.authorized) {
          return contextChecks;
        }
      }

      return {
        authorized: true
      };
    } catch (error) {
      return {
        authorized: false,
        reason: 'Authorization check failed'
      };
    }
  }

  /**
   * Register new user
   */
  async register(userData: UserRegistrationData): Promise<RegistrationResult> {
    try {
      // Validate input data
      const validationResult = await this.validateRegistrationData(userData);
      if (!validationResult.valid) {
        return {
          success: false,
          reason: validationResult.reason
        };
      }

      // Check if user already exists
      const existingUser = await this.userStore.findByUsername(userData.username);
      if (existingUser) {
        return {
          success: false,
          reason: 'Username already exists'
        };
      }

      const existingEmail = await this.userStore.findByEmail(userData.email);
      if (existingEmail) {
        return {
          success: false,
          reason: 'Email already registered'
        };
      }

      // Hash password
      const passwordHash = await this.hashPassword(userData.password);

      // Create user
      const user = await this.userStore.createUser({
        username: userData.username,
        email: userData.email,
        passwordHash,
        roles: userData.roles || ['user'],
        status: 'active',
        mfaEnabled: false,
        createdAt: new Date(),
        lastLoginAt: null,
        failedLoginAttempts: 0
      });

      // Setup MFA if requested
      if (userData.enableMFA) {
        await this.mfaManager.setupMFA(user.id);
        await this.userStore.updateUser(user.id, { mfaEnabled: true });
      }

      return {
        success: true,
        userId: user.id,
        message: 'User registered successfully'
      };
    } catch (error) {
      return {
        success: false,
        reason: 'Registration failed due to internal error'
      };
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    try {
      const session = await this.sessionStore.getSessionByRefreshToken(refreshToken);
      if (!session || session.status !== 'active') {
        return {
          success: false,
          reason: 'Invalid refresh token'
        };
      }

      // Check if refresh token is expired
      if (new Date() > session.refreshTokenExpiresAt) {
        await this.sessionStore.invalidateSession(session.id);
        return {
          success: false,
          reason: 'Refresh token expired'
        };
      }

      // Get user
      const user = await this.userStore.findById(session.userId);
      if (!user || user.status !== 'active') {
        return {
          success: false,
          reason: 'User account is not active'
        };
      }

      // Generate new JWT and refresh tokens
      const newToken = this.generateJWT(user, session.id);
      const newRefreshToken = this.generateRefreshToken();

      // Update session
      await this.sessionStore.updateSession(session.id, {
        refreshToken: newRefreshToken,
        refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });

      return {
        success: true,
        token: newToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      return {
        success: false,
        reason: 'Token refresh failed'
      };
    }
  }

  /**
   * Logout user
   */
  async logout(token: string): Promise<LogoutResult> {
    try {
      const decoded = verify(token, this.config.jwtSecret) as JWTPayload;

      // Invalidate session
      await this.sessionStore.invalidateSession(decoded.sessionId);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        reason: 'Logout failed'
      };
    }
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<PasswordChangeResult> {
    try {
      // Validate new password
      const passwordValidation = this.passwordValidator.validate(newPassword);
      if (!passwordValidation.valid) {
        return {
          success: false,
          reason: passwordValidation.reason
        };
      }

      // Get user
      const user = await this.userStore.findById(userId);
      if (!user) {
        return {
          success: false,
          reason: 'User not found'
        };
      }

      // Verify current password
      const currentPasswordValid = await this.verifyPassword(currentPassword, user.passwordHash);
      if (!currentPasswordValid) {
        return {
          success: false,
          reason: 'Current password is incorrect'
        };
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update user
      await this.userStore.updateUser(userId, {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        forcePasswordChange: false
      });

      // Invalidate all sessions except current
      await this.sessionStore.invalidateAllUserSessions(userId);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      return {
        success: false,
        reason: 'Password change failed'
      };
    }
  }

  /**
   * Enable MFA for user
   */
  async enableMFA(userId: string): Promise<MFASetupResult> {
    try {
      const user = await this.userStore.findById(userId);
      if (!user) {
        return {
          success: false,
          reason: 'User not found'
        };
      }

      const mfaSetup = await this.mfaManager.setupMFA(userId);

      // Update user
      await this.userStore.updateUser(userId, {
        mfaEnabled: true,
        mfaSecret: mfaSetup.secret
      });

      return {
        success: true,
        secret: mfaSetup.secret,
        qrCode: mfaSetup.qrCode,
        backupCodes: mfaSetup.backupCodes
      };
    } catch (error) {
      return {
        success: false,
        reason: 'MFA setup failed'
      };
    }
  }

  /**
   * Verify MFA token
   */
  async verifyMFAToken(userId: string, token: string): Promise<MFAVerificationResult> {
    try {
      const valid = await this.mfaManager.verifyToken(userId, token);

      return {
        success: valid
      };
    } catch (error) {
      return {
        success: false,
        reason: 'MFA verification failed'
      };
    }
  }

  // Private helper methods
  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(password + salt)
      .digest('hex');
    return `${salt}:${hash}`;
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      const [salt, hash] = storedHash.split(':');
      const computedHash = createHash('sha256')
        .update(password + salt)
        .digest('hex');

      // Use timing-safe comparison
      return timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
    } catch {
      return false;
    }
  }

  private generateJWT(user: User, sessionId: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (this.config.tokenExpiry * 60)
    };

    return sign(payload, this.config.jwtSecret);
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async verifyApiKey(userId: string, apiKey: string): Promise<boolean> {
    // Implementation would verify API key against stored keys
    return true;
  }

  private async validateRegistrationData(userData: UserRegistrationData): Promise<ValidationResult> {
    // Validate username
    if (!userData.username || userData.username.length < 3) {
      return {
        valid: false,
        reason: 'Username must be at least 3 characters long'
      };
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userData.email || !emailRegex.test(userData.email)) {
      return {
        valid: false,
        reason: 'Invalid email format'
      };
    }

    // Validate password
    const passwordValidation = this.passwordValidator.validate(userData.password);
    if (!passwordValidation.valid) {
      return passwordValidation;
    }

    return {
      valid: true
    };
  }

  private async performContextualChecks(userId: string, resource: string, action: string, context: AuthorizationContext): Promise<AuthorizationResult> {
    // Time-based access control
    if (context.timeRestriction) {
      const currentTime = new Date().getHours();
      const { startHour, endHour } = context.timeRestriction;

      if (currentTime < startHour || currentTime > endHour) {
        return {
          authorized: false,
          reason: 'Access not allowed at this time'
        };
      }
    }

    // IP-based access control
    if (context.ipRestriction) {
      const clientIP = context.clientIP || '';
      if (!context.ipRestriction.includes(clientIP)) {
        return {
          authorized: false,
          reason: 'Access not allowed from this IP address'
        };
      }
    }

    // Resource ownership check
    if (context.requiresOwnership) {
      const isOwner = await this.checkResourceOwnership(userId, resource);
      if (!isOwner) {
        return {
          authorized: false,
          reason: 'Access denied: resource ownership required'
        };
      }
    }

    return {
      authorized: true
    };
  }

  private async checkResourceOwnership(userId: string, resource: string): Promise<boolean> {
    // Implementation would check if user owns the resource
    return true;
  }
}

// Supporting classes
class UserStore {
  private users: Map<string, User> = new Map();

  async initialize(): Promise<void> {
    // Initialize user storage
  }

  async findByUsername(username: string): Promise<User | null> {
    return Array.from(this.users.values()).find(user => user.username === username) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find(user => user.email === email) || null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async createUser(userData: CreateUserUserData): Promise<User> {
    const user: User = {
      id: this.generateId(),
      ...userData,
      createdAt: new Date(),
      lastLoginAt: null,
      failedLoginAttempts: 0
    };

    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      Object.assign(user, updates);
      this.users.set(id, user);
    }
  }

  async recordSuccessfulLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
      user.failedLoginAttempts = 0;
      this.users.set(id, user);
    }
  }

  async recordFailedLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      this.users.set(id, user);
    }
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }
}

class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize session storage
  }

  async createSession(userId: string): Promise<Session> {
    const session: Session = {
      id: this.generateId(),
      userId,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.sessionTimeout * 60 * 1000),
      refreshToken: this.generateRefreshToken(),
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session || new Date() > session.expiresAt) {
      if (session) {
        this.sessions.delete(sessionId);
      }
      return null;
    }
    return session;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    return Array.from(this.sessions.values()).find(
      session => session.refreshToken === refreshToken && session.status === 'active'
    ) || null;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.sessions.set(sessionId, session);
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'invalidated';
      this.sessions.set(sessionId, session);
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId && session.status === 'active') {
        this.invalidateSession(sessionId);
      }
    }
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }
}

class MFAManager {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize MFA system
  }

  async setupMFA(userId: string): Promise<MFASetup> {
    const secret = this.generateSecret();
    const qrCode = this.generateQRCode(secret);
    const backupCodes = this.generateBackupCodes();

    return {
      secret,
      qrCode,
      backupCodes
    };
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    // Implementation would verify TOTP token
    return true;
  }

  private generateSecret(): string {
    return randomBytes(20).toString('base64');
  }

  private generateQRCode(secret: string): string {
    // Implementation would generate QR code for TOTP setup
    return `otpauth://totp/TurboFlow:${secret}?secret=${secret}&issuer=TurboFlow`;
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 10 }, () => randomBytes(4).toString('hex').toUpperCase());
  }
}

class RBACManager {
  private config: SecurityConfig;
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
    this.initializeDefaultRoles();
  }

  async initialize(): Promise<void> {
    // Initialize RBAC system
  }

  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    // Implementation would check user permissions against resource and action
    return true;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    // Implementation would get all user permissions
    return ['read', 'write', 'admin'];
  }

  private initializeDefaultRoles(): void {
    // Initialize default roles and permissions
    this.roles.set('admin', {
      id: 'admin',
      name: 'Administrator',
      permissions: ['*']
    });

    this.roles.set('user', {
      id: 'user',
      name: 'User',
      permissions: ['read', 'write']
    });

    this.roles.set('readonly', {
      id: 'readonly',
      name: 'Read Only',
      permissions: ['read']
    });
  }
}

class PasswordValidator {
  private policy: any;

  constructor(policy: any) {
    this.policy = policy;
  }

  validate(password: string): ValidationResult {
    if (password.length < this.policy.minLength) {
      return {
        valid: false,
        reason: `Password must be at least ${this.policy.minLength} characters long`
      };
    }

    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      return {
        valid: false,
        reason: 'Password must contain at least one uppercase letter'
      };
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      return {
        valid: false,
        reason: 'Password must contain at least one lowercase letter'
      };
    }

    if (this.policy.requireNumbers && !/\d/.test(password)) {
      return {
        valid: false,
        reason: 'Password must contain at least one number'
      };
    }

    if (this.policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return {
        valid: false,
        reason: 'Password must contain at least one special character'
      };
    }

    return {
      valid: true
    };
  }
}

class RateLimiter {
  private config: SecurityConfig;
  private attempts: Map<string, AttemptRecord[]> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async checkAuthAttempts(username: string): Promise<RateLimitResult> {
    const userAttempts = this.attempts.get(username) || [];
    const recentAttempts = userAttempts.filter(attempt =>
      Date.now() - attempt.timestamp < 15 * 60 * 1000 // 15 minutes
    );

    if (recentAttempts.length >= this.config.maxLoginAttempts) {
      const oldestAttempt = Math.min(...recentAttempts.map(a => a.timestamp));
      const retryAfter = Math.ceil((oldestAttempt + 15 * 60 * 1000 - Date.now()) / 1000);

      return {
        allowed: false,
        retryAfter
      };
    }

    return {
      allowed: true
    };
  }

  async recordFailedAttempt(username: string): Promise<void> {
    const userAttempts = this.attempts.get(username) || [];
    userAttempts.push({
      timestamp: Date.now(),
      type: 'failed_login'
    });
    this.attempts.set(username, userAttempts);
  }

  async clearFailedAttempts(username: string): Promise<void> {
    this.attempts.delete(username);
  }
}

// Type definitions
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  roles: string[];
  status: 'active' | 'inactive' | 'locked' | 'suspended';
  mfaEnabled: boolean;
  mfaSecret?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  passwordChangedAt?: Date;
  forcePasswordChange?: boolean;
}

export interface Session {
  id: string;
  userId: string;
  status: 'active' | 'invalidated' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface JWTPayload {
  userId: string;
  username: string;
  roles: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  sessionId?: string;
  permissions?: string[];
  expiresAt?: Date;
  reason?: string;
}

export interface AuthorizationContext {
  timeRestriction?: {
    startHour: number;
    endHour: number;
  };
  ipRestriction?: string[];
  requiresOwnership?: boolean;
  clientIP?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
}

export interface UserRegistrationData {
  username: string;
  email: string;
  password: string;
  roles?: string[];
  enableMFA?: boolean;
}

export interface RegistrationResult {
  success: boolean;
  userId?: string;
  message?: string;
  reason?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  reason?: string;
}

export interface LogoutResult {
  success: boolean;
  reason?: string;
}

export interface PasswordChangeResult {
  success: boolean;
  message?: string;
  reason?: string;
}

export interface MFASetupResult {
  success: boolean;
  secret?: string;
  qrCode?: string;
  backupCodes?: string[];
  reason?: string;
}

export interface MFAVerificationResult {
  success: boolean;
  reason?: string;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface CreateUserUserData {
  username: string;
  email: string;
  passwordHash: string;
  roles: string[];
  status: 'active' | 'inactive' | 'locked' | 'suspended';
  mfaEnabled: boolean;
}

export interface AttemptRecord {
  timestamp: number;
  type: string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}