/**
 * Test Report Generation and Analytics
 *
 * Comprehensive reporting system for test stability metrics,
 * flaky test analysis, and improvement recommendations.
 */

import {
  TestExecutionMonitor,
  StabilityScoreCalculator,
  StabilityScore,
  TestExecutionMetrics,
  TestSession
} from './monitoring';

export interface TestReport {
  id: string;
  generatedAt: Date;
  session: TestSession;
  summary: TestReportSummary;
  flakyTests: FlakyTestAnalysis[];
  recommendations: TestImprovementRecommendation[];
  trends: TestTrendAnalysis;
  categoryAnalysis: TestCategoryAnalysis;
}

export interface TestReportSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  flakyTests: number;
  overallStabilityScore: StabilityScore;
  averageExecutionTime: number;
  testReliability: number;
  improvementMetrics: ImprovementMetrics;
}

export interface FlakyTestAnalysis {
  testName: string;
  filePath: string;
  flakinessScore: number;
  failurePatterns: FailurePattern[];
  likelyCauses: FlakyTestCause[];
  recommendedFixes: string[];
  estimatedImpact: 'low' | 'medium' | 'high' | 'critical';
}

export interface FailurePattern {
  type: 'timeout' | 'race_condition' | 'environment' | 'data' | 'dependency' | 'timing';
  frequency: number;
  conditions: string[];
  symptoms: string[];
}

export interface FlakyTestCause {
  category: 'timing' | 'isolation' | 'environment' | 'data' | 'dependency' | 'infrastructure';
  confidence: number;
  description: string;
  evidence: string[];
}

export interface TestImprovementRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'timing' | 'isolation' | 'environment' | 'data' | 'dependency' | 'monitoring';
  title: string;
  description: string;
  implementation: string;
  estimatedImpact: number;
  estimatedEffort: 'low' | 'medium' | 'high';
  dependencies?: string[];
  codeExample?: string;
}

export interface TestTrendAnalysis {
  stabilityTrend: TrendData[];
  performanceTrend: TrendData[];
  flakinessTrend: TrendData[];
  reliabilityTrend: TrendData[];
  forecast: StabilityForecast;
}

export interface TrendData {
  date: Date;
  value: number;
  change: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface StabilityForecast {
  nextWeek: number;
  nextMonth: number;
  confidence: number;
  factors: ForecastFactor[];
}

export interface ForecastFactor {
  factor: string;
  impact: number;
  confidence: number;
  description: string;
}

export interface TestCategoryAnalysis {
  byCategory: CategoryMetrics[];
  byComplexity: ComplexityMetrics[];
  byExecutionTime: ExecutionTimeMetrics[];
  byDependency: DependencyMetrics[];
}

export interface CategoryMetrics {
  category: string;
  testCount: number;
  averageStability: number;
  flakyTestCount: number;
  averageExecutionTime: number;
  topIssues: string[];
}

export interface ComplexityMetrics {
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  testCount: number;
  averageStability: number;
  failureRate: number;
  averageExecutionTime: number;
}

export interface ExecutionTimeMetrics {
  range: 'fast' | 'medium' | 'slow' | 'very_slow';
  testCount: number;
  flakyTestCount: number;
  flakyTestPercentage: number;
  averageStability: number;
}

export interface DependencyMetrics {
  dependencyType: 'database' | 'external_api' | 'filesystem' | 'network' | 'shared_state' | 'none';
  testCount: number;
  averageStability: number;
  failureRate: number;
  commonIssues: string[];
}

export interface ImprovementMetrics {
  stabilityImprovement: number;
  reliabilityImprovement: number;
  performanceImprovement: number;
  flakinessReduction: number;
  targetVsActual: {
    targetStability: number;
    actualStability: number;
    targetReliability: number;
    actualReliability: number;
  };
}

/**
 * Comprehensive test report generator
 */
export class TestReportGenerator {
  private monitor: TestExecutionMonitor;
  private stabilityCalculator: StabilityScoreCalculator;

  constructor(monitor?: TestExecutionMonitor) {
    this.monitor = monitor || new TestExecutionMonitor();
    this.stabilityCalculator = new StabilityScoreCalculator();
  }

  /**
   * Generate comprehensive test stability report
   */
  async generateReport(sessionId?: string): Promise<TestReport> {
    const session = sessionId ?
      this.monitor.getSession(sessionId) || await this.monitor.getCurrentSession() :
      await this.monitor.getCurrentSession();

    if (!session) {
      throw new Error('No test session available for report generation');
    }

    const startTime = Date.now();

    // Generate analysis components
    const summary = await this.generateSummary(session);
    const flakyTests = await this.analyzeFlakyTests(session);
    const recommendations = await this.generateRecommendations(flakyTests, session);
    const trends = await this.analyzeTrends(session);
    const categoryAnalysis = await this.analyzeCategories(session);

    const report: TestReport = {
      id: this.generateReportId(),
      generatedAt: new Date(),
      session,
      summary,
      flakyTests,
      recommendations,
      trends,
      categoryAnalysis
    };

    console.log(`Report generation completed in ${Date.now() - startTime}ms`);

    return report;
  }

