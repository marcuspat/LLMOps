/**
 * Security Configuration Management
 * Centralized configuration for all security components
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export class SecurityConfig {
  // Core settings
  public readonly environment: 'development' | 'staging' | 'production';
  public readonly debugMode: boolean;
  public readonly logLevel: 'error' | 'warn' | 'info' | 'debug';

  // Scanner settings
  public readonly scanningEnabled: boolean;
  public readonly scanningInterval: number; // minutes
  public readonly maxScanConcurrency: number;
  public readonly scannerTimeout: number; // seconds

  // Authentication settings
  public readonly authEnabled: boolean;
  public readonly sessionTimeout: number; // minutes
  public readonly maxLoginAttempts: number;
  public readonly passwordPolicy: PasswordPolicy;
  public readonly mfaRequired: boolean;
  public readonly jwtSecret: string;
  public readonly tokenExpiry: number; // minutes

  // Threat detection settings
  public readonly threatDetectionEnabled: boolean;
  public readonly threatDetectionSensitivity: 'low' | 'medium' | 'high' | 'maximum';
  public readonly monitoringInterval: number; // seconds
  public readonly alertThresholds: AlertThresholds;

  // Policy enforcement settings
  public readonly policyEnforcementEnabled: boolean;
  public readonly policyCheckInterval: number; // seconds
  public readonly strictMode: boolean;
  public readonly autoRemediation: boolean;

  // Vulnerability management
  public readonly vulnerabilitySources: string[];
  public readonly vulnerabilityCacheTTL: number; // hours
  public readonly autoUpdateVulnerabilities: boolean;

  // OWASP compliance settings
  public readonly owaspCompliance: OWASPCompliance;

  // Metrics and monitoring
  public readonly metricsEnabled: boolean;
  public readonly metricsCollectionInterval: number; // seconds
  public readonly metricsRetentionDays: number;

  // GitHub integration
  public readonly githubIntegration: GitHubIntegration;

  // Encryption settings
  public readonly encryptionSettings: EncryptionSettings;

  // API security
  public readonly apiSecurity: APISecurity;

  constructor(config: Partial<SecurityConfig> = {}) {
    // Load default configuration
    const defaultConfig = this.loadDefaultConfig();

    // Merge with provided configuration
    const mergedConfig = { ...defaultConfig, ...config };

    // Assign all properties
    this.environment = mergedConfig.environment;
    this.debugMode = mergedConfig.debugMode;
    this.logLevel = mergedConfig.logLevel;
    this.scanningEnabled = mergedConfig.scanningEnabled;
    this.scanningInterval = mergedConfig.scanningInterval;
    this.maxScanConcurrency = mergedConfig.maxScanConcurrency;
    this.scannerTimeout = mergedConfig.scannerTimeout;
    this.authEnabled = mergedConfig.authEnabled;
    this.sessionTimeout = mergedConfig.sessionTimeout;
    this.maxLoginAttempts = mergedConfig.maxLoginAttempts;
    this.passwordPolicy = mergedConfig.passwordPolicy;
    this.mfaRequired = mergedConfig.mfaRequired;
    this.jwtSecret = mergedConfig.jwtSecret || this.generateSecret();
    this.tokenExpiry = mergedConfig.tokenExpiry;
    this.threatDetectionEnabled = mergedConfig.threatDetectionEnabled;
    this.threatDetectionSensitivity = mergedConfig.threatDetectionSensitivity;
    this.monitoringInterval = mergedConfig.monitoringInterval;
    this.alertThresholds = mergedConfig.alertThresholds;
    this.policyEnforcementEnabled = mergedConfig.policyEnforcementEnabled;
    this.policyCheckInterval = mergedConfig.policyCheckInterval;
    this.strictMode = mergedConfig.strictMode;
    this.autoRemediation = mergedConfig.autoRemediation;
    this.vulnerabilitySources = mergedConfig.vulnerabilitySources;
    this.vulnerabilityCacheTTL = mergedConfig.vulnerabilityCacheTTL;
    this.autoUpdateVulnerabilities = mergedConfig.autoUpdateVulnerabilities;
    this.owaspCompliance = mergedConfig.owaspCompliance;
    this.metricsEnabled = mergedConfig.metricsEnabled;
    this.metricsCollectionInterval = mergedConfig.metricsCollectionInterval;
    this.metricsRetentionDays = mergedConfig.metricsRetentionDays;
    this.githubIntegration = mergedConfig.githubIntegration;
    this.encryptionSettings = mergedConfig.encryptionSettings;
    this.apiSecurity = mergedConfig.apiSecurity;
  }

  private loadDefaultConfig(): Partial<SecurityConfig> {
    return {
      environment: 'development',
      debugMode: false,
      logLevel: 'info',

      // Scanning defaults
      scanningEnabled: true,
      scanningInterval: 60, // 1 hour
      maxScanConcurrency: 4,
      scannerTimeout: 300, // 5 minutes

      // Authentication defaults
      authEnabled: true,
      sessionTimeout: 480, // 8 hours
      maxLoginAttempts: 5,
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventCommonPasswords: true,
        preventUserInfo: true
      },
      mfaRequired: false,
      tokenExpiry: 60, // 1 hour

      // Threat detection defaults
      threatDetectionEnabled: true,
      threatDetectionSensitivity: 'medium',
      monitoringInterval: 30, // 30 seconds
      alertThresholds: {
        failedLoginThreshold: 5,
        rateLimitThreshold: 100,
        anomalyScoreThreshold: 0.7,
        cpuUsageThreshold: 80,
        memoryUsageThreshold: 85
      },

      // Policy enforcement defaults
      policyEnforcementEnabled: true,
      policyCheckInterval: 60, // 1 minute
      strictMode: false,
      autoRemediation: false,

      // Vulnerability management defaults
      vulnerabilitySources: [
        'https://services.nvd.nist.gov/rest/json/cves/2.0',
        'https://api.github.com/advisories',
        'https://ossindex.sonatype.org/api/v3/component-report'
      ],
      vulnerabilityCacheTTL: 24, // 24 hours
      autoUpdateVulnerabilities: true,

      // OWASP compliance defaults
      owaspCompliance: {
        asvsLevel: '2',
        requireSecurityHeaders: true,
        requireInputValidation: true,
        requireOutputEncoding: true,
        requireAuthentication: true,
        requireSessionManagement: true,
        requireAccessControl: true,
        requireCryptography: true,
        requireErrorHandling: true,
        requireLogging: true,
        requireDataProtection: true
      },

      // Metrics defaults
      metricsEnabled: true,
      metricsCollectionInterval: 60, // 1 minute
      metricsRetentionDays: 30,

      // GitHub integration defaults
      githubIntegration: {
        enabled: false,
        token: '',
        repository: '',
        autoCreatePRs: true,
        securityBranch: 'security',
        autoMergeLowRisk: true
      },

      // Encryption defaults
      encryptionSettings: {
        algorithm: 'aes-256-gcm',
        keyRotationInterval: 90, // days
        minKeyLength: 256,
        enableDataAtRestEncryption: true,
        enableDataInTransitEncryption: true
      },

      // API security defaults
      apiSecurity: {
        rateLimiting: {
          enabled: true,
          windowMs: 900000, // 15 minutes
          maxRequests: 100
        },
        cors: {
          enabled: true,
          allowedOrigins: ['http://localhost:3000'],
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
          allowedHeaders: ['Content-Type', 'Authorization']
        },
        inputValidation: {
          enabled: true,
          maxRequestBodySize: '10mb',
          sanitizeInput: true,
          preventXSS: true,
          preventSQLInjection: true
        }
      }
    };
  }

  /**
   * Load configuration from file
   */
  static fromFile(configPath: string): SecurityConfig {
    try {
      if (!existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      const configData = JSON.parse(readFileSync(configPath, 'utf8'));
      return new SecurityConfig(configData);
    } catch (error) {
      console.error('Failed to load configuration from file:', error);
      return new SecurityConfig(); // Return default configuration
    }
  }

  /**
   * Save configuration to file
   */
  saveToFile(configPath: string): void {
    try {
      const configData = this.toSafeObject();
      writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save configuration to file:', error);
      throw error;
    }
  }

  /**
   * Convert configuration to safe object (excluding secrets)
   */
  toSafeObject(): any {
    return {
      environment: this.environment,
      debugMode: this.debugMode,
      logLevel: this.logLevel,
      scanningEnabled: this.scanningEnabled,
      scanningInterval: this.scanningInterval,
      maxScanConcurrency: this.maxScanConcurrency,
      scannerTimeout: this.scannerTimeout,
      authEnabled: this.authEnabled,
      sessionTimeout: this.sessionTimeout,
      maxLoginAttempts: this.maxLoginAttempts,
      passwordPolicy: this.passwordPolicy,
      mfaRequired: this.mfaRequired,
      // jwtSecret excluded for security
      tokenExpiry: this.tokenExpiry,
      threatDetectionEnabled: this.threatDetectionEnabled,
      threatDetectionSensitivity: this.threatDetectionSensitivity,
      monitoringInterval: this.monitoringInterval,
      alertThresholds: this.alertThresholds,
      policyEnforcementEnabled: this.policyEnforcementEnabled,
      policyCheckInterval: this.policyCheckInterval,
      strictMode: this.strictMode,
      autoRemediation: this.autoRemediation,
      vulnerabilitySources: this.vulnerabilitySources,
      vulnerabilityCacheTTL: this.vulnerabilityCacheTTL,
      autoUpdateVulnerabilities: this.autoUpdateVulnerabilities,
      owaspCompliance: this.owaspCompliance,
      metricsEnabled: this.metricsEnabled,
      metricsCollectionInterval: this.metricsCollectionInterval,
      metricsRetentionDays: this.metricsRetentionDays,
      githubIntegration: {
        ...this.githubIntegration,
        // token excluded for security
        token: this.githubIntegration.token ? '[REDACTED]' : ''
      },
      encryptionSettings: this.encryptionSettings,
      apiSecurity: this.apiSecurity
    };
  }

  /**
   * Validate configuration
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Environment validation
    if (!['development', 'staging', 'production'].includes(this.environment)) {
      errors.push('Invalid environment specified');
    }

    // Password policy validation
    if (this.passwordPolicy.minLength < 8) {
      warnings.push('Password minimum length should be at least 8 characters');
    }

    // JWT secret validation
    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    // Production environment specific validations
    if (this.environment === 'production') {
      if (!this.mfaRequired) {
        warnings.push('Multi-factor authentication should be required in production');
      }

      if (this.debugMode) {
        warnings.push('Debug mode should be disabled in production');
      }

      if (this.logLevel === 'debug') {
        warnings.push('Debug logging should be disabled in production');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get configuration for specific environment
   */
  static forEnvironment(environment: 'development' | 'staging' | 'production'): SecurityConfig {
    const baseConfig = new SecurityConfig();

    switch (environment) {
      case 'development':
        return new SecurityConfig({
          ...baseConfig,
          environment: 'development',
          debugMode: true,
          logLevel: 'debug',
          scanningInterval: 30, // 30 minutes
          threatDetectionSensitivity: 'low',
          strictMode: false,
          mfaRequired: false
        });

      case 'staging':
        return new SecurityConfig({
          ...baseConfig,
          environment: 'staging',
          debugMode: false,
          logLevel: 'info',
          scanningInterval: 60, // 1 hour
          threatDetectionSensitivity: 'medium',
          strictMode: true,
          mfaRequired: true
        });

      case 'production':
        return new SecurityConfig({
          ...baseConfig,
          environment: 'production',
          debugMode: false,
          logLevel: 'warn',
          scanningInterval: 120, // 2 hours
          threatDetectionSensitivity: 'high',
          strictMode: true,
          mfaRequired: true,
          autoRemediation: true,
          sessionTimeout: 240, // 4 hours
          tokenExpiry: 30, // 30 minutes
        });

      default:
        return baseConfig;
    }
  }

  /**
   * Generate secure random secret
   */
  private generateSecret(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Update configuration property
   */
  updateProperty(path: string, value: any): void {
    const keys = path.split('.');
    let current: any = this;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get configuration property
   */
  getProperty(path: string): any {
    const keys = path.split('.');
    let current: any = this;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

// Type definitions
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
}

export interface AlertThresholds {
  failedLoginThreshold: number;
  rateLimitThreshold: number;
  anomalyScoreThreshold: number;
  cpuUsageThreshold: number;
  memoryUsageThreshold: number;
}

export interface OWASPCompliance {
  asvsLevel: '1' | '2' | '3';
  requireSecurityHeaders: boolean;
  requireInputValidation: boolean;
  requireOutputEncoding: boolean;
  requireAuthentication: boolean;
  requireSessionManagement: boolean;
  requireAccessControl: boolean;
  requireCryptography: boolean;
  requireErrorHandling: boolean;
  requireLogging: boolean;
  requireDataProtection: boolean;
}

export interface GitHubIntegration {
  enabled: boolean;
  token: string;
  repository: string;
  autoCreatePRs: boolean;
  securityBranch: string;
  autoMergeLowRisk: boolean;
}

export interface EncryptionSettings {
  algorithm: string;
  keyRotationInterval: number; // days
  minKeyLength: number;
  enableDataAtRestEncryption: boolean;
  enableDataInTransitEncryption: boolean;
}

export interface RateLimiting {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
}

export interface CORS {
  enabled: boolean;
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
}

export interface InputValidation {
  enabled: boolean;
  maxRequestBodySize: string;
  sanitizeInput: boolean;
  preventXSS: boolean;
  preventSQLInjection: boolean;
}

export interface APISecurity {
  rateLimiting: RateLimiting;
  cors: CORS;
  inputValidation: InputValidation;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}