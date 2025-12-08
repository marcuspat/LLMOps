/**
 * Truth Verification Performance Optimizer
 * Optimizes verification rules execution with caching and parallel processing
 */

import {
  TruthVerificationRequest,
  TruthVerificationResult,
  VerificationIssue,
  IssueSeverity
} from '../types/index.js';

interface VerificationCache {
  contentHash: string;
  result: TruthVerificationResult;
  timestamp: number;
  ttl: number;
}

interface CompiledRule {
  name: string;
  patterns: RegExp[];
  execute: (content: string, context?: any) => Promise<RuleResult>;
}

interface RuleResult {
  score: number;
  issues: VerificationIssue[];
  suggestions: string[];
  metrics: Record<string, number>;
}

export class TruthVerificationOptimizer {
  private verificationCache: Map<string, VerificationCache> = new Map();
  private compiledRules: Map<string, CompiledRule> = new Map();
  private ruleExecutionCache: Map<string, RuleResult> = new Map();

  // Cache TTL: 5 minutes for verification results
  private readonly CACHE_TTL = 300000;
  private readonly MAX_CACHE_SIZE = 1000;

  constructor() {
    this.precompileRules();
    this.setupCacheCleanup();
  }

  /**
   * Optimized verification with caching and parallel execution
   */
  public async verifyOptimized(request: TruthVerificationRequest): Promise<TruthVerificationResult> {
    const startTime = performance.now();

    // Generate content hash for caching
    const contentHash = this.generateContentHash(request.content, request.type, request.context);

    // Check cache first
    const cached = this.verificationCache.get(contentHash);
    if (cached && cached.timestamp > Date.now()) {
      console.log(`Cache hit for verification type: ${request.type}`);
      return cached.result;
    }

    // Execute verification with optimizations
    const result = await this.executeVerificationOptimized(request);

    // Cache the result
    this.verificationCache.set(contentHash, {
      contentHash,
      result,
      timestamp: Date.now() + this.CACHE_TTL,
      ttl: this.CACHE_TTL
    });

    // Limit cache size
    if (this.verificationCache.size > this.MAX_CACHE_SIZE) {
      this.cleanupOldestCacheEntries();
    }

    const executionTime = performance.now() - startTime;
    console.log(`Verification completed in ${executionTime.toFixed(2)}ms for type: ${request.type}`);

    return result;
  }

  /**
   * Batch verification with parallel execution
   */
  public async verifyBatchOptimized(requests: TruthVerificationRequest[]): Promise<TruthVerificationResult[]> {
    // Group similar requests for batch processing
    const groupedRequests = this.groupSimilarRequests(requests);

    // Process groups in parallel
    const groupPromises = Array.from(groupedRequests.entries()).map(
      async ([groupKey, groupRequests]) => {
        if (groupRequests.length === 1) {
          return this.verifyOptimized(groupRequests[0]);
        }

        // Process batch with optimizations
        return this.processBatchGroup(groupRequests);
      }
    );

    const batchResults = await Promise.all(groupPromises);

    // Flatten results back to original order
    const results: TruthVerificationResult[] = [];
    let resultIndex = 0;

    for (const group of groupedRequests.values()) {
      for (let i = 0; i < group.length; i++) {
        results.push(batchResults[resultIndex]);
        resultIndex++;
      }
    }

    return results;
  }

  /**
   * Process a batch of similar verification requests
   */
  private async processBatchGroup(requests: TruthVerificationRequest[]): Promise<TruthVerificationResult[]> {
    const results: TruthVerificationResult[] = [];

    // Pre-compile all rules for this verification type
    const verificationType = requests[0].type;
    const rules = this.compiledRules.get(verificationType.toString());

    if (!rules) {
      throw new Error(`No compiled rules found for verification type: ${verificationType}`);
    }

    // Process requests in parallel, but limit concurrency
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => this.executeCompiledRules(request, rules));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute compiled verification rules
   */
  private async executeCompiledRules(request: TruthVerificationRequest, rules: CompiledRule): Promise<TruthVerificationResult> {
    const threshold = request.threshold ?? 0.95;
    const allIssues: VerificationIssue[] = [];
    const allSuggestions: string[] = [];
    const allMetrics: Record<string, number> = {};
    let totalScore = 0;
    let ruleCount = 0;

    // Execute rules with caching
    for (const rule of [rules]) { // Single rule for this example
      const ruleKey = `${rule.name}_${request.type}`;

      // Check rule execution cache
      let ruleResult: RuleResult | undefined = this.ruleExecutionCache.get(ruleKey);

      if (!ruleResult) {
        ruleResult = await rule.execute(request.content, request.context);
        this.ruleExecutionCache.set(ruleKey, ruleResult);
      }

      allIssues.push(...ruleResult.issues);
      allSuggestions.push(...ruleResult.suggestions);
      Object.assign(allMetrics, ruleResult.metrics);

      totalScore += ruleResult.score;
      ruleCount++;
    }

    const finalScore = ruleCount > 0 ? totalScore / ruleCount : 0;
    const passed = finalScore >= threshold;

    return {
      score: finalScore,
      passed,
      confidence: this.calculateConfidence(allIssues, ruleCount),
      details: {
        issues: allIssues,
        suggestions: allSuggestions,
        metrics: allMetrics
      },
      timestamp: new Date()
    };
  }