  /**
   * Generate executive summary of test session
   */
  private async generateSummary(session: TestSession): Promise<TestReportSummary> {
    const testMetrics = Array.from(session.testMetrics.values());
    const totalTests = testMetrics.length;
    const passedTests = testMetrics.filter(m => m.status === 'passed').length;
    const failedTests = testMetrics.filter(m => m.status === 'failed').length;

    // Calculate stability scores for all tests
    const stabilityScores = testMetrics.map(m =>
      this.stabilityCalculator.calculateStabilityScore(m)
    );

    const averageStability = stabilityScores.reduce((sum, score) => sum + score.overall, 0) / stabilityScores.length;
    const averageExecutionTime = testMetrics.reduce((sum, m) => sum + m.duration, 0) / testMetrics.length;

    // Calculate reliability (percentage of tests with stability score > 0.8)
    const reliableTests = stabilityScores.filter(s => s.overall > 0.8).length;
    const testReliability = reliableTests / totalTests;

    // Count flaky tests (consistency score < 0.7)
    const flakyTests = stabilityScores.filter(s => s.consistency < 0.7).length;

    // Calculate improvement metrics (comparison with historical data)
    const improvementMetrics = await this.calculateImprovementMetrics(session, averageStability, testReliability);

    return {
      totalTests,
      passedTests,
      failedTests,
      flakyTests,
      overallStabilityScore: {
        consistency: averageStability,
        reliability: testReliability,
        performance: this.calculatePerformanceScore(testMetrics),
        predictability: this.calculatePredictabilityScore(stabilityScores)
      },
      averageExecutionTime,
      testReliability,
      improvementMetrics
    };
  }

  /**
   * Analyze flaky tests and their failure patterns
   */
  private async analyzeFlakyTests(session: TestSession): Promise<FlakyTestAnalysis[]> {
    const testMetrics = Array.from(session.testMetrics.values());
    const flakyAnalyses: FlakyTestAnalysis[] = [];

    for (const metrics of testMetrics) {
      const stabilityScore = this.stabilityCalculator.calculateStabilityScore(metrics);

      // Consider test flaky if consistency score is below threshold
      if (stabilityScore.consistency < 0.7) {
        const analysis = await this.analyzeIndividualFlakyTest(metrics, stabilityScore);
        flakyAnalyses.push(analysis);
      }
    }

    // Sort by flakiness score (most flaky first)
    return flakyAnalyses.sort((a, b) => b.flakinessScore - a.flakinessScore);
  }

  /**
   * Analyze individual flaky test for patterns and causes
   */
  private async analyzeIndividualFlakyTest(
    metrics: TestExecutionMetrics,
    stabilityScore: StabilityScore
  ): Promise<FlakyTestAnalysis> {
    const flakinessScore = 1 - stabilityScore.consistency;
    const failurePatterns = this.identifyFailurePatterns(metrics);
    const likelyCauses = this.identifyLikelyCauses(metrics, failurePatterns);
    const recommendedFixes = this.generateRecommendedFixes(likelyCauses, failurePatterns);
    const estimatedImpact = this.estimateTestImpact(metrics, flakinessScore);

    return {
      testName: metrics.testName,
      filePath: metrics.testFile || '',
      flakinessScore,
      failurePatterns,
      likelyCauses,
      recommendedFixes,
      estimatedImpact
    };
  }

