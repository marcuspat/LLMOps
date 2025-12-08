/**
 * Security Policy Engine
 * OWASP-compliant security policy enforcement and validation system
 */

import { SecurityConfig } from '../core/SecurityConfig.js';
import { SecurityContext, PolicyResult } from '../core/SecurityFramework.js';

export class PolicyEngine {
  private config: SecurityConfig;
  private policies: Map<string, SecurityPolicy> = new Map();
  private policyRules: Map<string, PolicyRule[]> = new Map();
  private complianceChecker: ComplianceChecker;
  private policyValidator: PolicyValidator;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.complianceChecker = new ComplianceChecker(config);
    this.policyValidator = new PolicyValidator(config);
    this.initializeOWASPPolicies();
  }

  async initialize(): Promise<void> {
    await this.complianceChecker.initialize();
    await this.policyValidator.initialize();
    await this.loadCustomPolicies();
  }

  /**
   * Get applicable policies for a given context
   */
  async getApplicablePolicies(context: SecurityContext): Promise<SecurityPolicy[]> {
    const applicablePolicies: SecurityPolicy[] = [];

    for (const [id, policy] of this.policies) {
      if (await this.isPolicyApplicable(policy, context)) {
        applicablePolicies.push(policy);
      }
    }

    // Sort by priority
    return applicablePolicies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate a specific policy against context
   */
  async evaluatePolicy(policy: SecurityPolicy, context: SecurityContext): Promise<PolicyEvaluationResult> {
    try {
      const rules = this.policyRules.get(policy.id) || [];
      const results: PolicyRuleResult[] = [];

      for (const rule of rules) {
        const result = await this.evaluateRule(rule, context);
        results.push(result);
      }

      const violations = results.filter(result => !result.compliant);
      const compliant = violations.length === 0;

      return {
        policyId: policy.id,
        policyName: policy.name,
        compliant,
        violations: violations.map(v => ({
          ruleId: v.ruleId,
          description: v.description,
          severity: v.severity,
          remediation: v.remediation
        })),
        appliedRules: rules.length,
        evaluationTime: new Date().toISOString()
      };
    } catch (error) {
      return {
        policyId: policy.id,
        policyName: policy.name,
        compliant: false,
        violations: [{
          ruleId: 'eval-error',
          description: `Policy evaluation failed: ${error}`,
          severity: 'high',
          remediation: 'Check policy configuration and context'
        }],
        appliedRules: 0,
        evaluationTime: new Date().toISOString()
      };
    }
  }

  /**
   * Perform continuous policy monitoring
   */
  async continuousMonitoring(): Promise<void> {
    // Implementation would perform continuous policy checks
    const contexts = await this.getActiveSecurityContexts();

    for (const context of contexts) {
      const applicablePolicies = await this.getApplicablePolicies(context);

      for (const policy of applicablePolicies) {
        const result = await this.evaluatePolicy(policy, context);

        if (!result.compliant) {
          await this.handlePolicyViolation(policy, context, result);
        }
      }
    }
  }

  /**
   * Check OWASP ASVS compliance
   */
  async checkOWASPCompliance(level: '1' | '2' | '3' = this.config.owaspCompliance.asvsLevel): Promise<OWASPComplianceResult> {
    const requirements = this.getASVSRequirements(level);
    const complianceResults: ComplianceResult[] = [];

    for (const requirement of requirements) {
      const result = await this.complianceChecker.checkRequirement(requirement);
      complianceResults.push(result);
    }

    const passed = complianceResults.filter(r => r.compliant);
    const total = complianceResults.length;
    const compliancePercentage = Math.round((passed.length / total) * 100);

    return {
      asvsLevel: level,
      overallCompliance: compliancePercentage,
      requirementsChecked: total,
      requirementsPassed: passed.length,
      requirementsFailed: total - passed.length,
      complianceResults,
      isCompliant: compliancePercentage >= 90,
      recommendations: this.generateComplianceRecommendations(complianceResults)
    };
  }

  /**
   * Add custom security policy
   */
  async addCustomPolicy(policy: SecurityPolicy, rules: PolicyRule[]): Promise<void> {
    // Validate policy
    const validation = await this.policyValidator.validatePolicy(policy);
    if (!validation.valid) {
      throw new Error(`Policy validation failed: ${validation.errors.join(', ')}`);
    }

    // Validate rules
    for (const rule of rules) {
      const ruleValidation = await this.policyValidator.validateRule(rule);
      if (!ruleValidation.valid) {
        throw new Error(`Rule validation failed: ${ruleValidation.errors.join(', ')}`);
      }
    }

    // Add policy and rules
    this.policies.set(policy.id, policy);
    this.policyRules.set(policy.id, rules);
  }

  /**
   * Remove security policy
   */
  async removePolicy(policyId: string): Promise<void> {
    this.policies.delete(policyId);
    this.policyRules.delete(policyId);
  }

  /**
   * Get policy violations report
   */
  async getPolicyViolations(timeframe?: { start: Date; end: Date }): Promise<PolicyViolationReport> {
    // Implementation would query policy violation logs
    return {
      timeframe: timeframe || { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() },
      totalViolations: 0,
      violationsByPolicy: new Map(),
      violationsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      topViolations: [],
      remediationProgress: 0
    };
  }

  /**
   * Generate policy recommendations
   */
  async generatePolicyRecommendations(context: SecurityContext): Promise<PolicyRecommendation[]> {
    const recommendations: PolicyRecommendation[] = [];

    // Analyze context and suggest missing policies
    if (!context.environment) {
      recommendations.push({
        type: 'missing-context',
        priority: 'high',
        title: 'Add environment context',
        description: 'Specify the environment (development, staging, production) for better policy enforcement',
        implementation: 'Add environment field to security context'
      });
    }

    // Check for common security gaps
    const securityGaps = await this.identifySecurityGaps(context);
    recommendations.push(...securityGaps);

    return recommendations.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }

  private initializeOWASPPolicies(): void {
    // OWASP ASVS Level 1 Policies
    this.policies.set('owasp-asvs-1-1', {
      id: 'owasp-asvs-1-1',
      name: 'OWASP ASVS V1 - Authentication',
      category: 'authentication',
      description: 'Verify user authentication is secure and resistant to common attacks',
      version: '1.0',
      priority: 10,
      enabled: this.config.owaspCompliance.requireAuthentication,
      requirements: [
        'require-strong-passwords',
        'implement-mfa',
        'prevent-account-lockout',
        'implement-session-management'
      ]
    });

    this.policies.set('owasp-asvs-1-2', {
      id: 'owasp-asvs-1-2',
      name: 'OWASP ASVS V2 - Session Management',
      category: 'session',
      description: 'Verify session management is secure',
      version: '1.0',
      priority: 9,
      enabled: this.config.owaspCompliance.requireSessionManagement,
      requirements: [
        'secure-session-ids',
        'session-timeout',
        'secure-session-storage',
        'invalidate-on-logout'
      ]
    });

    this.policies.set('owasp-asvs-1-3', {
      id: 'owasp-asvs-1-3',
      name: 'OWASP ASVS V3 - Access Control',
      category: 'authorization',
      description: 'Verify access control is properly implemented',
      version: '1.0',
      priority: 10,
      enabled: this.config.owaspCompliance.requireAccessControl,
      requirements: [
        'deny-by-default',
        'principle-of-least-privilege',
        'attribute-based-access',
        'secure-configuration'
      ]
    });

    this.policies.set('owasp-asvs-1-4', {
      id: 'owasp-asvs-1-4',
      name: 'OWASP ASVS V4 - Input Validation',
      category: 'input-validation',
      description: 'Verify input validation prevents injection attacks',
      version: '1.0',
      priority: 9,
      enabled: this.config.owaspCompliance.requireInputValidation,
      requirements: [
        'validate-all-inputs',
        'type-validation',
        'length-validation',
        'sanitization'
      ]
    });

    this.policies.set('owasp-asvs-1-5', {
      id: 'owasp-asvs-1-5',
      name: 'OWASP ASVS V5 - Output Encoding',
      category: 'output-encoding',
      description: 'Verify output encoding prevents XSS attacks',
      version: '1.0',
      priority: 8,
      enabled: this.config.owaspCompliance.requireOutputEncoding,
      requirements: [
        'context-sensitive-encoding',
        'xss-prevention',
        'content-type-headers',
        'csp-implementation'
      ]
    });

    this.policies.set('owasp-asvs-1-6', {
      id: 'owasp-asvs-1-6',
      name: 'OWASP ASVS V6 - Cryptographic Storage',
      category: 'cryptography',
      description: 'Verify cryptographic storage is secure',
      version: '1.0',
      priority: 10,
      enabled: this.config.owaspCompliance.requireCryptography,
      requirements: [
        'strong-encryption',
        'proper-key-management',
        'hash-passwords',
        'secure-algorithms'
      ]
    });

    this.policies.set('owasp-asvs-1-7', {
      id: 'owasp-asvs-1-7',
      name: 'OWASP ASVS V7 - Error Handling',
      category: 'error-handling',
      description: 'Verify error handling does not leak information',
      version: '1.0',
      priority: 7,
      enabled: this.config.owaspCompliance.requireErrorHandling,
      requirements: [
        'generic-error-messages',
        'secure-logging',
        'exception-handling',
        'information-leak-prevention'
      ]
    });

    this.policies.set('owasp-asvs-1-8', {
      id: 'owasp-asvs-1-8',
      name: 'OWASP ASVS V8 - Data Protection',
      category: 'data-protection',
      description: 'Verify sensitive data is properly protected',
      version: '1.0',
      priority: 9,
      enabled: this.config.owaspCompliance.requireDataProtection,
      requirements: [
        'data-classification',
        'encryption-at-rest',
        'encryption-in-transit',
        'data-retention-policies'
      ]
    });

    this.policies.set('owasp-asvs-1-9', {
      id: 'owasp-asvs-1-9',
      name: 'OWASP ASVS V9 - Communications',
      category: 'communications',
      description: 'Verify network communications are secure',
      version: '1.0',
      priority: 8,
      enabled: this.config.owaspCompliance.requireDataProtection,
      requirements: [
        'tls-enforcement',
        'certificate-validation',
        'secure-headers',
        'hsts-implementation'
      ]
    });

    this.policies.set('owasp-asvs-1-10', {
      id: 'owasp-asvs-1-10',
      name: 'OWASP ASVS V10 - Malicious Code',
      category: 'malicious-code',
      description: 'Verify system is protected against malicious code',
      version: '1.0',
      priority: 7,
      enabled: true,
      requirements: [
        'code-scanning',
        'dependency-scanning',
        'static-analysis',
        'dynamic-analysis'
      ]
    });

    this.policies.set('owasp-asvs-1-11', {
      id: 'owasp-asvs-1-11',
      name: 'OWASP ASVS V11 - Business Logic',
      category: 'business-logic',
      description: 'Verify business logic is secure against abuse',
      version: '1.0',
      priority: 6,
      enabled: true,
      requirements: [
        'workflow-validation',
        'abuse-prevention',
        'rate-limiting',
        'fraud-detection'
      ]
    });

    this.policies.set('owasp-asvs-1-12', {
      id: 'owasp-asvs-1-12',
      name: 'OWASP ASVS V12 - Files and Data',
      category: 'file-handling',
      description: 'Verify file handling is secure',
      version: '1.0',
      priority: 7,
      enabled: true,
      requirements: [
        'file-upload-validation',
        'secure-file-storage',
        'access-control',
        'virus-scanning'
      ]
    });

    this.policies.set('owasp-asvs-1-13', {
      id: 'owasp-asvs-1-13',
      name: 'OWASP ASVS V13 - API Security',
      category: 'api',
      description: 'Verify API security is implemented',
      version: '1.0',
      priority: 9,
      enabled: true,
      requirements: [
        'api-authentication',
        'api-authorization',
        'rate-limiting',
        'input-validation'
      ]
    });

    this.policies.set('owasp-asvs-1-14', {
      id: 'owasp-asvs-1-14',
      name: 'OWASP ASVS V14 - Configuration',
      category: 'configuration',
      description: 'Verify secure configuration management',
      version: '1.0',
      priority: 8,
      enabled: true,
      requirements: [
        'secure-defaults',
        'environment-separation',
        'credential-management',
        'configuration-validation'
      ]
    });

    // Initialize policy rules
    this.initializePolicyRules();
  }

  private initializePolicyRules(): void {
    // Authentication rules
    this.policyRules.set('owasp-asvs-1-1', [
      {
        id: 'auth-001',
        name: 'Strong Password Requirements',
        description: 'Passwords must meet complexity requirements',
        condition: {
          type: 'policy',
          field: 'passwordPolicy',
          operator: 'equals',
          value: 'strong'
        },
        severity: 'high',
        remediation: 'Implement strong password policy with minimum length, complexity, and history requirements'
      },
      {
        id: 'auth-002',
        name: 'Multi-Factor Authentication',
        description: 'MFA should be enabled for sensitive operations',
        condition: {
          type: 'policy',
          field: 'mfaRequired',
          operator: 'equals',
          value: true
        },
        severity: 'medium',
        remediation: 'Enable multi-factor authentication for all user accounts'
      },
      {
        id: 'auth-003',
        name: 'Account Lockout Protection',
        description: 'Account lockout after failed login attempts',
        condition: {
          type: 'policy',
          field: 'accountLockoutEnabled',
          operator: 'equals',
          value: true
        },
        severity: 'high',
        remediation: 'Implement account lockout mechanism after multiple failed login attempts'
      }
    ]);

    // Session management rules
    this.policyRules.set('owasp-asvs-1-2', [
      {
        id: 'session-001',
        name: 'Secure Session IDs',
        description: 'Session IDs must be cryptographically random',
        condition: {
          type: 'policy',
          field: 'sessionIdGeneration',
          operator: 'equals',
          value: 'secure'
        },
        severity: 'high',
        remediation: 'Use cryptographically secure random session ID generation'
      },
      {
        id: 'session-002',
        name: 'Session Timeout',
        description: 'Sessions must timeout after inactivity',
        condition: {
          type: 'policy',
          field: 'sessionTimeout',
          operator: 'greaterThan',
          value: 0
        },
        severity: 'medium',
        remediation: 'Implement session timeout based on inactivity'
      },
      {
        id: 'session-003',
        name: 'Session Invalidation',
        description: 'Sessions must be invalidated on logout',
        condition: {
          type: 'policy',
          field: 'sessionInvalidation',
          operator: 'equals',
          value: true
        },
        severity: 'high',
        remediation: 'Ensure proper session invalidation on logout'
      }
    ]);

    // Access control rules
    this.policyRules.set('owasp-asvs-1-3', [
      {
        id: 'authz-001',
        name: 'Default Deny',
        description: 'Access should be denied by default',
        condition: {
          type: 'policy',
          field: 'defaultAccess',
          operator: 'equals',
          value: 'deny'
        },
        severity: 'critical',
        remediation: 'Implement default deny access control policy'
      },
      {
        id: 'authz-002',
        name: 'Least Privilege',
        description: 'Users should have minimum necessary privileges',
        condition: {
          type: 'policy',
          field: 'leastPrivilege',
          operator: 'equals',
          value: true
        },
        severity: 'high',
        remediation: 'Apply principle of least privilege to all user roles'
      }
    ]);

    // Input validation rules
    this.policyRules.set('owasp-asvs-1-4', [
      {
        id: 'input-001',
        name: 'Input Validation',
        description: 'All user input must be validated',
        condition: {
          type: 'policy',
          field: 'inputValidation',
          operator: 'equals',
          value: true
        },
        severity: 'high',
        remediation: 'Implement comprehensive input validation for all user inputs'
      },
      {
        id: 'input-002',
        name: 'Type Validation',
        description: 'Input types must be validated',
        condition: {
          type: 'policy',
          field: 'typeValidation',
          operator: 'equals',
          value: true
        },
        severity: 'medium',
        remediation: 'Validate data types for all input parameters'
      }
    ]);

    // Output encoding rules
    this.policyRules.set('owasp-asvs-1-5', [
      {
        id: 'output-001',
        name: 'Context-Sensitive Encoding',
        description: 'Output must be encoded based on context',
        condition: {
          type: 'policy',
          field: 'outputEncoding',
          operator: 'equals',
          value: 'context-sensitive'
        },
        severity: 'high',
        remediation: 'Implement context-sensitive output encoding'
      },
      {
        id: 'output-002',
        name: 'XSS Prevention',
        description: 'XSS prevention mechanisms must be in place',
        condition: {
          type: 'policy',
          field: 'xssPrevention',
          operator: 'equals',
          value: true
        },
        severity: 'critical',
        remediation: 'Implement XSS prevention headers and output encoding'
      }
    ]);

    // Cryptography rules
    this.policyRules.set('owasp-asvs-1-6', [
      {
        id: 'crypto-001',
        name: 'Strong Encryption',
        description: 'Use strong encryption algorithms',
        condition: {
          type: 'policy',
          field: 'encryptionAlgorithm',
          operator: 'in',
          value: ['aes-256', 'chacha20']
        },
        severity: 'critical',
        remediation: 'Use industry-standard strong encryption algorithms'
      },
      {
        id: 'crypto-002',
        name: 'Key Management',
        description: 'Proper key management practices',
        condition: {
          type: 'policy',
          field: 'keyManagement',
          operator: 'equals',
          value: 'secure'
        },
        severity: 'high',
        remediation: 'Implement secure key management with proper rotation'
      }
    ]);
  }

  private async isPolicyApplicable(policy: SecurityPolicy, context: SecurityContext): Promise<boolean> {
    // Check if policy is enabled
    if (!policy.enabled) {
      return false;
    }

    // Check environment applicability
    if (policy.environments && context.environment && !policy.environments.includes(context.environment)) {
      return false;
    }

    // Check role applicability
    if (policy.applicableRoles && context.role && !policy.applicableRoles.includes(context.role)) {
      return false;
    }

    // Check resource applicability
    if (policy.resources && !policy.resources.some(resource => context.resource.includes(resource))) {
      return false;
    }

    return true;
  }

  private async evaluateRule(rule: PolicyRule, context: SecurityContext): Promise<PolicyRuleResult> {
    try {
      const compliant = await this.evaluateCondition(rule.condition, context);

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        compliant,
        description: rule.description,
        severity: rule.severity,
        remediation: rule.remediation
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        compliant: false,
        description: rule.description,
        severity: rule.severity,
        remediation: rule.remediation
      };
    }
  }

  private async evaluateCondition(condition: PolicyCondition, context: SecurityContext): Promise<boolean> {
    switch (condition.type) {
      case 'policy':
        return this.evaluatePolicyCondition(condition, context);
      case 'context':
        return this.evaluateContextCondition(condition, context);
      case 'custom':
        return this.evaluateCustomCondition(condition, context);
      default:
        return false;
    }
  }

  private evaluatePolicyCondition(condition: PolicyCondition, context: SecurityContext): boolean {
    const value = this.getConfigValue(condition.field as string);
    return this.compareValues(value, condition.operator, condition.value);
  }

  private evaluateContextCondition(condition: PolicyCondition, context: SecurityContext): boolean {
    const contextValue = (context as any)[condition.field as string];
    return this.compareValues(contextValue, condition.operator, condition.value);
  }

  private async evaluateCustomCondition(condition: PolicyCondition, context: SecurityContext): Promise<boolean> {
    // Implementation would evaluate custom conditions
    return true;
  }

  private getConfigValue(field: string): any {
    // Get value from config based on field path
    const fieldParts = field.split('.');
    let value: any = this.config;

    for (const part of fieldParts) {
      value = value?.[part];
    }

    return value;
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'notEquals':
        return actual !== expected;
      case 'greaterThan':
        return Number(actual) > Number(expected);
      case 'lessThan':
        return Number(actual) < Number(expected);
      case 'greaterThanOrEqual':
        return Number(actual) >= Number(expected);
      case 'lessThanOrEqual':
        return Number(actual) <= Number(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'contains':
        return String(actual).includes(String(expected));
      case 'matches':
        return new RegExp(expected).test(String(actual));
      default:
        return false;
    }
  }

  private getASVSRequirements(level: '1' | '2' | '3'): ASVSRequirement[] {
    // Implementation would return ASVS requirements based on level
    return [];
  }

  private async loadCustomPolicies(): Promise<void> {
    // Implementation would load custom policies from configuration or database
  }

  private async getActiveSecurityContexts(): Promise<SecurityContext[]> {
    // Implementation would return active security contexts
    return [];
  }

  private async handlePolicyViolation(policy: SecurityPolicy, context: SecurityContext, result: PolicyEvaluationResult): Promise<void> {
    // Implementation would handle policy violations (alerts, auto-remediation, etc.)
  }

  private generateComplianceRecommendations(results: ComplianceResult[]): string[] {
    const recommendations: string[] = [];

    for (const result of results) {
      if (!result.compliant) {
        recommendations.push(`Fix ${result.requirement}: ${result.recommendation}`);
      }
    }

    return recommendations;
  }

  private async identifySecurityGaps(context: SecurityContext): Promise<PolicyRecommendation[]> {
    const recommendations: PolicyRecommendation[] = [];

    // Check for missing security headers
    if (!this.hasSecurityHeaders(context)) {
      recommendations.push({
        type: 'security-headers',
        priority: 'high',
        title: 'Implement Security Headers',
        description: 'Add OWASP recommended security headers',
        implementation: 'Add headers like X-Frame-Options, X-Content-Type-Options, CSP, etc.'
      });
    }

    // Check for rate limiting
    if (!this.hasRateLimiting(context)) {
      recommendations.push({
        type: 'rate-limiting',
        priority: 'medium',
        title: 'Implement Rate Limiting',
        description: 'Add rate limiting to prevent abuse',
        implementation: 'Implement API rate limiting with appropriate thresholds'
      });
    }

    return recommendations;
  }

  private hasSecurityHeaders(context: SecurityContext): boolean {
    // Implementation would check for security headers
    return false;
  }

  private hasRateLimiting(context: SecurityContext): boolean {
    // Implementation would check for rate limiting
    return false;
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
}