  /**
   * Execute verification with optimized rule processing
   */
  private async executeVerificationOptimized(request: TruthVerificationRequest): Promise<TruthVerificationResult> {
    const threshold = request.threshold ?? 0.95;

    // Use compiled rules for faster execution
    const rules = this.compiledRules.get(request.type.toString());
    if (!rules) {
      throw new Error(`No compiled rules found for verification type: ${request.type}`);
    }

    return this.executeCompiledRules(request, rules);
  }

  /**
   * Pre-compile verification rules with optimized patterns
   */
  private precompileRules(): void {
    // Code Quality Rules
    this.compiledRules.set('CODE_QUALITY', {
      name: 'code_quality',
      patterns: [
        /function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g,
        /if|else|for|while|switch|catch/g,
        /:\s*any/g,
        /JSON\.parse\(JSON\.stringify/g,
        /addEventListener/g,
        /removeEventListener/g,
        /\b\d{2,}\b/g
      ],
      execute: this.executeCodeQualityRules.bind(this)
    });

    // Security Rules
    this.compiledRules.set('SECURITY', {
      name: 'security',
      patterns: [
        /eval\(/g,
        /innerHTML\s*=/g,
        /document\.write/g,
        /setTimeout\s*\(\s*["']/g
      ],
      execute: this.executeSecurityRules.bind(this)
    });

    // Performance Rules
    this.compiledRules.set('PERFORMANCE', {
      name: 'performance',
      patterns: [
        /\.length\s*\.\s*forEach\(/g,
        /for\s*\([^)]*\+\+[^)]*\)/g
      ],
      execute: this.executePerformanceRules.bind(this)
    });

    // Test Coverage Rules
    this.compiledRules.set('TEST_COVERAGE', {
      name: 'test_coverage',
      patterns: [
        /test\(|it\(/g,
        /expect\(/g
      ],
      execute: this.executeTestCoverageRules.bind(this)
    });
  }

  /**
   * Optimized code quality rule execution
   */
  private async executeCodeQualityRules(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check function length (optimized regex)
    const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g) || [];
    const longFunctions = functionMatches.filter(fn => fn.length > 500);

    if (longFunctions.length > 0) {
      issues.push({
        type: 'long_function',
        severity: IssueSeverity.MEDIUM,
        message: `Found ${longFunctions.length} functions that are too long (>500 characters)`
      });
      suggestions.push('Consider breaking down long functions into smaller, more focused functions');
      score -= 0.1;
    }

    // Check cyclomatic complexity (simplified)
    const complexityKeywords = content.match(/if|else|for|while|switch|catch/g) || [];
    const complexity = complexityKeywords.length;

    metrics.cyclomaticComplexity = complexity;
    if (complexity > 10) {
      issues.push({
        type: 'high_complexity',
        severity: IssueSeverity.HIGH,
        message: `Code complexity is ${complexity}, consider refactoring`
      });
      suggestions.push('Extract complex logic into separate methods or functions');
      score -= 0.15;
    }

    // Check for 'any' types (optimized regex)
    const anyTypes = content.match(/:\s*any/g) || [];
    metrics.anyTypeUsage = anyTypes.length;

    if (anyTypes.length > 0) {
      issues.push({
        type: 'any_type_usage',
        severity: IssueSeverity.MEDIUM,
        message: `Found ${anyTypes.length} 'any' type usage`
      });
      suggestions.push("Replace 'any' types with specific type definitions");
      score -= 0.1 * Math.min(anyTypes.length, 3);
    }

    // Check for JSON stringify/parse anti-pattern
    if (/JSON\.parse\(JSON\.stringify/.test(content)) {
      issues.push({
        type: 'performance_anti_pattern',
        severity: IssueSeverity.HIGH,
        message: 'Deep copy using JSON stringify/parse is inefficient'
      });
      suggestions.push('Use structuredClone or dedicated deep copy libraries');
      score -= 0.1;
    }

    return { score, issues, suggestions, metrics };
  }

  /**
   * Optimized security rule execution
   */
  private async executeSecurityRules(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Security pattern checks (compiled regex)
    const securityPatterns = [
      { pattern: /eval\(/, severity: IssueSeverity.CRITICAL, message: 'Use of eval() function is dangerous' },
      { pattern: /innerHTML\s*=/, severity: IssueSeverity.HIGH, message: 'Direct innerHTML assignment can lead to XSS' },
      { pattern: /document\.write/, severity: IssueSeverity.HIGH, message: 'document.write can lead to XSS attacks' }
    ];

    securityPatterns.forEach(({ pattern, severity, message }) => {
      if (pattern.test(content)) {
        issues.push({
          type: 'security_vulnerability',
          severity,
          message
        });
        score -= severity === IssueSeverity.CRITICAL ? 0.3 : 0.1;
      }
    });

    metrics.securityIssuesFound = issues.length;

    return { score, issues, suggestions, metrics };
  }

  /**
   * Optimized performance rule execution
   */
  private async executePerformanceRules(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Performance anti-pattern checks
    if (/\.length\s*\.\s*forEach\(/.test(content)) {
      issues.push({
        type: 'performance_anti_pattern',
        severity: IssueSeverity.MEDIUM,
        message: 'Avoid chaining length and forEach'
      });
      suggestions.push('Use for...of or Array methods directly');
      score -= 0.05;
    }

    // Check for potential memory leaks (optimized regex)
    const eventListenerAdd = content.match(/addEventListener/g) || [];
    const eventListenerRemove = content.match(/removeEventListener/g) || [];

    if (eventListenerAdd.length > eventListenerRemove.length) {
      issues.push({
        type: 'potential_memory_leak',
        severity: IssueSeverity.MEDIUM,
        message: 'More addEventListener than removeEventListener calls'
      });
      suggestions.push('Ensure all event listeners are properly removed');
      score -= 0.1;
    }

    metrics.eventListenerBalance = eventListenerRemove.length / Math.max(eventListenerAdd.length, 1);

    return { score, issues, suggestions, metrics };
  }

  /**
   * Optimized test coverage rule execution
   */
  private async executeTestCoverageRules(content: string): Promise<RuleResult> {
    const issues: VerificationIssue[] = [];
    const suggestions: string[] = [];
    const metrics: Record<string, number> = {};
    let score = 1.0;

    // Check test structure (optimized regex)
    const testBlocks = content.match(/test\(|it\(/g) || [];
    const expectBlocks = content.match(/expect\(/g) || [];

    metrics.testCount = testBlocks.length;
    metrics.assertionCount = expectBlocks.length;

    if (testBlocks.length === 0) {
      issues.push({
        type: 'no_tests',
        severity: IssueSeverity.CRITICAL,
        message: 'No tests found'
      });
      score = 0;
    } else if (expectBlocks.length < testBlocks.length) {
      issues.push({
        type: 'missing_assertions',
        severity: IssueSeverity.HIGH,
        message: 'Some tests are missing assertions'
      });
      suggestions.push('Add assertions to all tests');
      score -= 0.2;
    }

    return { score, issues, suggestions, metrics };
  }

  /**
   * Generate content hash for caching
   */
  private generateContentHash(content: string, type: any, context?: any): string {
    const hashInput = `${type}_${content}_${JSON.stringify(context || {})}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Group similar requests for batch processing
   */
  private groupSimilarRequests(requests: TruthVerificationRequest[]): Map<string, TruthVerificationRequest[]> {
    const groups = new Map<string, TruthVerificationRequest[]>();

    requests.forEach(request => {
      const groupKey = `${request.type}_${request.threshold ?? 0.95}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(request);
    });

    return groups;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(issues: VerificationIssue[], ruleCount: number): number {
    if (ruleCount === 0) return 0;

    const criticalIssues = issues.filter(i => i.severity === IssueSeverity.CRITICAL).length;
    const highIssues = issues.filter(i => i.severity === IssueSeverity.HIGH).length;

    const issuePenalty = (criticalIssues * 0.2) + (highIssues * 0.1);
    return Math.max(0, 1 - issuePenalty);
  }

  /**
   * Setup cache cleanup
   */
  private setupCacheCleanup(): void {
    // Clean cache every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, cache] of this.verificationCache.entries()) {
        if (cache.timestamp < now) {
          this.verificationCache.delete(key);
        }
      }
    }, 300000);
  }

  /**
   * Clean oldest cache entries
   */
  private cleanupOldestCacheEntries(): void {
    const entries = Array.from(this.verificationCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const entriesToDelete = entries.slice(0, entries.length - this.MAX_CACHE_SIZE + 100);
    entriesToDelete.forEach(([key]) => {
      this.verificationCache.delete(key);
    });
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): any {
    return {
      verificationCacheSize: this.verificationCache.size,
      compiledRulesSize: this.compiledRules.size,
      ruleExecutionCacheSize: this.ruleExecutionCache.size
    };
  }
}