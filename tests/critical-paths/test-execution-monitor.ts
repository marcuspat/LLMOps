/**
 * Automated Test Execution and Monitoring System
 * Comprehensive CI/CD integration for critical path testing
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

interface TestExecutionConfig {
  projectName: string;
  testDirectory: string;
  outputDirectory: string;
  thresholds: {
    coverage: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
    performance: {
      maxExecutionTime: number;
      maxMemoryUsage: number;
      maxFlakyRate: number;
    };
    quality: {
      maxCriticalIssues: number;
      maxHighIssues: number;
      minTruthScore: number;
    };
  };
  notifications: {
    slack?: {
      webhook: string;
      channel: string;
    };
    email?: {
      smtp: string;
      recipients: string[];
    };
  };
}

interface TestResult {
  suite: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  performance: {
    memoryUsage: number;
    executionTime: number;
    cpuUsage: number;
  };
  errors: string[];
  warnings: string[];
  timestamp: Date;
}

interface TestMetrics {
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  skippedSuites: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  performance: {
    averageExecutionTime: number;
    maxExecutionTime: number;
    totalMemoryUsage: number;
    flakyRate: number;
  };
  security: {
    criticalIssues: number;
    highIssues: number;
    totalIssues: number;
  };
  trendData: {
    date: string;
    coverage: number;
    performance: number;
    issues: number;
  }[];
}

export class TestExecutionMonitor extends EventEmitter {
  private config: TestExecutionConfig;
  private metrics: TestMetrics;
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private testHistory: TestResult[] = [];
  private criticalPathSuites = [
    'truth-verification',
    'auth-authorization',
    'database-connection',
    'websocket-communication',
    'ml-pipeline',
    'security-scanning',
    'rate-limiting',
    'error-handling',
    'session-management',
    'file-operations',
    'background-jobs',
    'system-configuration'
  ];

  constructor(config: TestExecutionConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
  }

  /**
   * Execute complete test suite for critical paths
   */
  async executeCriticalPathTests(): Promise<TestMetrics> {
    console.log('🚀 Starting Critical Path Test Execution');
    console.log(`📊 Test Directory: ${this.config.testDirectory}`);
    console.log(`📁 Output Directory: ${this.config.outputDirectory}`);

    const startTime = Date.now();

    try {
      // Ensure output directory exists
      await this.ensureDirectoryExists(this.config.outputDirectory);

      // Execute tests in priority order
      const results = await this.executeTestsByPriority();

      // Calculate final metrics
      this.metrics = this.calculateMetrics(results);

      // Check against thresholds
      const qualityGate = await this.checkQualityGate(this.metrics);

      // Generate reports
      await this.generateReports(results, this.metrics);

      // Send notifications
      await this.sendNotifications(this.metrics, qualityGate);

      const duration = Date.now() - startTime;
      console.log(`✅ Test execution completed in ${duration}ms`);

      this.emit('execution-complete', this.metrics);

      return this.metrics;

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      this.emit('execution-error', error);
      throw error;
    }
  }

  /**
   * Execute tests by priority (Critical > High > Medium > Low)
   */
  private async executeTestsByPriority(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Priority 1: Critical paths (must pass)
    console.log('🔴 Executing Priority 1: Critical Path Tests');
    for (const suite of this.criticalPathSuites) {
      const result = await this.executeTestSuite(suite, 'critical');
      results.push(result);

      if (result.status === 'failed') {
        console.error(`❌ Critical test suite failed: ${suite}`);
        // Continue execution but mark as failed
      }
    }

    // Priority 2: Integration tests
    console.log('🟡 Executing Priority 2: Integration Tests');
    const integrationResult = await this.executeTestSuite('integration', 'high');
    results.push(integrationResult);

    // Priority 3: Performance tests
    console.log('🟢 Executing Priority 3: Performance Tests');
    const performanceResult = await this.executeTestSuite('performance', 'medium');
    results.push(performanceResult);

    // Priority 4: E2E tests
    console.log('🔵 Executing Priority 4: E2E Tests');
    const e2eResult = await this.executeTestSuite('e2e', 'low');
    results.push(e2eResult);

    return results;
  }

  /**
   * Execute individual test suite
   */
  private async executeTestSuite(suiteName: string, priority: string): Promise<TestResult> {
    const startTime = Date.now();
    const testPath = path.join(this.config.testDirectory, `${suiteName}.test.ts`);
    const outputPath = path.join(this.config.outputDirectory, `${suiteName}-results.json`);

    console.log(`🧪 Executing test suite: ${suiteName}`);

    const result: TestResult = {
      suite: suiteName,
      status: 'passed',
      duration: 0,
      vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0 },
      performance: { memoryUsage: 0, executionTime: 0, cpuUsage: 0 },
      errors: [],
      warnings: [],
      timestamp: new Date()
    };

    try {
      // Check if test file exists
      try {
        await fs.access(testPath);
      } catch {
        result.status = 'skipped';
        result.warnings.push(`Test file not found: ${testPath}`);
        return result;
      }

      // Execute test with coverage
      const coverageResult = await this.executeTestWithCoverage(testPath, outputPath);

      result.coverage = coverageResult.coverage;
      result.duration = Date.now() - startTime;
      result.performance = coverageResult.performance;

      if (coverageResult.exitCode !== 0) {
        result.status = 'failed';
        result.errors.push(...coverageResult.errors);
      }

      // Run security scanning on the test file itself
      const securityResult = await this.runSecurityScan(testPath);
      result.vulnerabilities = securityResult.vulnerabilities;

      // Validate against thresholds
      await this.validateTestResults(result);

      console.log(`${result.status === 'passed' ? '✅' : '❌'} ${suiteName}: ${result.duration}ms`);

    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Test execution failed: ${error.message}`);
      console.error(`❌ ${suiteName} failed:`, error);
    }

    // Store result for history
    this.testHistory.push(result);
    await this.saveTestResult(result);

    return result;
  }

  /**
   * Execute test with coverage collection
   */
  private async executeTestWithCoverage(
    testPath: string,
    outputPath: string
  ): Promise<{
    exitCode: number;
    coverage: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
    performance: {
      memoryUsage: number;
      executionTime: number;
      cpuUsage: number;
    };
    errors: string[];
  }> {
    return new Promise((resolve) => {
      const startTime = process.hrtime.bigint();
      const initialMemory = process.memoryUsage();

      const testProcess = spawn('npm', [
        'test',
        '--',
        testPath,
        '--coverage',
        '--coverageReporters=json',
        '--coverageDirectory=coverage',
        '--verbose',
        '--forceExit'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });

      let stdout = '';
      let stderr = '';
      const errors: string[] = [];

      testProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr?.on('data', (data) => {
        const errorData = data.toString();
        stderr += errorData;
        errors.push(errorData);
      });

      testProcess.on('close', async (code) => {
        const endTime = process.hrtime.bigint();
        const finalMemory = process.memoryUsage();

        // Calculate performance metrics
        const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const memoryUsage = finalMemory.heapUsed - initialMemory.heapUsed;

        // Read coverage report
        let coverage = {
          statements: 0,
          branches: 0,
          functions: 0,
          lines: 0
        };

        try {
          const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
          const coverageData = await fs.readFile(coveragePath, 'utf-8');
          const coverageReport = JSON.parse(coverageData);

          if (coverageReport.total) {
            coverage = {
              statements: coverageReport.total.lines.pct || 0,
              branches: coverageReport.total.branches.pct || 0,
              functions: coverageReport.total.functions.pct || 0,
              lines: coverageReport.total.lines.pct || 0
            };
          }
        } catch (error) {
          console.warn('Could not read coverage report:', error);
        }

        resolve({
          exitCode: code || 0,
          coverage,
          performance: {
            executionTime,
            memoryUsage,
            cpuUsage: 0 // Would need system monitoring for accurate CPU usage
          },
          errors: errors.filter(e => e.trim().length > 0)
        });
      });

      testProcess.on('error', (error) => {
        console.error('Test process error:', error);
        resolve({
          exitCode: 1,
          coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
          performance: { executionTime: 0, memoryUsage: 0, cpuUsage: 0 },
          errors: [error.message]
        });
      });
    });
  }

  /**
   * Run security scan on test file
   */
  private async runSecurityScan(testPath: string): Promise<{
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  }> {
    const vulnerabilities = { critical: 0, high: 0, medium: 0, low: 0 };

    try {
      const testContent = await fs.readFile(testPath, 'utf-8');

      // Basic security pattern detection
      const securityPatterns = [
        { pattern: /eval\s*\(/g, severity: 'critical' },
        { pattern: /innerHTML\s*=/g, severity: 'high' },
        { pattern: /document\.write/g, severity: 'high' },
        { pattern: /setTimeout\s*\(\s*["']/g, severity: 'medium' },
        { pattern: /process\.env\./g, severity: 'low' }
      ];

      securityPatterns.forEach(({ pattern, severity }) => {
        const matches = testContent.match(pattern);
        if (matches) {
          vulnerabilities[severity as keyof typeof vulnerabilities] += matches.length;
        }
      });

    } catch (error) {
      console.warn('Security scan failed:', error);
    }

    return { vulnerabilities };
  }

  /**
   * Validate test results against thresholds
   */
  private async validateTestResults(result: TestResult): Promise<void> {
    const issues: string[] = [];

    // Check coverage thresholds
    if (result.coverage) {
      if (result.coverage.statements < this.config.thresholds.coverage.statements) {
        issues.push(`Statement coverage ${result.coverage.statements}% below threshold ${this.config.thresholds.coverage.statements}%`);
      }
      if (result.coverage.branches < this.config.thresholds.coverage.branches) {
        issues.push(`Branch coverage ${result.coverage.branches}% below threshold ${this.config.thresholds.coverage.branches}%`);
      }
      if (result.coverage.functions < this.config.thresholds.coverage.functions) {
        issues.push(`Function coverage ${result.coverage.functions}% below threshold ${this.config.thresholds.coverage.functions}%`);
      }
      if (result.coverage.lines < this.config.thresholds.coverage.lines) {
        issues.push(`Line coverage ${result.coverage.lines}% below threshold ${this.config.thresholds.coverage.lines}%`);
      }
    }

    // Check performance thresholds
    if (result.performance.executionTime > this.config.thresholds.performance.maxExecutionTime) {
      issues.push(`Execution time ${result.performance.executionTime}ms exceeds threshold ${this.config.thresholds.performance.maxExecutionTime}ms`);
    }

    if (result.performance.memoryUsage > this.config.thresholds.performance.maxMemoryUsage) {
      issues.push(`Memory usage ${result.performance.memoryUsage} bytes exceeds threshold ${this.config.thresholds.performance.maxMemoryUsage} bytes`);
    }

    // Check security thresholds
    if (result.vulnerabilities.critical > this.config.thresholds.quality.maxCriticalIssues) {
      issues.push(`Critical vulnerabilities ${result.vulnerabilities.critical} exceed threshold ${this.config.thresholds.quality.maxCriticalIssues}`);
    }

    if (result.vulnerabilities.high > this.config.thresholds.quality.maxHighIssues) {
      issues.push(`High vulnerabilities ${result.vulnerabilities.high} exceed threshold ${this.config.thresholds.quality.maxHighIssues}`);
    }

    // Add issues to result
    result.warnings.push(...issues);

    if (issues.length > 0) {
      console.warn(`⚠️ ${result.suite} validation issues:`, issues);
    }
  }

  /**
   * Check quality gate thresholds
   */
  private async checkQualityGate(metrics: TestMetrics): Promise<{
    passed: boolean;
    blockedBy: string[];
    warnings: string[];
  }> {
    const blockedBy: string[] = [];
    const warnings: string[] = [];

    // Check overall coverage
    if (metrics.coverage.statements < this.config.thresholds.coverage.statements) {
      blockedBy.push(`Statement coverage too low: ${metrics.coverage.statements}%`);
    }

    if (metrics.coverage.branches < this.config.thresholds.coverage.branches) {
      blockedBy.push(`Branch coverage too low: ${metrics.coverage.branches}%`);
    }

    // Check failure rate
    const failureRate = (metrics.failedSuites / metrics.totalSuites) * 100;
    if (failureRate > 5) { // More than 5% failure rate
      blockedBy.push(`Failure rate too high: ${failureRate.toFixed(2)}%`);
    }

    // Check security issues
    if (metrics.security.criticalIssues > 0) {
      blockedBy.push(`Critical security issues found: ${metrics.security.criticalIssues}`);
    }

    // Check performance
    if (metrics.performance.maxExecutionTime > this.config.thresholds.performance.maxExecutionTime) {
      blockedBy.push(`Test execution time too slow: ${metrics.performance.maxExecutionTime}ms`);
    }

    // Warnings (non-blocking)
    if (metrics.coverage.lines < 95) {
      warnings.push(`Line coverage could be improved: ${metrics.coverage.lines}%`);
    }

    if (metrics.performance.flakyRate > this.config.thresholds.performance.maxFlakyRate) {
      warnings.push(`Flaky test rate detected: ${metrics.performance.flakyRate.toFixed(2)}%`);
    }

    const passed = blockedBy.length === 0;

    console.log(`🚪 Quality Gate: ${passed ? '✅ PASSED' : '❌ BLOCKED'}`);
    if (blockedBy.length > 0) {
      console.log('🚫 Blocked by:', blockedBy);
    }
    if (warnings.length > 0) {
      console.log('⚠️ Warnings:', warnings);
    }

    return { passed, blockedBy, warnings };
  }

  /**
   * Calculate comprehensive metrics
   */
  private calculateMetrics(results: TestResult[]): TestMetrics {
    const metrics: TestMetrics = {
      totalSuites: results.length,
      passedSuites: results.filter(r => r.status === 'passed').length,
      failedSuites: results.filter(r => r.status === 'failed').length,
      skippedSuites: results.filter(r => r.status === 'skipped').length,
      totalTests: 0, // Would need to parse test output for accurate count
      passedTests: 0,
      failedTests: 0,
      coverage: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0
      },
      performance: {
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        totalMemoryUsage: 0,
        flakyRate: 0
      },
      security: {
        criticalIssues: 0,
        highIssues: 0,
        totalIssues: 0
      },
      trendData: []
    };

    // Calculate averages and totals
    const validResults = results.filter(r => r.coverage);
    if (validResults.length > 0) {
      metrics.coverage.statements = validResults.reduce((sum, r) => sum + r.coverage!.statements, 0) / validResults.length;
      metrics.coverage.branches = validResults.reduce((sum, r) => sum + r.coverage!.branches, 0) / validResults.length;
      metrics.coverage.functions = validResults.reduce((sum, r) => sum + r.coverage!.functions, 0) / validResults.length;
      metrics.coverage.lines = validResults.reduce((sum, r) => sum + r.coverage!.lines, 0) / validResults.length;
    }

    metrics.performance.averageExecutionTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    metrics.performance.maxExecutionTime = Math.max(...results.map(r => r.duration));
    metrics.performance.totalMemoryUsage = results.reduce((sum, r) => sum + r.performance.memoryUsage, 0);

    metrics.security.criticalIssues = results.reduce((sum, r) => sum + r.vulnerabilities.critical, 0);
    metrics.security.highIssues = results.reduce((sum, r) => sum + r.vulnerabilities.high, 0);
    metrics.security.totalIssues = results.reduce((sum, r) =>
      sum + r.vulnerabilities.critical + r.vulnerabilities.high +
      r.vulnerabilities.medium + r.vulnerabilities.low, 0
    );

    // Load historical data for trends
    metrics.trendData = await this.loadTrendData();

    return metrics;
  }

  /**
   * Generate comprehensive reports
   */
  private async generateReports(results: TestResult[], metrics: TestMetrics): Promise<void> {
    console.log('📊 Generating test reports...');

    // JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      config: this.config,
      metrics,
      results,
      summary: {
        totalSuites: metrics.totalSuites,
        passedSuites: metrics.passedSuites,
        failedSuites: metrics.failedSuites,
        overallStatus: metrics.failedSuites === 0 ? 'PASSED' : 'FAILED',
        coverage: metrics.coverage,
        security: metrics.security
      }
    };

    const jsonPath = path.join(this.config.outputDirectory, 'test-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));

    // HTML report
    const htmlReport = await this.generateHTMLReport(jsonReport);
    const htmlPath = path.join(this.config.outputDirectory, 'test-report.html');
    await fs.writeFile(htmlPath, htmlReport);

    // JUnit XML for CI/CD integration
    const junitReport = await this.generateJUnitReport(results);
    const junitPath = path.join(this.config.outputDirectory, 'junit-report.xml');
    await fs.writeFile(junitPath, junitReport);

    // Coverage report
    const coverageReport = await this.generateCoverageReport(metrics);
    const coveragePath = path.join(this.config.outputDirectory, 'coverage-report.md');
    await fs.writeFile(coveragePath, coverageReport);

    console.log(`✅ Reports generated in ${this.config.outputDirectory}`);
  }

  /**
   * Generate HTML report
   */
  private async generateHTMLReport(data: any): Promise<string> {
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>Critical Path Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metrics { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .passed { color: green; }
        .failed { color: red; }
        .warning { color: orange; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .coverage-bar { width: 100%; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden; }
        .coverage-fill { height: 100%; background: linear-gradient(90deg, #ff4444, #ffaa00, #00c851); }
    </style>
</head>
<body>
    <div class="header">
        <h1>Critical Path Test Report</h1>
        <p><strong>Project:</strong> ${this.config.projectName}</p>
        <p><strong>Generated:</strong> ${data.timestamp}</p>
        <p><strong>Status:</strong> <span class="${data.summary.overallStatus.toLowerCase()}">${data.summary.overallStatus}</span></p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Test Results</h3>
            <p>Total Suites: ${data.summary.totalSuites}</p>
            <p class="passed">Passed: ${data.summary.passedSuites}</p>
            <p class="failed">Failed: ${data.summary.failedSuites}</p>
        </div>
        <div class="metric">
            <h3>Code Coverage</h3>
            <p>Statements: ${data.summary.coverage.statements.toFixed(1)}%</p>
            <div class="coverage-bar">
                <div class="coverage-fill" style="width: ${data.summary.coverage.statements}%"></div>
            </div>
            <p>Branches: ${data.summary.coverage.branches.toFixed(1)}%</p>
            <p>Functions: ${data.summary.coverage.functions.toFixed(1)}%</p>
        </div>
        <div class="metric">
            <h3>Security</h3>
            <p class="failed">Critical: ${data.summary.security.criticalIssues}</p>
            <p class="failed">High: ${data.summary.security.highIssues}</p>
            <p>Total Issues: ${data.summary.security.totalIssues}</p>
        </div>
    </div>

    <h2>Test Suite Details</h2>
    <table>
        <thead>
            <tr>
                <th>Suite</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Coverage</th>
                <th>Issues</th>
            </tr>
        </thead>
        <tbody>
            ${data.results.map((result: any) => `
                <tr>
                    <td>${result.suite}</td>
                    <td class="${result.status}">${result.status.toUpperCase()}</td>
                    <td>${result.duration}ms</td>
                    <td>${result.coverage ? result.coverage.statements.toFixed(1) + '%' : 'N/A'}</td>
                    <td>${result.vulnerabilities.critical + result.vulnerabilities.high}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

    return htmlTemplate;
  }

  /**
   * Generate JUnit XML report
   */
  private async generateJUnitReport(results: TestResult[]): Promise<string> {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<testsuites>\n';

    for (const result of results) {
      xml += `  <testsuite name="${result.suite}" tests="1" failures="${result.status === 'failed' ? 1 : 0}" time="${result.duration / 1000}">\n`;
      xml += `    <testcase name="${result.suite}" classname="critical-path" time="${result.duration / 1000}">\n`;

      if (result.status === 'failed') {
        xml += `      <failure message="${result.errors.join('; ')}">\n`;
        xml += `        ${result.errors.join('\n        ')}\n`;
        xml += `      </failure>\n`;
      }

      if (result.status === 'skipped') {
        xml += `      <skipped message="${result.warnings.join('; ')}" />\n`;
      }

      xml += '    </testcase>\n';
      xml += '  </testsuite>\n';
    }

    xml += '</testsuites>';
    return xml;
  }

  /**
   * Generate coverage report
   */
  private async generateCoverageReport(metrics: TestMetrics): Promise<string> {
    let markdown = `# Critical Path Coverage Report\n\n`;
    markdown += `**Generated:** ${new Date().toISOString()}\n`;
    markdown += `**Project:** ${this.config.projectName}\n\n`;

    markdown += `## Coverage Summary\n\n`;
    markdown += `| Metric | Coverage | Status |\n`;
    markdown += `|--------|----------|--------|\n`;

    const coverageThresholds = this.config.thresholds.coverage;

    markdown += `| Statements | ${metrics.coverage.statements.toFixed(1)}% | ${metrics.coverage.statements >= coverageThresholds.statements ? '✅' : '❌'} |\n`;
    markdown += `| Branches | ${metrics.coverage.branches.toFixed(1)}% | ${metrics.coverage.branches >= coverageThresholds.branches ? '✅' : '❌'} |\n`;
    markdown += `| Functions | ${metrics.coverage.functions.toFixed(1)}% | ${metrics.coverage.functions >= coverageThresholds.functions ? '✅' : '❌'} |\n`;
    markdown += `| Lines | ${metrics.coverage.lines.toFixed(1)}% | ${metrics.coverage.lines >= coverageThresholds.lines ? '✅' : '❌'} |\n\n`;

    markdown += `## Test Execution Summary\n\n`;
    markdown += `- **Total Suites:** ${metrics.totalSuites}\n`;
    markdown += `- **Passed:** ${metrics.passedSuites}\n`;
    markdown += `- **Failed:** ${metrics.failedSuites}\n`;
    markdown += `- **Skipped:** ${metrics.skippedSuites}\n\n`;

    markdown += `## Security Assessment\n\n`;
    markdown += `- **Critical Issues:** ${metrics.security.criticalIssues}\n`;
    markdown += `- **High Issues:** ${metrics.security.highIssues}\n`;
    markdown += `- **Total Issues:** ${metrics.security.totalIssues}\n\n`;

    markdown += `## Performance Metrics\n\n`;
    markdown += `- **Average Execution Time:** ${metrics.performance.averageExecutionTime.toFixed(2)}ms\n`;
    markdown += `- **Max Execution Time:** ${metrics.performance.maxExecutionTime}ms\n`;
    markdown += `- **Total Memory Usage:** ${(metrics.performance.totalMemoryUsage / 1024 / 1024).toFixed(2)}MB\n\n`;

    return markdown;
  }

  /**
   * Send notifications about test results
   */
  private async sendNotifications(metrics: TestMetrics, qualityGate: any): Promise<void> {
    const message = this.formatNotificationMessage(metrics, qualityGate);

    // Slack notification
    if (this.config.notifications.slack) {
      await this.sendSlackNotification(message);
    }

    // Email notification
    if (this.config.notifications.email) {
      await this.sendEmailNotification(message);
    }
  }

  /**
   * Format notification message
   */
  private formatNotificationMessage(metrics: TestMetrics, qualityGate: any): string {
    const status = qualityGate.passed ? '✅ PASSED' : '❌ FAILED';
    const coverage = `Coverage: ${metrics.coverage.statements.toFixed(1)}%`;
    const issues = `Issues: ${metrics.security.totalIssues}`;
    const duration = `Duration: ${metrics.performance.averageExecutionTime.toFixed(2)}ms`;

    return `Critical Path Tests ${status}\n${coverage}\n${issues}\n${duration}`;
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(message: string): Promise<void> {
    if (!this.config.notifications.slack) return;

    try {
      const payload = {
        channel: this.config.notifications.slack.channel,
        text: message,
        username: 'TestBot',
        icon_emoji: ':robot_face:'
      };

      // In a real implementation, use fetch or a Slack SDK
      console.log('📱 Slack notification would be sent:', payload);
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(message: string): Promise<void> {
    if (!this.config.notifications.email) return;

    try {
      const email = {
        to: this.config.notifications.email.recipients.join(','),
        subject: `Critical Path Test Results - ${this.config.projectName}`,
        text: message
      };

      // In a real implementation, use nodemailer or similar
      console.log('📧 Email notification would be sent:', email);
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Save test result to history
   */
  private async saveTestResult(result: TestResult): Promise<void> {
    try {
      const historyPath = path.join(this.config.outputDirectory, 'test-history.json');
      let history: TestResult[] = [];

      try {
        const existingHistory = await fs.readFile(historyPath, 'utf-8');
        history = JSON.parse(existingHistory);
      } catch {
        // File doesn't exist or is invalid
      }

      history.push(result);

      // Keep only last 100 results
      if (history.length > 100) {
        history = history.slice(-100);
      }

      await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to save test result:', error);
    }
  }

  /**
   * Load trend data for historical analysis
   */
  private async loadTrendData(): Promise<any[]> {
    try {
      const historyPath = path.join(this.config.outputDirectory, 'test-history.json');
      const history = await fs.readFile(historyPath, 'utf-8');
      const results: TestResult[] = JSON.parse(history);

      // Group by date and calculate averages
      const trendMap = new Map<string, any>();

      for (const result of results) {
        const date = result.timestamp.toISOString().split('T')[0];

        if (!trendMap.has(date)) {
          trendMap.set(date, {
            date,
            coverage: 0,
            performance: 0,
            issues: 0,
            count: 0
          });
        }

        const trend = trendMap.get(date)!;
        trend.coverage += result.coverage?.statements || 0;
        trend.performance += result.duration;
        trend.issues += result.vulnerabilities.critical + result.vulnerabilities.high;
        trend.count++;
      }

      // Calculate averages and return sorted array
      return Array.from(trendMap.values())
        .map(trend => ({
          ...trend,
          coverage: trend.coverage / trend.count,
          performance: trend.performance / trend.count
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // Last 30 days

    } catch (error) {
      console.warn('Could not load trend data:', error);
      return [];
    }
  }

  /**
   * Initialize metrics object
   */
  private initializeMetrics(): TestMetrics {
    return {
      totalSuites: 0,
      passedSuites: 0,
      failedSuites: 0,
      skippedSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      coverage: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0
      },
      performance: {
        averageExecutionTime: 0,
        maxExecutionTime: 0,
        totalMemoryUsage: 0,
        flakyRate: 0
      },
      security: {
        criticalIssues: 0,
        highIssues: 0,
        totalIssues: 0
      },
      trendData: []
    };
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}

// CLI interface for standalone execution
export async function runCriticalPathTests(configPath?: string): Promise<void> {
  const defaultConfig: TestExecutionConfig = {
    projectName: 'Turbo Flow Critical Paths',
    testDirectory: './tests/critical-paths',
    outputDirectory: './test-results',
    thresholds: {
      coverage: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95
      },
      performance: {
        maxExecutionTime: 300000, // 5 minutes
        maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
        maxFlakyRate: 5 // 5%
      },
      quality: {
        maxCriticalIssues: 0,
        maxHighIssues: 5,
        minTruthScore: 0.95
      }
    },
    notifications: {
      // Configure based on your CI/CD environment
    }
  };

  let config = defaultConfig;

  if (configPath) {
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      config = { ...defaultConfig, ...JSON.parse(configData) };
    } catch (error) {
      console.error(`Could not load config from ${configPath}, using defaults`);
    }
  }

  const monitor = new TestExecutionMonitor(config);

  try {
    const metrics = await monitor.executeCriticalPathTests();

    // Exit with appropriate code
    process.exit(metrics.failedSuites > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { TestExecutionConfig, TestResult, TestMetrics };