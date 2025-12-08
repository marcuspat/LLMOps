import { BaseVerificationRule } from '../../shared/base-classes.js';
import { VerificationIssue, IssueSeverity, RuleResult } from '../../shared/interfaces.js';

export class CodeStructureRule extends BaseVerificationRule {
  name = 'code_structure';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check function length
    const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g) || [];
    const longFunctions = functionMatches.filter(fn => fn.length > 500);

    if (longFunctions.length > 0) {
      issues.push(this.createIssue(
        'long_function',
        IssueSeverity.MEDIUM,
        `Found ${longFunctions.length} functions that are too long (>500 characters)`
      ));
      suggestions.push('Consider breaking down long functions into smaller, more focused functions');
      score -= 0.1;
    }

    // Check cyclomatic complexity (simplified)
    const complexityKeywords = content.match(/if|else|for|while|switch|catch/g) || [];
    const complexity = complexityKeywords.length;

    metrics.cyclomaticComplexity = complexity;
    if (complexity > 10) {
      issues.push(this.createIssue(
        'high_complexity',
        IssueSeverity.HIGH,
        `Code complexity is ${complexity}, consider refactoring`
      ));
      suggestions.push('Extract complex logic into separate methods or functions');
      score -= 0.15;
    }

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}

export class TypeSafetyRule extends BaseVerificationRule {
  name = 'type_safety';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check for TypeScript usage
    const hasTypeScript = content.includes(':') &&
                        (content.includes('interface') || content.includes('type'));

    if (!hasTypeScript) {
      issues.push(this.createIssue(
        'missing_types',
        IssueSeverity.HIGH,
        'Code lacks type annotations'
      ));
      suggestions.push('Add TypeScript type annotations for better type safety');
      score -= 0.3;
    }

    // Check for any types
    const anyTypes = content.match(/:\s*any/g) || [];
    metrics.anyTypeUsage = anyTypes.length;

    if (anyTypes.length > 0) {
      issues.push(this.createIssue(
        'any_type_usage',
        IssueSeverity.MEDIUM,
        `Found ${anyTypes.length} 'any' type usage`
      ));
      suggestions.push("Replace 'any' types with specific type definitions");
      score -= 0.1 * Math.min(anyTypes.length, 3);
    }

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}

export class PerformanceRule extends BaseVerificationRule {
  name = 'performance';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check for performance anti-patterns
    const performanceIssues = [
      { pattern: /\.length\s*\.\s*forEach\(/, message: 'Avoid chaining length and forEach', severity: IssueSeverity.MEDIUM },
      { pattern: /for\s*\([^)]*\+\+[^)]*\)/, message: 'Consider using for...of or Array methods', severity: IssueSeverity.LOW },
      { pattern: /JSON\.parse\(JSON\.stringify/, message: 'Deep copy using JSON stringify/parse is inefficient', severity: IssueSeverity.HIGH }
    ];

    performanceIssues.forEach(({ pattern, message, severity }) => {
      if (new RegExp(pattern).test(content)) {
        issues.push(this.createIssue('performance_anti_pattern', severity, message));
        score -= 0.05;
      }
    });

    // Check for potential memory leaks
    const eventListenerAdd = content.match(/addEventListener/g) || [];
    const eventListenerRemove = content.match(/removeEventListener/g) || [];

    if (eventListenerAdd.length > eventListenerRemove.length) {
      issues.push(this.createIssue(
        'potential_memory_leak',
        IssueSeverity.MEDIUM,
        'More addEventListener than removeEventListener calls'
      ));
      suggestions.push('Ensure all event listeners are properly removed');
      score -= 0.1;
    }

    metrics.eventListenerBalance = eventListenerRemove.length / Math.max(eventListenerAdd.length, 1);

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}

export class MaintainabilityRule extends BaseVerificationRule {
  name = 'maintainability';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check for magic numbers
    const numberRegex = /\b\d{2,}\b/g;
    const numbers = content.match(numberRegex) || [];
    const magicNumbers = numbers.filter(n =>
      !n.includes('0') &&
      !n.includes('1') &&
      !n.includes('2') &&
      !n.includes('10') &&
      !content.includes(`const ${n}`)
    );

    if (magicNumbers.length > 0) {
      issues.push(this.createIssue(
        'magic_numbers',
        IssueSeverity.LOW,
        `Found ${magicNumbers.length} potential magic numbers`
      ));
      suggestions.push('Extract magic numbers into named constants');
      score -= 0.05 * Math.min(magicNumbers.length, 5);
    }

    // Check comment coverage
    const lines = content.split('\n');
    const commentLines = lines.filter(line =>
      line.trim().startsWith('//') || line.trim().startsWith('/*')
    );
    const commentRatio = commentLines.length / Math.max(lines.length, 1);

    metrics.commentRatio = commentRatio;
    if (commentRatio < 0.1) {
      issues.push(this.createIssue(
        'low_comment_coverage',
        IssueSeverity.LOW,
        'Code has very few comments'
      ));
      suggestions.push('Add comments to explain complex logic');
      score -= 0.05;
    }

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}