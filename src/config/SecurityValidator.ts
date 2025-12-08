/**
 * Security Configuration Validator
 * Ensures production security requirements are met
 */

import { config } from './index.js';
import { logger } from '../utils/secure-logger.js';

export interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  criticalIssues: string[];
}

export class SecurityValidator {
  private static instance: SecurityValidator;
  private validationCache: Map<string, SecurityValidationResult> = new Map();

  private constructor() {}

  public static getInstance(): SecurityValidator {
    if (!SecurityValidator.instance) {
      SecurityValidator.instance = new SecurityValidator();
    }
    return SecurityValidator.instance;
  }

  /**
   * Validates security configuration
   */
  public validateSecurity(): SecurityValidationResult {
    const cacheKey = `${config.environment}-${Date.now()}`;
    const cached = this.validationCache.get(cacheKey);

    if (cached && Date.now() - Date.now() < 60000) {
      return cached;
    }

    const result: SecurityValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      criticalIssues: []
    };

    // JWT Secret Validation
    this.validateJWTSecret(result);

    // Environment-specific validations
    if (config.environment === 'production') {
      this.validateProductionSecurity(result);
    }

    // WebSocket Origin Validation
    this.validateWebSocketSecurity(result);

    // CORS Configuration Validation
    this.validateCorsConfiguration(result);

    // Database Security Validation
    this.validateDatabaseSecurity(result);

    // Redis Security Validation
    this.validateRedisSecurity(result);

    // Rate Limiting Validation
    this.validateRateLimiting(result);

    // Cache results
    this.validationCache.set(cacheKey, result);

