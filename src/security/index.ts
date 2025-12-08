/**
 * Turbo Flow Security Framework - Main Entry Point
 * Comprehensive security management system for production environments
 */

export { SecurityFramework } from './core/SecurityFramework.js';
export { SecurityConfig } from './core/SecurityConfig.js';

// Core components
export { SecurityScanner } from './scanning/SecurityScanner.js';
export { VulnerabilityManager } from './scanning/VulnerabilityManager.js';

// Authentication & Authorization
export { AuthManager } from './auth/AuthManager.js';

// Policy Management
export { PolicyEngine } from './policy/PolicyEngine.js';

// API Security
export { SecureAPIManager } from './api/SecureAPIManager.js';

// Threat Detection
export { ThreatDetector } from './threat/ThreatDetector.js';

// Monitoring & Audit
export { AuditLogger } from './monitoring/AuditLogger.js';

// GitHub Integration
export { GitHubSecurityIntegration } from './github/GitHubSecurityIntegration.js';

// Reporting & Metrics
export { SecurityReporter } from './reporting/SecurityReporter.js';

// Configuration Management
export { SecureConfigManager } from './config/SecureConfigManager.js';

// Re-export types for convenience
export type {
  SecurityScanResult,
  Vulnerability,
  SecurityRecommendation,
  AuthCredentials,
  AuthResult,
  SecurityContext,
  PolicyResult,
  Threat,
  ThreatResponse,
  ReportTimeframe,
  SecurityReport
} from './core/SecurityFramework.js';

export type {
  DependencyScanResult,
  CodeScanResult,
  ConfigurationScanResult,
  InfrastructureScanResult
} from './scanning/SecurityScanner.js';

export type {
  User,
  Session,
  Role,
  Permission,
  JWTPayload,
  TokenValidationResult,
  AuthorizationResult,
  UserRegistrationData,
  RegistrationResult,
  TokenRefreshResult,
  LogoutResult,
  PasswordChangeResult,
  MFASetupResult,
  MFAVerificationResult
} from './auth/AuthManager.js';

export type {
  SecurityPolicy,
  PolicyRule,
  PolicyCondition,
  PolicyEvaluationResult,
  OWASPComplianceResult,
  ComplianceResult
} from './policy/PolicyEngine.js';

export type {
  SecureAPIRequest,
  SecureAPIResponse,
  SecureWebSocket,
  ValidationResult,
  AuthResult as APIAuthResult,
  AuthorizationResult as APIAuthorizationResult,
  PolicyResult as APIPolicyResult,
  APIKey,
  APIKeyValidationResult
} from './api/SecureAPIManager.js';

export type {
  ThreatData,
  Threat as SecurityThreat,
  ThreatResponse as SecurityThreatResponse,
  SecurityAction,
  SecurityEvent as ThreatSecurityEvent,
  ThreatAnalysisResult
} from './threat/ThreatDetector.js';

export type {
  AuthEvent,
  AuthorizationEvent,
  DataAccessEvent,
  SystemEvent,
  SecurityEvent as AuditSecurityEvent,
  ConfigurationChangeEvent,
  AuditContext,
  AuditLogEntry
} from './monitoring/AuditLogger.js';

export type {
  PRSecurityAnalysis,
  RepositorySecurityScan,
  SecurityIssueMonitor,
  SecurityMetricsReport,
  AutoMergeResult
} from './github/GitHubSecurityIntegration.js';

export type {
  GeneratedReport,
  SecurityDashboard,
  SecurityMetricsSummary,
  ComplianceReport,
  SecurityDataExportRequest,
  ExportResult,
  ScheduledReportConfig
} from './reporting/SecurityReporter.js';

export type {
  ConfigMetadata,
  EncryptedConfig,
  DecryptedConfig,
  ConfigurationExport,
  BulkConfigResult,
  ImportResult,
  ValidationSummary
} from './config/SecureConfigManager.js';