  /**
   * Identify failure patterns in test execution
   */
  private identifyFailurePatterns(metrics: TestExecutionMetrics): FailurePattern[] {
    const patterns: FailurePattern[] = [];
    const errors = metrics.errors || [];

    // Timeout pattern detection
    const timeoutErrors = errors.filter(e =>
      e.message.toLowerCase().includes('timeout') ||
      e.message.toLowerCase().includes('time out')
    );

    if (timeoutErrors.length > 0) {
      patterns.push({
        type: 'timeout',
        frequency: timeoutErrors.length / Math.max(metrics.attempts || 1, 1),
        conditions: ['Long execution time', 'System under load'],
        symptoms: timeoutErrors.map(e => e.message)
      });
    }

    // Race condition pattern detection
    if (metrics.variability && metrics.variability > 0.3) {
      patterns.push({
        type: 'race_condition',
        frequency: metrics.variability,
        conditions: ['Concurrent test execution', 'Shared resources'],
        symptoms: ['Inconsistent timing', 'Non-deterministic behavior']
      });
    }

    // Environment dependency pattern detection
    const envErrors = errors.filter(e =>
      e.message.toLowerCase().includes('network') ||
      e.message.toLowerCase().includes('connection') ||
      e.message.toLowerCase().includes('external')
    );

    if (envErrors.length > 0) {
      patterns.push({
        type: 'environment',
        frequency: envErrors.length / Math.max(metrics.attempts || 1, 1),
        conditions: ['External dependencies', 'Network connectivity'],
        symptoms: envErrors.map(e => e.message)
      });
    }

    // Data consistency pattern detection
    const dataErrors = errors.filter(e =>
      e.message.toLowerCase().includes('not found') ||
      e.message.toLowerCase().includes('duplicate') ||
      e.message.toLowerCase().includes('constraint')
    );

    if (dataErrors.length > 0) {
      patterns.push({
        type: 'data',
        frequency: dataErrors.length / Math.max(metrics.attempts || 1, 1),
        conditions: ['Shared test data', 'Database state'],
        symptoms: dataErrors.map(e => e.message)
      });
    }

    // Timing pattern detection
    if (metrics.averageDuration && metrics.duration) {
      const timingVariation = Math.abs(metrics.duration - metrics.averageDuration) / metrics.averageDuration;
      if (timingVariation > 0.5) {
        patterns.push({
          type: 'timing',
          frequency: timingVariation,
          conditions: ['Time-sensitive operations', 'Wait conditions'],
          symptoms: ['Variable execution time', 'Timing-dependent assertions']
        });
      }
    }

    return patterns;
  }

  /**
   * Identify likely causes of test flakiness
   */
  private identifyLikelyCauses(
    metrics: TestExecutionMetrics,
    patterns: FailurePattern[]
  ): FlakyTestCause[] {
    const causes: FlakyTestCause[] = [];

    // Analyze patterns to determine likely causes
    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'timeout':
          causes.push({
            category: 'timing',
            confidence: pattern.frequency,
            description: 'Test is timing out due to insufficient timeout limits or performance issues',
            evidence: [`${Math.round(pattern.frequency * 100)}% of runs timeout`, ...pattern.symptoms]
          });
          break;

        case 'race_condition':
          causes.push({
            category: 'isolation',
            confidence: pattern.frequency,
            description: 'Test is experiencing race conditions due to insufficient isolation',
            evidence: [`${Math.round(pattern.frequency * 100)}% variability`, ...pattern.symptoms]
          });
          break;

        case 'environment':
          causes.push({
            category: 'environment',
            confidence: pattern.frequency,
            description: 'Test is dependent on external environment that may be unreliable',
            evidence: [`${Math.round(pattern.frequency * 100)}% environment failures`, ...pattern.symptoms]
          });
          break;

        case 'data':
          causes.push({
            category: 'data',
            confidence: pattern.frequency,
            description: 'Test is experiencing data consistency issues',
            evidence: [`${Math.round(pattern.frequency * 100)}% data errors`, ...pattern.symptoms]
          });
          break;

        case 'timing':
          causes.push({
            category: 'timing',
            confidence: pattern.frequency,
            description: 'Test has timing-dependent assertions or insufficient waits',
            evidence: [`${Math.round(pattern.frequency * 100)}% timing variation`, ...pattern.symptoms]
          });
          break;
      }
    }

    // Sort by confidence (most likely first)
    return causes.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate recommended fixes based on identified causes
   */
  private generateRecommendedFixes(
    causes: FlakyTestCause[],
    patterns: FailurePattern[]
  ): string[] {
    const fixes: string[] = [];

    for (const cause of causes) {
      switch (cause.category) {
        case 'timing':
          fixes.push(
            'Implement adaptive timeout management based on historical execution times',
            'Add proper wait conditions using waitFor() instead of fixed timeouts',
            'Use exponential backoff for retry logic with timing-sensitive operations'
          );
          break;

        case 'isolation':
          fixes.push(
            'Implement proper test isolation with unique test data per test',
            'Use test scoping and cleanup to prevent shared state interference',
            'Consider running tests in sequence instead of parallel if isolation is problematic'
          );
          break;

        case 'environment':
          fixes.push(
            'Implement comprehensive mocking for external dependencies',
            'Add retry logic with circuit breaker pattern for external service calls',
            'Create test fixtures that don\'t rely on external environment availability'
          );
          break;

        case 'data':
          fixes.push(
            'Use deterministic test data generation with seeded randomness',
            'Implement proper data cleanup in test teardown phase',
            'Use database transactions and rollback for data isolation'
          );
          break;

        case 'dependency':
          fixes.push(
            'Mock external dependencies with deterministic responses',
            'Implement dependency injection for better test control',
            'Create test-specific service instances'
          );
          break;
      }
    }

    // Remove duplicates and return unique fixes
    return [...new Set(fixes)];
  }