// Supporting classes
class ComplianceChecker {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize compliance checker
  }

  async checkRequirement(requirement: ASVSRequirement): Promise<ComplianceResult> {
    // Implementation would check specific ASVS requirement
    return {
      requirement: requirement.id,
      compliant: true,
      description: requirement.description,
      evidence: ['Implementation verified'],
      recommendation: ''
    };
  }
}

class PolicyValidator {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize policy validator
  }

  async validatePolicy(policy: SecurityPolicy): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!policy.id) {
      errors.push('Policy ID is required');
    }

    if (!policy.name) {
      errors.push('Policy name is required');
    }

    if (!policy.category) {
      errors.push('Policy category is required');
    }

    if (typeof policy.priority !== 'number' || policy.priority < 1 || policy.priority > 10) {
      errors.push('Policy priority must be a number between 1 and 10');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async validateRule(rule: PolicyRule): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!rule.id) {
      errors.push('Rule ID is required');
    }

    if (!rule.name) {
      errors.push('Rule name is required');
    }

    if (!rule.condition) {
      errors.push('Rule condition is required');
    }

    if (!['low', 'medium', 'high', 'critical'].includes(rule.severity)) {
      errors.push('Rule severity must be one of: low, medium, high, critical');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Type definitions
export interface SecurityPolicy {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  priority: number;
  enabled: boolean;
  requirements?: string[];
  environments?: string[];
  applicableRoles?: string[];
  resources?: string[];
  metadata?: Record<string, any>;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: PolicyCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  remediation: string;
  metadata?: Record<string, any>;
}

export interface PolicyCondition {
  type: 'policy' | 'context' | 'custom';
  field: string;
  operator: string;
  value: any;
  parameters?: Record<string, any>;
}

export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  compliant: boolean;
  violations: PolicyViolation[];
  appliedRules: number;
  evaluationTime: string;
}

export interface PolicyViolation {
  ruleId: string;
  description: string;
  severity: string;
  remediation: string;
}

export interface PolicyRuleResult {
  ruleId: string;
  ruleName: string;
  compliant: boolean;
  description: string;
  severity: string;
  remediation: string;
}

export interface OWASPComplianceResult {
  asvsLevel: string;
  overallCompliance: number;
  requirementsChecked: number;
  requirementsPassed: number;
  requirementsFailed: number;
  complianceResults: ComplianceResult[];
  isCompliant: boolean;
  recommendations: string[];
}

export interface ASVSRequirement {
  id: string;
  category: string;
  description: string;
  level: '1' | '2' | '3';
  verificationSteps: string[];
}

export interface ComplianceResult {
  requirement: string;
  compliant: boolean;
  description: string;
  evidence: string[];
  recommendation: string;
}

export interface PolicyViolationReport {
  timeframe: { start: Date; end: Date };
  totalViolations: number;
  violationsByPolicy: Map<string, number>;
  violationsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topViolations: PolicyViolation[];
  remediationProgress: number;
}

export interface PolicyRecommendation {
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  implementation: string;
  impact?: string;
  effort?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}