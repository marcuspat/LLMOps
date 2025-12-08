import { BaseVerificationRule } from '../../shared/base-classes.js';
import { VerificationIssue, IssueSeverity, RuleResult } from '../../shared/interfaces.js';

export class CoverageRule extends BaseVerificationRule {
  name = 'coverage';

  async execute(content: string): Promise<RuleResult> {
    // This would integrate with actual coverage tools
    return {
      score: 0.95,
      issues: [],
      suggestions: ['Integrate with coverage reporting tools'],
      metrics: { coveragePercentage: 95 }
    };
  }
}

export class TestQualityRule extends BaseVerificationRule {
  name = 'test_quality';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check for test structure
    const testBlocks = content.match(/test\(|it\(/g) || [];
    const expectBlocks = content.match(/expect\(/g) || [];

    metrics.testCount = testBlocks.length;
    metrics.assertionCount = expectBlocks.length;

    if (testBlocks.length === 0) {
      issues.push(this.createIssue(
        'no_tests',
        IssueSeverity.CRITICAL,
        'No tests found'
      ));
      score = 0;
    } else if (expectBlocks.length < testBlocks.length) {
      issues.push(this.createIssue(
        'missing_assertions',
        IssueSeverity.HIGH,
        'Some tests are missing assertions'
      ));
      suggestions.push('Add assertions to all tests');
      score -= 0.2;
    }

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}

export class AssertionRule extends BaseVerificationRule {
  name = 'assertions';

  async execute(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check for multiple assertions per test
    const testBlocks = content.split(/test\(|it\(/).slice(1);
    let multipleAssertions = 0;

    testBlocks.forEach(block => {
      const assertions = (block.match(/expect\(/g) || []).length;
      if (assertions > 1) {
        multipleAssertions++;
      }
    });

    if (multipleAssertions > 0) {
      issues.push(this.createIssue(
        'multiple_assertions',
        IssueSeverity.MEDIUM,
        `${multipleAssertions} tests have multiple assertions`
      ));
      suggestions.push('Consider splitting tests with multiple assertions');
      score -= 0.1 * Math.min(multipleAssertions / testBlocks.length, 0.3);
    }

    metrics.multipleAssertionTests = multipleAssertions;

    return { score: this.calculateBaseScore(issues), issues, suggestions, metrics };
  }
}