/**
 * Factory function to create and initialize the security framework
 */
export async function createSecurityFramework(config?: Partial<SecurityConfig>): Promise<SecurityFramework> {
  const securityConfig = new SecurityConfig(config);
  const framework = new SecurityFramework(securityConfig);

  await framework.initialize();

  return framework;
}

/**
 * Factory function to create and initialize the secure config manager
 */
export async function createSecureConfigManager(config?: Partial<SecurityConfig>): Promise<SecureConfigManager> {
  const securityConfig = new SecurityConfig(config);
  const configManager = new SecureConfigManager(securityConfig);

  await configManager.initialize();

  return configManager;
}

/**
 * Example usage and setup
 */
export class SecuritySystem {
  private framework: SecurityFramework;
  private configManager: SecureConfigManager;

  constructor(config?: Partial<SecurityConfig>) {
    this.initialize(config);
  }

  private async initialize(config?: Partial<SecurityConfig>): Promise<void> {
    // Initialize core security components
    this.framework = await createSecurityFramework(config);
    this.configManager = await createSecureConfigManager(config);

    console.log('✅ Turbo Flow Security Framework initialized successfully');
  }

  /**
   * Perform comprehensive security scan
   */
  async performSecurityScan(target: string): Promise<any> {
    return await this.framework.performSecurityScan(target);
  }

  /**
   * Authenticate user
   */
  async authenticate(credentials: any): Promise<any> {
    return await this.framework.authenticate(credentials);
  }

  /**
   * Authorize user action
   */
  async authorize(userId: string, resource: string, action: string, context?: any): Promise<any> {
    return await this.framework.authorize(userId, resource, action, context);
  }

  /**
   * Analyze threats
   */
  async analyzeThreats(data: any): Promise<any[]> {
    return await this.framework.analyzeThreats(data);
  }

  /**
   * Generate security report
   */
  async generateReport(timeframe: any, format?: string): Promise<any> {
    return await this.framework.generateSecurityReport(timeframe);
  }

  /**
   * Get configuration value
   */
  async getConfig(key: string, defaultValue?: any): Promise<any> {
    return await this.configManager.get(key, defaultValue);
  }

  /**
   * Set configuration value
   */
  async setConfig(key: string, value: any): Promise<void> {
    await this.configManager.set(key, value);
  }

  /**
   * Export configuration
   */
  async exportConfig(includeSecrets?: boolean): Promise<any> {
    return await this.configManager.export(includeSecrets);
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<any> {
    const report = await this.generateReport({
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    });

    return {
      status: report.overallSecurityScore >= 80 ? 'healthy' : 'warning',
      score: report.overallSecurityScore,
      timestamp: new Date().toISOString(),
      components: {
        scanning: report.scanMetrics,
        threats: report.threatMetrics,
        authentication: report.authMetrics,
        policies: report.policyMetrics,
        vulnerabilities: report.vulnerabilityMetrics
      }
    };
  }
}

/**
 * Default configuration for security framework
 */
export const defaultSecurityConfig = {
  environment: 'development',
  scanningEnabled: true,
  scanningInterval: 60,
  authEnabled: true,
  mfaRequired: false,
  threatDetectionEnabled: true,
  policyEnforcementEnabled: true,
  metricsEnabled: true,
  githubIntegration: {
    enabled: false,
    token: '',
    repository: '',
    autoCreatePRs: true,
    securityBranch: 'security'
  },
  encryptionSettings: {
    algorithm: 'aes-256-gcm',
    keyRotationInterval: 90,
    minKeyLength: 256,
    enableDataAtRestEncryption: true,
    enableDataInTransitEncryption: true
  },
  apiSecurity: {
    rateLimiting: {
      enabled: true,
      windowMs: 900000,
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
  },
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
  }
};

/**
 * Export default configuration for easy use
 */
export { defaultSecurityConfig as config };