import { BaseVerificationRule } from '../../shared/base-classes.js';
import { VerificationIssue, IssueSeverity, RuleResult } from '../../shared/interfaces.js';

export class VulnerabilityRule extends BaseVerificationRule {
  name = 'vulnerability';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check for common security issues
    const securityPatterns = [
      { pattern: /eval\(/, severity: IssueSeverity.CRITICAL, message: 'Use of eval() function is dangerous' },
      { pattern: /innerHTML\s*=/, severity: IssueSeverity.HIGH, message: 'Direct innerHTML assignment can lead to XSS' },
      { pattern: /document\.write/, severity: IssueSeverity.HIGH, message: 'document.write can lead to XSS attacks' },
      { pattern: /setTimeout\s*\(\s*["']/, severity: IssueSeverity.MEDIUM, message: 'setTimeout with string arguments can lead to code injection' }
    ];

    securityPatterns.forEach(({ pattern, severity, message }) => {
      if (pattern.test(content)) {
        issues.push(this.createIssue('security_vulnerability', severity, message));
        score -= severity === IssueSeverity.CRITICAL ? 0.3 : 0.1;
      }
    });

    metrics.securityIssuesFound = issues.length;

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}

export class InputValidationRule extends BaseVerificationRule {
  name = 'input_validation';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check for input validation patterns
    const hasValidation = content.includes('validate') ||
                         content.includes('sanitize') ||
                         content.includes('typeof') ||
                         content.includes('instanceof');

    if (!hasValidation && (content.includes('req.body') || content.includes('params'))) {
      issues.push(this.createIssue(
        'missing_input_validation',
        IssueSeverity.HIGH,
        'No input validation detected for user inputs'
      ));
      suggestions.push('Add input validation for all user inputs');
      score -= 0.2;
    }

    metrics.hasInputValidation = Number(hasValidation);

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}

export class AuthenticationRule extends BaseVerificationRule {
  name = 'authentication';

  async execute(content: string): Promise<RuleResult> {
    // This would check for proper authentication patterns
    return {
      score: 0.9,
      issues: [],
      suggestions: ['Implement proper authentication checks'],
      metrics: { hasAuth: 0 }
    };
  }
}