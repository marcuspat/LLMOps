#!/usr/bin/env node

/**
 * Load Test Runner
 * Orchestrates execution of load and stress tests with reporting
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class LoadTestRunner {
  constructor(options = {}) {
    this.options = {
      testTypes: ['load', 'stress'], // load, stress, spike, endurance
      environment: 'staging',
      baseUrl: 'http://localhost:3000/api',
      outputDir: path.join(__dirname, 'reports'),
      generateHtmlReport: true,
      generateJsonReport: true,
      emailReport: false,
      slackNotification: false,
      ...options,
    };

    this.testResults = [];
    this.startTime = null;
    this.endTime = null;
  }

  async runAllTests() {
    console.log('🚀 Starting Load Test Suite');
    console.log(`Environment: ${this.options.environment}`);
    console.log(`Base URL: ${this.options.baseUrl}`);
    console.log(`Test Types: ${this.options.testTypes.join(', ')}`);
    console.log('');

    this.startTime = Date.now();

    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();

      // Run tests based on configuration
      for (const testType of this.options.testTypes) {
        await this.runTest(testType);
      }

      this.endTime = Date.now();

      // Generate consolidated report
      await this.generateConsolidatedReport();

      console.log('✅ Load Test Suite Completed Successfully');
      return this.testResults;

    } catch (error) {
      console.error('❌ Load Test Suite Failed:', error.message);
      throw error;
    }
  }

  async runTest(testType) {
    console.log(`📊 Running ${testType.toUpperCase()} test...`);
    const testStartTime = Date.now();

    try {
      const result = await this.executeTest(testType);
      const testEndTime = Date.now();

      const testResult = {
        type: testType,
        status: 'completed',
        duration: testEndTime - testStartTime,
        startTime: testStartTime,
        endTime: testEndTime,
        result: result,
      };

      this.testResults.push(testResult);
      console.log(`✅ ${testType.toUpperCase()} test completed in ${(testEndTime - testStartTime) / 1000}s`);

    } catch (error) {
      const testResult = {
        type: testType,
        status: 'failed',
        duration: Date.now() - testStartTime,
        error: error.message,
      };

      this.testResults.push(testResult);
      console.error(`❌ ${testType.toUpperCase()} test failed:`, error.message);
    }
  }

  async executeTest(testType) {
    const scenarioFile = this.getScenarioFile(testType);
    const outputFile = this.getOutputFile(testType);
    const jsonFile = this.getJsonOutputFile(testType);

    // Construct k6 command
    const k6Command = this.buildK6Command(scenarioFile, outputFile, jsonFile);

    console.log(`Executing: ${k6Command}`);

    const { stdout, stderr } = await execAsync(k6Command);

    // Parse results from output files
    const results = await this.parseTestResults(jsonFile);

    return {
      command: k6Command,
      stdout,
      stderr,
      results,
      outputFile,
    };
  }

  getScenarioFile(testType) {
    const scenarioFiles = {
      load: path.join(__dirname, 'scenarios/basic-load-test.js'),
      stress: path.join(__dirname, 'scenarios/stress-test.js'),
      spike: path.join(__dirname, 'scenarios/spike-test.js'),
      endurance: path.join(__dirname, 'scenarios/endurance-test.js'),
    };

    const file = scenarioFiles[testType];
    if (!file) {
      throw new Error(`Unknown test type: ${testType}`);
    }

    return file;
  }

  getOutputFile(testType) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.options.outputDir, `${testType}-test-${timestamp}.json`);
  }

  getJsonOutputFile(testType) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.options.outputDir, `${testType}-test-${timestamp}.raw.json`);
  }

  buildK6Command(scenarioFile, outputFile, jsonFile) {
    const baseUrl = this.options.baseUrl;
    const environment = this.options.environment;

    return `k6 run --out json=${jsonFile} --out summary=stdout \
      --include-system-env-vars \
      -e BASE_URL=${baseUrl} \
      -e ENVIRONMENT=${environment} \
      ${scenarioFile}`;
  }

  async parseTestResults(jsonFile) {
    try {
      const data = await fs.readFile(jsonFile, 'utf8');
      const lines = data.trim().split('\n');

      const metrics = {};
      let lastLine = null;

      for (const line of lines) {
        if (line.trim()) {
          lastLine = line;
          try {
            const metric = JSON.parse(line);

            // Extract key metrics
            if (metric.type === 'Point') {
              const metricName = metric.metric;
              if (!metrics[metricName]) {
                metrics[metricName] = {
                  values: [],
                  count: 0,
                  sum: 0,
                  min: Infinity,
                  max: -Infinity,
                };
              }

              const value = metric.data.value;
              metrics[metricName].values.push(value);
              metrics[metricName].count++;
              metrics[metricName].sum += value;
              metrics[metricName].min = Math.min(metrics[metricName].min, value);
              metrics[metricName].max = Math.max(metrics[metricName].max, value);
            }
          } catch (parseError) {
            // Skip lines that can't be parsed as JSON
          }
        }
      }

      // Calculate averages and percentiles
      for (const metricName in metrics) {
        const metric = metrics[metricName];
        metric.avg = metric.sum / metric.count;

        // Sort values for percentile calculation
        metric.values.sort((a, b) => a - b);

        metric.p50 = metric.values[Math.floor(metric.count * 0.5)];
        metric.p90 = metric.values[Math.floor(metric.count * 0.9)];
        metric.p95 = metric.values[Math.floor(metric.count * 0.95)];
        metric.p99 = metric.values[Math.floor(metric.count * 0.99)];
      }

      return metrics;

    } catch (error) {
      console.warn(`Warning: Could not parse test results from ${jsonFile}:`, error.message);
      return {};
    }
  }

  async ensureOutputDirectory() {
    try {
      await fs.access(this.options.outputDir);
    } catch {
      await fs.mkdir(this.options.outputDir, { recursive: true });
    }
  }

  async generateConsolidatedReport() {
    const reportData = {
      metadata: {
        startTime: this.startTime,
        endTime: this.endTime,
        duration: this.endTime - this.startTime,
        environment: this.options.environment,
        baseUrl: this.options.baseUrl,
        testTypes: this.options.testTypes,
        generatedAt: new Date().toISOString(),
      },
      summary: this.generateSummary(),
      testResults: this.testResults,
      recommendations: this.generateRecommendations(),
    };

    // Generate JSON report
    if (this.options.generateJsonReport) {
      const jsonReportPath = path.join(this.options.outputDir, 'consolidated-report.json');
      await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));
      console.log(`📄 JSON report generated: ${jsonReportPath}`);
    }

    // Generate HTML report
    if (this.options.generateHtmlReport) {
      await this.generateHtmlReport(reportData);
    }

    // Generate console summary
    this.printConsoleSummary(reportData);
  }

  generateSummary() {
    const completedTests = this.testResults.filter(test => test.status === 'completed');
    const failedTests = this.testResults.filter(test => test.status === 'failed');

    return {
      totalTests: this.testResults.length,
      completedTests: completedTests.length,
      failedTests: failedTests.length,
      successRate: completedTests.length / this.testResults.length,
      totalDuration: this.endTime - this.startTime,
      averageTestDuration: completedTests.reduce((sum, test) => sum + test.duration, 0) / completedTests.length,
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const issues = [];

    // Analyze each test result for issues
    for (const testResult of this.testResults) {
      if (testResult.status === 'failed') {
        issues.push({
          test: testResult.type,
          severity: 'high',
          description: `Test failed: ${testResult.error}`,
        });
        continue;
      }

      if (testResult.result && testResult.result.results) {
        const metrics = testResult.result.results;

        // Check response times
        if (metrics.http_req_duration && metrics.http_req_duration.p95 > 2000) {
          recommendations.push({
            priority: 'medium',
            category: 'performance',
            test: testResult.type,
            description: '95th percentile response time exceeds 2 seconds',
            action: 'Investigate performance bottlenecks and optimize slow operations',
          });
        }

        // Check error rates
        if (metrics.http_req_failed && metrics.http_req_failed.rate > 0.05) {
          recommendations.push({
            priority: 'high',
            category: 'reliability',
            test: testResult.type,
            description: 'Error rate exceeds 5%',
            action: 'Review error handling and improve system reliability',
          });
        }

        // Check throughput
        if (metrics.http_reqs && metrics.http_reqs.rate < 10) {
          recommendations.push({
            priority: 'medium',
            category: 'throughput',
            test: testResult.type,
            description: 'Low throughput detected',
            action: 'Optimize system for better concurrency and performance',
          });
        }
      }
    }

    return {
      recommendations,
      issues,
    };
  }

  async generateHtmlReport(reportData) {
    const htmlTemplate = this.getHtmlReportTemplate(reportData);
    const htmlReportPath = path.join(this.options.outputDir, 'load-test-report.html');

    await fs.writeFile(htmlReportPath, htmlTemplate);
    console.log(`🌐 HTML report generated: ${htmlReportPath}`);
  }

  getHtmlReportTemplate(reportData) {
    const { metadata, summary, testResults, recommendations } = reportData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TurboFlow Load Test Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .header h1 { color: #333; margin: 0; font-size: 2.5em; }
        .header .subtitle { color: #666; margin: 5px 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 1.5em; font-weight: bold; color: #007bff; }
        .test-results { margin-bottom: 30px; }
        .test-result { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
        .test-header { padding: 15px; background: #f8f9fa; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        .test-body { padding: 15px; }
        .test-completed { border-left: 4px solid #28a745; }
        .test-failed { border-left: 4px solid #dc3545; }
        .recommendations { margin-top: 30px; }
        .recommendation { padding: 15px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #ffc107; background: #fff3cd; }
        .recommendation.high { border-left-color: #dc3545; background: #f8d7da; }
        .recommendation.medium { border-left-color: #ffc107; background: #fff3cd; }
        .status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status.completed { background: #28a745; }
        .status.failed { background: #dc3545; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 15px; }
        .metric { background: #f8f9fa; padding: 10px; border-radius: 4px; text-align: center; }
        .metric .label { font-size: 0.8em; color: #666; display: block; }
        .metric .value { font-weight: bold; color: #333; }
        .timestamp { color: #666; font-size: 0.9em; margin-top: 20px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 TurboFlow Load Test Report</h1>
            <div class="subtitle">
                Environment: ${metadata.environment} |
                Base URL: ${metadata.baseUrl} |
                Duration: ${(metadata.duration / 1000 / 60).toFixed(1)} minutes
            </div>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">${summary.totalTests}</div>
            </div>
            <div class="summary-card">
                <h3>Completed</h3>
                <div class="value">${summary.completedTests}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value">${summary.failedTests}</div>
            </div>
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div class="value">${(summary.successRate * 100).toFixed(1)}%</div>
            </div>
        </div>

        <div class="test-results">
            <h2>📊 Test Results</h2>
            ${testResults.map(test => `
                <div class="test-result test-${test.status}">
                    <div class="test-header">
                        <span>${test.type.toUpperCase()} Test</span>
                        <span class="status ${test.status}">${test.status.toUpperCase()}</span>
                    </div>
                    <div class="test-body">
                        <p><strong>Duration:</strong> ${(test.duration / 1000).toFixed(1)} seconds</p>
                        ${test.error ? `<p><strong>Error:</strong> ${test.error}</p>` : ''}
                        ${this.renderTestMetrics(test)}
                    </div>
                </div>
            `).join('')}
        </div>

        ${recommendations.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>💡 Recommendations</h2>
            ${recommendations.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <strong>${rec.category.toUpperCase()}:</strong> ${rec.description}
                    <br><em>Action: ${rec.action}</em>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="timestamp">
            Report generated at ${new Date(metadata.generatedAt).toLocaleString()}
        </div>
    </div>
</body>
</html>`;
  }

  renderTestMetrics(test) {
    if (!test.result || !test.result.results) return '';

    const metrics = test.result.results;
    const relevantMetrics = [
      { key: 'http_req_duration', label: 'Response Time', unit: 'ms' },
      { key: 'http_req_failed', label: 'Error Rate', unit: '%' },
      { key: 'http_reqs', label: 'Throughput', unit: 'req/s' },
    ];

    return `
        <div class="metrics">
            ${relevantMetrics.map(metric => {
              const data = metrics[metric.key];
              if (!data) return '';

              const value = metric.unit === '%' ? (data.rate * 100).toFixed(2) :
                           metric.unit === 'req/s' ? data.rate.toFixed(2) :
                           data.avg ? data.avg.toFixed(2) : 'N/A';

              return `
                <div class="metric">
                    <span class="label">${metric.label}</span>
                    <span class="value">${value} ${metric.unit}</span>
                </div>
              `;
            }).join('')}
        </div>
    `;
  }

  printConsoleSummary(reportData) {
    const { summary, recommendations } = reportData;

    console.log('\n📊 LOAD TEST SUMMARY');
    console.log('===================');
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Completed: ${summary.completedTests} ✅`);
    console.log(`Failed: ${summary.failedTests} ❌`);
    console.log(`Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${(summary.totalDuration / 1000 / 60).toFixed(1)} minutes`);

    if (recommendations.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('==================');
      recommendations.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.category}: ${rec.description}`);
      });
    }

    console.log('\n📁 Reports generated in:', this.options.outputDir);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    testTypes: process.argv.includes('--stress') ? ['load', 'stress'] : ['load'],
    environment: process.env.TEST_ENVIRONMENT || 'staging',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000/api',
  };

  const runner = new LoadTestRunner(options);
  runner.runAllTests().catch(console.error);
}

export default LoadTestRunner;