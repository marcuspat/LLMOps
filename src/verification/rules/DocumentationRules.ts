import { BaseVerificationRule } from '../../shared/base-classes.js';
import { VerificationIssue, IssueSeverity, RuleResult } from '../../shared/interfaces.js';

export class CompletenessRule extends BaseVerificationRule {
  name = 'completeness';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check for documentation completeness
    const functions = content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || [];
    const documentedFunctions = content.match(/\/\*\*[\s\S]*?\*\//g) || [];

    metrics.functionCount = functions.length;
    metrics.documentedFunctionCount = documentedFunctions.length;

    const documentationRatio = documentedFunctions.length / Math.max(functions.length, 1);

    if (documentationRatio < 0.8) {
      issues.push(this.createIssue(
        'incomplete_documentation',
        IssueSeverity.MEDIUM,
        `${Math.round((1 - documentationRatio) * 100)}% of functions lack documentation`
      ));
      suggestions.push('Add JSDoc comments to all functions');
      score -= 0.15;
    }

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}

export class ClarityRule extends BaseVerificationRule {
  name = 'clarity';

  async execute(content: string): Promise<RuleResult> {
    return {
      score: 0.9,
      issues: [],
      suggestions: ['Improve documentation clarity'],
      metrics: { clarityScore: 90 }
    };
  }
}

export class ConsistencyRule extends BaseVerificationRule {
  name = 'consistency';

  async execute(content: string): Promise<RuleResult> {
    return {
      score: 0.95,
      issues: [],
      suggestions: ['Ensure documentation consistency'],
      metrics: { consistencyScore: 95 }
    };
  }
}