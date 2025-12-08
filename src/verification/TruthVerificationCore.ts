import { EventEmitter } from 'events';
import {
  TruthVerificationRequest,
  TruthVerificationResult,
  VerificationType,
  VerificationIssue,
  IssueSeverity
} from '../types/index.js';
import { VerificationRuleRegistry } from './VerificationRuleRegistry.js';
import { BaseComponent } from '../shared/base-classes.js';
import { IdGenerator, PerformanceUtils } from '../shared/utils.js';

interface VerificationStats {
  totalVerifications: number;
  averageScore: number;
  passRate: number;
  commonIssues: string[];
  scoreTrend: number[];
}

interface RuleExecutionResult {
  score: number;
  issues: VerificationIssue[];
  suggestions: string[];
  metrics: Record<string, number>;
}

export class TruthVerificationCore extends BaseComponent {
  private static instance: TruthVerificationCore;
  private readonly DEFAULT_THRESHOLD = 0.95;
  private ruleRegistry: VerificationRuleRegistry;
  private verificationHistory: VerificationResult[] = [];

  private constructor() {
    super();
    this.ruleRegistry = new VerificationRuleRegistry();
  }

  public static getInstance(): TruthVerificationCore {
    if (!TruthVerificationCore.instance) {
      TruthVerificationCore.instance = new TruthVerificationCore();
    }
    return TruthVerificationCore.instance;
  }

  /**
   * Verify content against truth standards
   */
  public async verify(request: TruthVerificationRequest): Promise<TruthVerificationResult> {
    const { result, duration } = await PerformanceUtils.measureTime(async () => {
      return await this.executeVerification(request);
    });

    // Store in history for stats
    this.verificationHistory.push(result);
    if (this.verificationHistory.length > 1000) {
      this.verificationHistory = this.verificationHistory.slice(-500); // Keep last 500
    }

    this.emitEvent('verification_completed', {
      request,
      result,
      duration,
      threshold: request.threshold ?? this.DEFAULT_THRESHOLD
    });

    return result;
  }

  /**
   * Batch verification for multiple content items
   */
  public async verifyBatch(requests: TruthVerificationRequest[]): Promise<TruthVerificationResult[]> {
    this.logger.info(`Starting batch verification for ${requests.length} requests`);

    const results = await Promise.all(
      requests.map(request => this.verify(request))
    );

    this.emitEvent('batch_verification_completed', {
      requestCount: requests.length,
      results,
      averageScore: this.calculateAverageScore(results)
    });

    return results;
  }

  /**
   * Get verification statistics and trends
   */
  public getVerificationStats(timeframe: { start: Date; end: Date }): VerificationStats {
    const filteredResults = this.filterResultsByTimeframe(this.verificationHistory, timeframe);

    return {
      totalVerifications: filteredResults.length,
      averageScore: this.calculateAverageScore(filteredResults),
      passRate: this.calculatePassRate(filteredResults),
      commonIssues: this.getCommonIssues(filteredResults),
      scoreTrend: this.calculateScoreTrend(filteredResults)
    };
  }

  private async executeVerification(request: TruthVerificationRequest): Promise<TruthVerificationResult> {
    const threshold = request.threshold ?? this.DEFAULT_THRESHOLD;
    const rules = this.ruleRegistry.getRules(request.type);

    if (rules.length === 0) {
      throw new Error(`No verification rules found for type: ${request.type}`);
    }

    const executionResults = await this.executeRules(rules, request);
    const finalResult = this.aggregateResults(executionResults, threshold);

    return {
      ...finalResult,
      timestamp: new Date(),
      requestId: request.context?.requestId ?? IdGenerator.generate('verification')
    };
  }

  private async executeRules(
    rules: any[],
    request: TruthVerificationRequest
  ): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];

    for (const rule of rules) {
      try {
        const ruleResult = await rule.execute(request.content, request.context);
        results.push(ruleResult);
      } catch (error) {
        this.handleError(error as Error, `Rule execution failed: ${rule.name}`);
        results.push(this.createErrorResult(error as Error));
      }
    }

    return results;
  }

  private aggregateResults(
    ruleResults: RuleExecutionResult[],
    threshold: number
  ): Omit<TruthVerificationResult, 'timestamp' | 'requestId'> {
    const allIssues = ruleResults.flatMap(result => result.issues);
    const allSuggestions = ruleResults.flatMap(result => result.suggestions);
    const allMetrics = ruleResults.reduce((acc, result) => ({ ...acc, ...result.metrics }), {});

    const totalScore = ruleResults.reduce((sum, result) => sum + result.score, 0);
    const finalScore = ruleResults.length > 0 ? totalScore / ruleResults.length : 0;
    const passed = finalScore >= threshold;

    return {
      score: finalScore,
      passed,
      confidence: this.calculateConfidence(allIssues, ruleResults.length),
      details: {
        issues: allIssues,
        suggestions: allSuggestions,
        metrics: allMetrics
      }
    };
  }

  private createErrorResult(error: Error): RuleExecutionResult {
    return {
      score: 0,
      issues: [{
        type: 'rule_execution_error',
        severity: IssueSeverity.MEDIUM,
        message: `Rule execution failed: ${error.message}`
      }],
      suggestions: [],
      metrics: {}
    };
  }

  private calculateConfidence(issues: VerificationIssue[], ruleCount: number): number {
    if (ruleCount === 0) return 0;

    const criticalIssues = issues.filter(i => i.severity === IssueSeverity.CRITICAL).length;
    const highIssues = issues.filter(i => i.severity === IssueSeverity.HIGH).length;

    const issuePenalty = (criticalIssues * 0.2) + (highIssues * 0.1);
    return Math.max(0, 1 - issuePenalty);
  }

  private calculateAverageScore(results: TruthVerificationResult[]): number {
    if (results.length === 0) return 0;
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    return totalScore / results.length;
  }

  private calculatePassRate(results: TruthVerificationResult[]): number {
    if (results.length === 0) return 0;
    const passedCount = results.filter(result => result.passed).length;
    return passedCount / results.length;
  }

  private getCommonIssues(results: TruthVerificationResult[]): string[] {
    const issueFrequency = new Map<string, number>();

    results.forEach(result => {
      result.details.issues.forEach(issue => {
        const count = issueFrequency.get(issue.type) || 0;
        issueFrequency.set(issue.type, count + 1);
      });
    });

    return Array.from(issueFrequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type]) => type);
  }

  private calculateScoreTrend(results: TruthVerificationResult[]): number[] {
    // Simple moving average trend
    const windowSize = Math.min(10, results.length);
    if (results.length < windowSize) return results.map(r => r.score);

    const trend: number[] = [];
    for (let i = windowSize - 1; i < results.length; i++) {
      const window = results.slice(i - windowSize + 1, i + 1);
      const average = window.reduce((sum, r) => sum + r.score, 0) / window.length;
      trend.push(average);
    }

    return trend;
  }

  private filterResultsByTimeframe(
    results: TruthVerificationResult[],
    timeframe: { start: Date; end: Date }
  ): TruthVerificationResult[] {
    return results.filter(result => {
      const timestamp = new Date(result.timestamp);
      return timestamp >= timeframe.start && timestamp <= timeframe.end;
    });
  }

  // Public methods for rule management
  public getRuleRegistry(): VerificationRuleRegistry {
    return this.ruleRegistry;
  }

  public getVerificationHistory(): TruthVerificationResult[] {
    return [...this.verificationHistory];
  }

  public clearHistory(): void {
    this.verificationHistory = [];
    this.emitEvent('history_cleared', { timestamp: new Date() });
  }
}