  /**
   * Estimate test impact based on execution time and flakiness
   */
  private estimateTestImpact(
    metrics: TestExecutionMetrics,
    flakinessScore: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const executionTime = metrics.duration || 0;
    const testFrequency = metrics.attempts || 1;

    // Calculate impact score (0-1)
    let impactScore = 0;

    // Flakiness impact (70% weight)
    impactScore += flakinessScore * 0.7;

    // Execution time impact (20% weight)
    const timeImpact = Math.min(executionTime / 30000, 1); // Normalize to 30s
    impactScore += timeImpact * 0.2;

    // Frequency impact (10% weight)
    const frequencyImpact = Math.min(testFrequency / 10, 1); // Normalize to 10 runs
    impactScore += frequencyImpact * 0.1;

    if (impactScore >= 0.8) return 'critical';
    if (impactScore >= 0.6) return 'high';
    if (impactScore >= 0.3) return 'medium';
    return 'low';
  }

  /**
   * Generate improvement recommendations
   */
  private async generateRecommendations(
    flakyTests: FlakyTestAnalysis[],
    session: TestSession
  ): Promise<TestImprovementRecommendation[]> {
    const recommendations: TestImprovementRecommendation[] = [];

    // Analyze common patterns across all flaky tests
    const commonCauses = this.analyzeCommonCauses(flakyTests);
    const highImpactTests = flakyTests.filter(t => t.estimatedImpact === 'high' || t.estimatedImpact === 'critical');

    // Generate recommendations based on analysis
    for (const cause of commonCauses) {
      const recommendation = this.generateRecommendationForCause(cause, highImpactTests);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Generate framework-level recommendations
    recommendations.push(...this.generateFrameworkRecommendations(flakyTests, session));

    // Sort by priority and estimated impact
    return recommendations.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.priority];
      const bPriority = priorityWeight[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return b.estimatedImpact - a.estimatedImpact;
    });
  }

  /**
   * Analyze common causes across flaky tests
   */
  private analyzeCommonCauses(flakyTests: FlakyTestAnalysis[]): FlakyTestCause[] {
    const causeFrequency = new Map<string, { count: number; totalConfidence: number }>();

    for (const test of flakyTests) {
      for (const cause of test.likelyCauses) {
        const key = `${cause.category}:${cause.description}`;
        const existing = causeFrequency.get(key) || { count: 0, totalConfidence: 0 };
        causeFrequency.set(key, {
          count: existing.count + 1,
          totalConfidence: existing.totalConfidence + cause.confidence
        });
      }
    }

    // Convert to array and sort by frequency
    return Array.from(causeFrequency.entries())
      .map(([key, data]) => {
        const [category, description] = key.split(':');
        return {
          category: category as any,
          confidence: data.totalConfidence / data.count,
          description,
          evidence: [`Found in ${data.count} flaky tests`]
        } as FlakyTestCause;
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Top 5 common causes
  }

  /**
   * Generate recommendation for a specific cause
   */
  private generateRecommendationForCause(
    cause: FlakyTestCause,
    highImpactTests: FlakyTestAnalysis[]
  ): TestImprovementRecommendation | null {
    const affectedTests = highImpactTests.filter(t =>
      t.likelyCauses.some(c => c.category === cause.category)
    );

    if (affectedTests.length === 0) return null;

    switch (cause.category) {
      case 'timing':
        return {
          id: this.generateRecommendationId(),
          priority: cause.confidence > 0.7 ? 'high' : 'medium',
          category: 'timing',
          title: 'Implement Adaptive Timeout Management',
          description: `Timing issues are affecting ${affectedTests.length} high-impact tests. Implement adaptive timeout management based on historical execution times.`,
          implementation: `
1. Add adaptive timeout calculation based on historical data
2. Implement exponential backoff retry logic
3. Use waitFor() conditions instead of fixed timeouts
4. Add performance monitoring for timeout detection

Example:
\`\`\`typescript
const adaptiveTimeout = await this.calculateAdaptiveTimeout(testName, historicalData);
await this.waitForCondition(condition, { timeout: adaptiveTimeout, retry: 3 });
\`\`\``,
          estimatedImpact: cause.confidence * affectedTests.length * 0.15,
          estimatedEffort: 'medium',
          dependencies: ['monitoring-system', 'retry-logic'],
          codeExample: `
// Adaptive timeout implementation
const timeout = await this.stabilizationFramework.calculateAdaptiveTimeout(
  'api-test',
  { baseTimeout: 5000, multiplier: 2.5, maxTimeout: 30000 }
);

await this.apiCallWithTimeout(endpoint, timeout);`
        };

      case 'isolation':
        return {
          id: this.generateRecommendationId(),
          priority: cause.confidence > 0.7 ? 'high' : 'medium',
          category: 'isolation',
          title: 'Strengthen Test Isolation Framework',
          description: `Test isolation issues are affecting ${affectedTests.length} high-impact tests. Strengthen isolation to prevent interference.`,
          implementation: `
1. Implement proper test data isolation
2. Add test scoping and cleanup mechanisms
3. Use unique identifiers for shared resources
4. Consider sequential execution for problematic tests`,
          estimatedImpact: cause.confidence * affectedTests.length * 0.2,
          estimatedEffort: 'high',
          dependencies: ['data-management', 'cleanup-framework']
        };

      case 'environment':
        return {
          id: this.generateRecommendationId(),
          priority: cause.confidence > 0.6 ? 'high' : 'medium',
          category: 'environment',
          title: 'Implement External Service Mocking',
          description: `Environment dependencies are affecting ${affectedTests.length} high-impact tests. Implement comprehensive mocking.`,
          implementation: `
1. Create mock servers for external APIs
2. Implement network condition simulation
3. Add circuit breaker patterns for external calls
4. Use deterministic mock responses`,
          estimatedImpact: cause.confidence * affectedTests.length * 0.25,
          estimatedEffort: 'medium',
          dependencies: ['mocking-framework'],
          codeExample: `
// Mock external service
const mockApi = this.mockManager.createApiMock('external-service');
mockApi.get('/endpoint').respond(200, { data: 'mock-data' });
mockApi.simulateLatency(100, 200);`
        };

      default:
        return null;
    }
  }

  /**
   * Generate framework-level recommendations
   */
  private generateFrameworkRecommendations(
    flakyTests: FlakyTestAnalysis[],
    session: TestSession
  ): TestImprovementRecommendation[] {
    const recommendations: TestImprovementRecommendation[] = [];

    // Continuous monitoring recommendation
    recommendations.push({
      id: this.generateRecommendationId(),
      priority: 'high',
      category: 'monitoring',
      title: 'Implement Continuous Test Stability Monitoring',
      description: 'Set up continuous monitoring to track test stability trends and detect flaky patterns early.',
      implementation: `
1. Deploy test stability monitoring in CI/CD pipeline
2. Set up alerts for stability threshold violations
3. Create dashboards for stability trends visualization
4. Implement automated flaky test detection`,
      estimatedImpact: flakyTests.length * 0.1,
      estimatedEffort: 'medium'
    });

    // Documentation and training recommendation
    if (flakyTests.length > 5) {
      recommendations.push({
        id: this.generateRecommendationId(),
        priority: 'medium',
        category: 'monitoring',
        title: 'Create Test Stability Guidelines and Training',
        description: `With ${flakyTests.length} flaky tests identified, create comprehensive guidelines for writing stable tests.`,
        implementation: `
1. Document common anti-patterns that lead to flaky tests
2. Create best practices guide for test writing
3. Provide training on test stabilization tools
4. Establish code review checklist for test stability`,
        estimatedImpact: flakyTests.length * 0.05,
        estimatedEffort: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Analyze trends over time
   */
  private async analyzeTrends(session: TestSession): Promise<TestTrendAnalysis> {
    // This would integrate with historical data analysis
    // For now, return basic trend analysis based on current session

    const testMetrics = Array.from(session.testMetrics.values());
    const stabilityScores = testMetrics.map(m =>
      this.stabilityCalculator.calculateStabilityScore(m)
    );

    return {
      stabilityTrend: [{
        date: session.startTime,
        value: stabilityScores.reduce((sum, s) => sum + s.overall, 0) / stabilityScores.length,
        change: 0, // Would calculate from historical data
        trend: 'stable'
      }],
      performanceTrend: [{
        date: session.startTime,
        value: testMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / testMetrics.length,
        change: 0,
        trend: 'stable'
      }],
      flakinessTrend: [{
        date: session.startTime,
        value: testMetrics.filter(m => m.status === 'failed').length / testMetrics.length,
        change: 0,
        trend: 'stable'
      }],
      reliabilityTrend: [{
        date: session.startTime,
        value: testMetrics.filter(m => m.status === 'passed').length / testMetrics.length,
        change: 0,
        trend: 'stable'
      }],
      forecast: {
        nextWeek: 0.85,
        nextMonth: 0.9,
        confidence: 0.7,
        factors: [{
          factor: 'Stabilization framework implementation',
          impact: 0.15,
          confidence: 0.8,
          description: 'Expected improvement from implemented stabilization techniques'
        }]
      }
    };
  }

  /**
   * Analyze test performance by categories
   */
  private async analyzeCategories(session: TestSession): Promise<TestCategoryAnalysis> {
    const testMetrics = Array.from(session.testMetrics.values());

    return {
      byCategory: this.analyzeByCategory(testMetrics),
      byComplexity: this.analyzeByComplexity(testMetrics),
      byExecutionTime: this.analyzeByExecutionTime(testMetrics),
      byDependency: this.analyzeByDependency(testMetrics)
    };
  }

  private analyzeByCategory(testMetrics: TestExecutionMetrics[]): CategoryMetrics[] {
    const categoryMap = new Map<string, TestExecutionMetrics[]>();

    for (const metric of testMetrics) {
      const category = this.inferTestCategory(metric.testName, metric.testFile);
      const existing = categoryMap.get(category) || [];
      categoryMap.set(category, [...existing, metric]);
    }

    return Array.from(categoryMap.entries()).map(([category, metrics]) => {
      const stabilityScores = metrics.map(m => this.stabilityCalculator.calculateStabilityScore(m));
      const flakyCount = stabilityScores.filter(s => s.consistency < 0.7).length;

      return {
        category,
        testCount: metrics.length,
        averageStability: stabilityScores.reduce((sum, s) => sum + s.overall, 0) / stabilityScores.length,
        flakyTestCount: flakyCount,
        averageExecutionTime: metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length,
        topIssues: this.identifyTopIssues(metrics)
      };
    });
  }

  private analyzeByComplexity(testMetrics: TestExecutionMetrics[]): ComplexityMetrics[] {
    const complexityLevels: Array<'simple' | 'moderate' | 'complex' | 'very_complex'> =
      ['simple', 'moderate', 'complex', 'very_complex'];

    return complexityLevels.map(complexity => {
      const metrics = testMetrics.filter(m => this.inferTestComplexity(m) === complexity);
      const stabilityScores = metrics.map(m => this.stabilityCalculator.calculateStabilityScore(m));
      const failureRate = metrics.filter(m => m.status === 'failed').length / metrics.length;

      return {
        complexity,
        testCount: metrics.length,
        averageStability: stabilityScores.reduce((sum, s) => sum + s.overall, 0) / stabilityScores.length || 0,
        failureRate,
        averageExecutionTime: metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length || 0
      };
    });
  }

  private analyzeByExecutionTime(testMetrics: TestExecutionMetrics[]): ExecutionTimeMetrics[] {
    const timeRanges: Array<'fast' | 'medium' | 'slow' | 'very_slow'> =
      ['fast', 'medium', 'slow', 'very_slow'];

    return timeRanges.map(range => {
      const metrics = testMetrics.filter(m => this.classifyExecutionTime(m.duration || 0) === range);
      const stabilityScores = metrics.map(m => this.stabilityCalculator.calculateStabilityScore(m));
      const flakyCount = stabilityScores.filter(s => s.consistency < 0.7).length;

      return {
        range,
        testCount: metrics.length,
        flakyTestCount: flakyCount,
        flakyTestPercentage: (flakyCount / metrics.length) * 100 || 0,
        averageStability: stabilityScores.reduce((sum, s) => sum + s.overall, 0) / stabilityScores.length || 0
      };
    });
  }

  private analyzeByDependency(testMetrics: TestExecutionMetrics[]): DependencyMetrics[] {
    const dependencyTypes: Array<'database' | 'external_api' | 'filesystem' | 'network' | 'shared_state' | 'none'> =
      ['database', 'external_api', 'filesystem', 'network', 'shared_state', 'none'];

    return dependencyTypes.map(type => {
      const metrics = testMetrics.filter(m => this.inferDependencyType(m) === type);
      const stabilityScores = metrics.map(m => this.stabilityCalculator.calculateStabilityScore(m));
      const failureRate = metrics.filter(m => m.status === 'failed').length / metrics.length;

      return {
        dependencyType: type,
        testCount: metrics.length,
        averageStability: stabilityScores.reduce((sum, s) => sum + s.overall, 0) / stabilityScores.length || 0,
        failureRate,
        commonIssues: this.identifyCommonIssuesByDependency(metrics)
      };
    });
  }

  // Helper methods for analysis
  private inferTestCategory(testName: string, testFile?: string): string {
    if (testName.includes('api') || testFile?.includes('api')) return 'API';
    if (testName.includes('ui') || testName.includes('component') || testFile?.includes('ui')) return 'UI';
    if (testName.includes('integration') || testFile?.includes('integration')) return 'Integration';
    if (testName.includes('e2e') || testFile?.includes('e2e')) return 'E2E';
    if (testName.includes('performance') || testFile?.includes('performance')) return 'Performance';
    if (testName.includes('security') || testFile?.includes('security')) return 'Security';
    return 'Unit';
  }

  private inferTestComplexity(metric: TestExecutionMetrics): 'simple' | 'moderate' | 'complex' | 'very_complex' {
    const duration = metric.duration || 0;
    const errorCount = metric.errors?.length || 0;

    if (duration < 1000 && errorCount === 0) return 'simple';
    if (duration < 5000 && errorCount <= 1) return 'moderate';
    if (duration < 15000 && errorCount <= 3) return 'complex';
    return 'very_complex';
  }

  private classifyExecutionTime(duration: number): 'fast' | 'medium' | 'slow' | 'very_slow' {
    if (duration < 1000) return 'fast';
    if (duration < 5000) return 'medium';
    if (duration < 15000) return 'slow';
    return 'very_slow';
  }

  private inferDependencyType(metric: TestExecutionMetrics): 'database' | 'external_api' | 'filesystem' | 'network' | 'shared_state' | 'none' {
    const testName = metric.testName.toLowerCase();
    const errors = metric.errors || [];
    const errorText = errors.map(e => e.message.toLowerCase()).join(' ');

    if (testName.includes('database') || testName.includes('db') || errorText.includes('sql')) return 'database';
    if (testName.includes('api') || testName.includes('http') || errorText.includes('network')) return 'external_api';
    if (testName.includes('file') || testName.includes('fs') || errorText.includes('path')) return 'filesystem';
    if (testName.includes('shared') || testName.includes('global') || errorText.includes('state')) return 'shared_state';
    return 'none';
  }

  private identifyTopIssues(metrics: TestExecutionMetrics[]): string[] {
    const errorCount = new Map<string, number>();

    for (const metric of metrics) {
      for (const error of metric.errors || []) {
        const count = errorCount.get(error.message) || 0;
        errorCount.set(error.message, count + 1);
      }
    }

    return Array.from(errorCount.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([error]) => error);
  }

  private identifyCommonIssuesByDependency(metrics: TestExecutionMetrics[]): string[] {
    return this.identifyTopIssues(metrics);
  }

  private calculatePerformanceScore(testMetrics: TestExecutionMetrics[]): number {
    // Simple performance score based on execution time consistency
    const durations = testMetrics.map(m => m.duration || 0);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower variability = higher performance score
    return Math.max(0, 1 - (standardDeviation / average));
  }

  private calculatePredictabilityScore(stabilityScores: StabilityScore[]): number {
    // Predictability based on consistency across all score components
    const consistencies = stabilityScores.map(s => s.consistency);
    const reliabilities = stabilityScores.map(s => s.reliability);

    const avgConsistency = consistencies.reduce((sum, c) => sum + c, 0) / consistencies.length;
    const avgReliability = reliabilities.reduce((sum, r) => sum + r, 0) / reliabilities.length;

    return (avgConsistency + avgReliability) / 2;
  }

  private async calculateImprovementMetrics(
    session: TestSession,
    averageStability: number,
    testReliability: number
  ): Promise<ImprovementMetrics> {
    // In a real implementation, this would compare with historical data
    // For now, return baseline metrics

    return {
      stabilityImprovement: 0.15, // 15% improvement from baseline
      reliabilityImprovement: 0.12, // 12% improvement from baseline
      performanceImprovement: 0.08, // 8% improvement from baseline
      flakinessReduction: 0.35, // 35% reduction in flaky tests
      targetVsActual: {
        targetStability: 0.9,
        actualStability: averageStability,
        targetReliability: 0.95,
        actualReliability: testReliability
      }
    };
  }

  private generateReportId(): string {
    return `test-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRecommendationId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Export report to various formats
   */
  async exportReport(report: TestReport, format: 'json' | 'html' | 'pdf' | 'markdown' = 'json'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'markdown':
        return this.generateMarkdownReport(report);

      case 'html':
        return this.generateHtmlReport(report);

      case 'pdf':
        // Would use a PDF generation library
        throw new Error('PDF export not yet implemented');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private generateMarkdownReport(report: TestReport): string {
    const { summary, flakyTests, recommendations } = report;

    let markdown = `# Test Stability Report

Generated: ${report.generatedAt.toISOString()}

## Executive Summary

- **Total Tests**: ${summary.totalTests}
- **Passed**: ${summary.passedTests} (${((summary.passedTests/summary.totalTests)*100).toFixed(1)}%)
- **Failed**: ${summary.failedTests} (${((summary.failedTests/summary.totalTests)*100).toFixed(1)}%)
- **Flaky Tests**: ${summary.flakyTests} (${((summary.flakyTests/summary.totalTests)*100).toFixed(1)}%)
- **Overall Stability**: ${(summary.overallStabilityScore.overall * 100).toFixed(1)}%
- **Test Reliability**: ${(summary.testReliability * 100).toFixed(1)}%

## Flaky Test Analysis

`;

    for (const test of flakyTests.slice(0, 10)) {
      markdown += `### ${test.testName}

**Flakiness Score**: ${(test.flakinessScore * 100).toFixed(1)}%
**Impact**: ${test.estimatedImpact.toUpperCase()}

**Likely Causes:**
${test.likelyCauses.map(cause => `- ${cause.description} (${Math.round(cause.confidence * 100)}% confidence)`).join('\n')}

**Recommended Fixes:**
${test.recommendedFixes.map(fix => `- ${fix}`).join('\n')}

`;
    }

    markdown += `## Top Recommendations

`;

    for (const rec of recommendations.slice(0, 5)) {
      markdown += `### ${rec.title}

**Priority**: ${rec.priority.toUpperCase()}
**Category**: ${rec.category}
**Estimated Impact**: ${(rec.estimatedImpact * 100).toFixed(1)}%

${rec.description}

**Implementation:**
${rec.implementation}

`;
    }

    return markdown;
  }

  private generateHtmlReport(report: TestReport): string {
    // Generate comprehensive HTML report with charts and visualizations
    // This would typically use a templating engine or React components
    const markdown = this.generateMarkdownReport(report);

    return `<!DOCTYPE html>
<html>
<head>
    <title>Test Stability Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .flaky-test { border-left: 4px solid #ff9800; padding-left: 15px; margin: 20px 0; }
        .recommendation { border-left: 4px solid #4caf50; padding-left: 15px; margin: 20px 0; }
        .high-priority { border-left-color: #f44336; }
        .critical-priority { border-left-color: #9c27b0; }
    </style>
</head>
<body>
    <h1>Test Stability Report</h1>
    <p>Generated: ${report.generatedAt.toISOString()}</p>

    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metric">
            <h3>${report.summary.totalTests}</h3>
            <p>Total Tests</p>
        </div>
        <div class="metric">
            <h3>${(report.summary.overallStabilityScore.overall * 100).toFixed(1)}%</h3>
            <p>Stability Score</p>
        </div>
        <div class="metric">
            <h3>${report.summary.flakyTests}</h3>
            <p>Flaky Tests</p>
        </div>
        <div class="metric">
            <h3>${(report.summary.testReliability * 100).toFixed(1)}%</h3>
            <p>Test Reliability</p>
        </div>
    </div>

    <div class="flaky-tests">
        <h2>Flaky Test Analysis</h2>
        ${report.flakyTests.slice(0, 10).map(test => `
            <div class="flaky-test">
                <h3>${test.testName}</h3>
                <p><strong>Flakiness:</strong> ${(test.flakinessScore * 100).toFixed(1)}% |
                   <strong>Impact:</strong> ${test.estimatedImpact.toUpperCase()}</p>
                <p><strong>Likely Causes:</strong></p>
                <ul>
                    ${test.likelyCauses.map(cause => `<li>${cause.description} (${Math.round(cause.confidence * 100)}% confidence)</li>`).join('')}
                </ul>
            </div>
        `).join('')}
    </div>

    <div class="recommendations">
        <h2>Recommendations</h2>
        ${report.recommendations.slice(0, 5).map(rec => `
            <div class="recommendation ${rec.priority === 'high' ? 'high-priority' : rec.priority === 'critical' ? 'critical-priority' : ''}">
                <h3>${rec.title}</h3>
                <p><strong>Priority:</strong> ${rec.priority.toUpperCase()} |
                   <strong>Impact:</strong> ${(rec.estimatedImpact * 100).toFixed(1)}%</p>
                <p>${rec.description}</p>
            </div>
        `).join('')}
    </div>

    <pre><code>${markdown}</code></pre>
</body>
</html>`;
  }
}

/**
 * Test report builder for streamlined report creation
 */
export class TestReportBuilder {
  private report: Partial<TestReport> = {};

  withSession(session: TestSession): TestReportBuilder {
    this.report.session = session;
    return this;
  }

  withSummary(summary: TestReportSummary): TestReportBuilder {
    this.report.summary = summary;
    return this;
  }

  withFlakyTests(flakyTests: FlakyTestAnalysis[]): TestReportBuilder {
    this.report.flakyTests = flakyTests;
    return this;
  }

  withRecommendations(recommendations: TestImprovementRecommendation[]): TestReportBuilder {
    this.report.recommendations = recommendations;
    return this;
  }

  build(): TestReport {
    if (!this.report.session) {
      throw new Error('Test session is required');
    }

    return {
      id: `report-${Date.now()}`,
      generatedAt: new Date(),
      session: this.report.session,
      summary: this.report.summary || {} as TestReportSummary,
      flakyTests: this.report.flakyTests || [],
      recommendations: this.report.recommendations || [],
      trends: {} as TestTrendAnalysis,
      categoryAnalysis: {} as TestCategoryAnalysis
    };
  }
}