    return result;
  }

  /**
   * Validates JWT Secret configuration
   */
  private validateJWTSecret(result: SecurityValidationResult): void {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      result.criticalIssues.push(
        'JWT_SECRET environment variable is not set. This is a critical security vulnerability.'
      );
      result.isValid = false;
      return;
    }

    if (jwtSecret.length < 32) {
      result.criticalIssues.push(
        `JWT_SECRET is too short (${jwtSecret.length} characters). Must be at least 32 characters.`
      );
      result.isValid = false;
    }

    // Check for common weak secrets
    const weakSecrets = [
      'default-secret-change-in-production',
      'secret',
      'jwt_secret',
      'your-secret-key',
      'change-me',
      'dev',
      'test',
      'password'
    ];

    if (weakSecrets.some(weak => jwtSecret.toLowerCase().includes(weak))) {
      result.criticalIssues.push(
        'JWT_SECRET appears to be a weak or default value. Use a strong, randomly generated secret.'
      );
      result.isValid = false;
    }

    // Check for insufficient entropy (basic check)
    const uniqueChars = new Set(jwtSecret).size;
    if (uniqueChars < 20) {
      result.criticalIssues.push(
        'JWT_SECRET has insufficient entropy. Use a cryptographically secure random generator.'
      );
      result.isValid = false;
    }
  }

  /**
   * Validates production-specific security requirements
   */
  private validateProductionSecurity(result: SecurityValidationResult): void {
    // Ensure HTTPS is used
    if (!process.env.FORCE_HTTPS && !process.env.HTTPS_REQUIRED) {
      result.warnings.push(
        'HTTPS should be enforced in production. Set FORCE_HTTPS=true or HTTPS_REQUIRED=true'
      );
    }

    // Check for security headers
    const securityHeaders = [
      'CSP_SCRIPT_SRC',
      'CSP_STYLE_SRC',
      'HSTS_MAX_AGE'
    ];

    for (const header of securityHeaders) {
      if (!process.env[header]) {
        result.warnings.push(`Security header ${header} is not configured`);
      }
    }

    // Verify database uses SSL
    if (process.env.DB_SSL !== 'true' && !process.env.DATABASE_URL?.includes('ssl=true')) {
      result.criticalIssues.push(
        'Database connections must use SSL in production. Set DB_SSL=true or include ssl=true in DATABASE_URL'
      );
      result.isValid = false;
    }

    // Check for API rate limiting
    const rateLimit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
    if (rateLimit > 1000) {
      result.warnings.push(
        'Rate limit is very high. Consider implementing stricter limits for production.'
      );
    }
  }

  /**
   * Validates WebSocket security configuration
   */
  private validateWebSocketSecurity(result: SecurityValidationResult): void {
    const wsOrigins = process.env.WS_ALLOWED_ORIGINS;

    if (!wsOrigins) {
      result.criticalIssues.push(
        'WS_ALLOWED_ORIGINS is not configured. WebSocket connections must be restricted to specific origins.'
      );
      result.isValid = false;
      return;
    }

    const origins = wsOrigins.split(',').map(o => o.trim());

    // In production, ensure no localhost origins
    if (config.environment === 'production') {
      const localhostOrigins = origins.filter(o =>
        o.includes('localhost') || o.includes('127.0.0.1')
      );

      if (localhostOrigins.length > 0) {
        result.criticalIssues.push(
          `Localhost origins found in WS_ALLOWED_ORIGINS for production: ${localhostOrigins.join(', ')}`
        );
        result.isValid = false;
      }
    }

    // Ensure all origins use HTTPS in production
    if (config.environment === 'production') {
      const httpOrigins = origins.filter(o => o.startsWith('http://'));
      if (httpOrigins.length > 0) {
        result.criticalIssues.push(
          `HTTP origins found in WS_ALLOWED_ORIGINS for production. Use HTTPS only: ${httpOrigins.join(', ')}`
        );
        result.isValid = false;
      }
    }
  }

  /**
   * Validates CORS configuration
   */
  private validateCorsConfiguration(result: SecurityValidationResult): void {
    const corsOrigins = process.env.CORS_ORIGINS;

    if (!corsOrigins) {
      result.warnings.push(
        'CORS_ORIGINS is not configured. Using default values which may be too permissive.'
      );
      return;
    }

    const origins = corsOrigins.split(',').map(o => o.trim());

    // Check for wildcard origins
    if (origins.includes('*') || origins.includes('*.*')) {
      result.criticalIssues.push(
        'Wildcard CORS origins are not secure. Specify exact allowed origins.'
      );
      result.isValid = false;
    }

    // In production, ensure no localhost origins
    if (config.environment === 'production') {
      const localhostOrigins = origins.filter(o =>
        o.includes('localhost') || o.includes('127.0.0.1')
      );

      if (localhostOrigins.length > 0) {
        result.criticalIssues.push(
          `Localhost origins found in CORS_ORIGINS for production: ${localhostOrigins.join(', ')}`
        );
        result.isValid = false;
      }
    }
  }

  /**
   * Validates database security configuration
   */
  private validateDatabaseSecurity(result: SecurityValidationResult): void {
    // Check for hardcoded credentials
    const dangerousDefaults = [
      'password',
      'admin',
      'root',
      'user',
      'test',
      'dev'
    ];

    if (process.env.DB_PASSWORD && dangerousDefaults.includes(process.env.DB_PASSWORD.toLowerCase())) {
      result.criticalIssues.push(
        'Database password appears to be a default value. Use a strong, unique password.'
      );
      result.isValid = false;
    }

    // Ensure connection string doesn't expose credentials in logs
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.includes('password:password') || dbUrl.includes('user:password')) {
      result.criticalIssues.push(
        'Database URL contains default or weak credentials. Update with strong credentials.'
      );
      result.isValid = false;
    }
  }

  /**
   * Validates Redis security configuration
   */
  private validateRedisSecurity(result: SecurityValidationResult): void {
    // In production, Redis should have a password
    if (config.environment === 'production' && !process.env.REDIS_PASSWORD) {
      result.warnings.push(
        'Redis password is not configured. Consider enabling Redis AUTH for production.'
      );
    }

    // Check for default Redis configuration
    if (process.env.REDIS_PASSWORD === 'password' || process.env.REDIS_PASSWORD === 'redis') {
      result.criticalIssues.push(
        'Redis password appears to be a default value. Use a strong, unique password.'
      );
      result.isValid = false;
    }
  }

  /**
   * Validates rate limiting configuration
   */
  private validateRateLimiting(result: SecurityValidationResult): void {
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);

    if (maxRequests > 10000) {
      result.warnings.push(
        `Rate limit is very high (${maxRequests} requests per window). Consider implementing stricter limits.`
      );
    }

    if (windowMs > 3600000) {
      result.warnings.push(
        'Rate limit window is very long (> 1 hour). Consider shorter windows for better protection.'
      );
    }

    // In production, ensure rate limiting is enabled
    if (config.environment === 'production' && maxRequests < 10) {
      result.warnings.push(
        'Rate limit might be too restrictive for production use. Consider increasing the limit.'
      );
    }
  }

  /**
   * Logs validation results
   */
  public logValidationResults(): void {
    const results = this.validateSecurity();

    if (!results.isValid) {
      logger.error('SECURITY VALIDATION FAILED - Critical Issues Found', {
        criticalIssues: results.criticalIssues,
        errors: results.errors
      });
    }

    if (results.warnings.length > 0) {
      logger.warn('Security Validation Warnings', {
        warnings: results.warnings
      });
    }

    if (results.isValid && results.warnings.length === 0) {
      logger.info('Security validation passed successfully');
    }
  }

  /**
   * Throws error if security validation fails
   */
  public enforceSecurity(): void {
    const results = this.validateSecurity();

    if (!results.isValid) {
      const errorMessage = `Security validation failed:\n${[
        ...results.criticalIssues,
        ...results.errors
      ].join('\n')}`;

      logger.error('Security validation enforced - halting execution', {
        criticalIssues: results.criticalIssues,
        errors: results.errors
      });

      throw new Error(errorMessage);
    }
  }
}

// Export singleton instance
export const securityValidator = SecurityValidator.getInstance();