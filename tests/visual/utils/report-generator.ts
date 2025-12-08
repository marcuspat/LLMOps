import fs from 'fs/promises';
import path from 'path';

/**
 * Generate comprehensive visual test report
 */
export async function generateVisualTestReport(): Promise<void> {
  try {
    const reportsDir = path.join(process.cwd(), 'tests/visual/reports');

    // Read test results from different sources
    const jsonReport = await readJsonReport();
    const screenshotData = await analyzeScreenshots();
    const diffData = await analyzeDiffFiles();

    // Generate comprehensive report
    const reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        environment: process.env.TEST_ENVIRONMENT || 'development',
        testConfiguration: await readTestConfiguration(),
      },
      summary: generateReportSummary(jsonReport),
      screenshotAnalysis: screenshotData,
      diffAnalysis: diffData,
      recommendations: generateRecommendations(jsonReport, diffData),
    };

    // Write comprehensive report
    await fs.writeFile(
      path.join(reportsDir, 'comprehensive-visual-report.json'),
      JSON.stringify(reportData, null, 2)
    );

    // Generate HTML report
    await generateHtmlReport(reportData);

    console.log('📊 Comprehensive visual test report generated');

  } catch (error) {
    console.warn('⚠️  Warning generating visual test report:', error);
  }
}

/**
 * Read JSON test report from Playwright
 */
async function readJsonReport(): Promise<any> {
  try {
    const jsonReportPath = path.join(process.cwd(), 'tests/visual/reports/visual-results.json');
    const data = await fs.readFile(jsonReportPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Could not read JSON report:', error);
    return null;
  }
}

/**
 * Analyze screenshot files
 */
async function analyzeScreenshots(): Promise<any> {
  try {
    const screenshotsDir = path.join(process.cwd(), 'tests/visual/screenshots');
    const screenshots = await fs.readdir(screenshotsDir);

    const analysis = {
      totalScreenshots: screenshots.length,
      fileTypes: {} as Record<string, number>,
      totalSize: 0,
      averageSize: 0,
      oldestScreenshot: null,
      newestScreenshot: null,
    };

    let totalSize = 0;
    let oldestTime = Date.now();
    let newestTime = 0;

    for (const screenshot of screenshots) {
      const filePath = path.join(screenshotsDir, screenshot);
      const stats = await fs.stat(filePath);

      // File type analysis
      const ext = path.extname(screenshot).toLowerCase();
      analysis.fileTypes[ext] = (analysis.fileTypes[ext] || 0) + 1;

      totalSize += stats.size;

      if (stats.mtime.getTime() < oldestTime) {
        oldestTime = stats.mtime.getTime();
        analysis.oldestScreenshot = screenshot;
      }

      if (stats.mtime.getTime() > newestTime) {
        newestTime = stats.mtime.getTime();
        analysis.newestScreenshot = screenshot;
      }
    }

    analysis.totalSize = totalSize;
    analysis.averageSize = screenshots.length > 0 ? totalSize / screenshots.length : 0;

    return analysis;

  } catch (error) {
    console.warn('Could not analyze screenshots:', error);
    return null;
  }
}

/**
 * Analyze diff files (baseline comparisons)
 */
async function analyzeDiffFiles(): Promise<any> {
  try {
    const diffDir = path.join(process.cwd(), 'tests/visual/diff');
    const diffFiles = await fs.readdir(diffDir);

    const analysis = {
      totalDiffs: diffFiles.length,
      totalDiffPixels: 0,
      averageDiffPixels: 0,
      maxDiffPixels: 0,
      minDiffPixels: Infinity,
      failedComparisons: 0,
      successfulComparisons: 0,
    };

    let totalDiffPixels = 0;
    let validComparisons = 0;

    for (const diffFile of diffFiles) {
      if (diffFile.endsWith('.json')) {
        try {
          const diffData = JSON.parse(
            await fs.readFile(path.join(diffDir, diffFile), 'utf8')
          );

          const diffPixels = diffData.diffPixels || 0;
          analysis.totalDiffPixels += diffPixels;
          analysis.maxDiffPixels = Math.max(analysis.maxDiffPixels, diffPixels);
          analysis.minDiffPixels = Math.min(analysis.minDiffPixels, diffPixels);

          if (diffData.status === 'failed') {
            analysis.failedComparisons++;
          } else {
            analysis.successfulComparisons++;
          }

          validComparisons++;

        } catch (error) {
          console.warn(`Could not parse diff file ${diffFile}:`, error);
        }
      }
    }

    analysis.averageDiffPixels = validComparisons > 0 ? totalDiffPixels / validComparisons : 0;
    analysis.minDiffPixels = analysis.minDiffPixels === Infinity ? 0 : analysis.minDiffPixels;

    return analysis;

  } catch (error) {
    console.warn('Could not analyze diff files:', error);
    return null;
  }
}

/**
 * Generate report summary
 */
function generateReportSummary(jsonReport: any): any {
  if (!jsonReport) {
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      flakyTests: 0,
      duration: 0,
      successRate: 0,
    };
  }

  const summary = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    flakyTests: 0,
    duration: 0,
    successRate: 0,
  };

  // Count test results
  if (jsonReport.suites) {
    for (const suite of jsonReport.suites) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          summary.totalTests++;

          if (spec.ok) {
            summary.passedTests++;
          } else {
            summary.failedTests++;
          }

          // Check for flaky tests (retries)
          if (spec.results && spec.results.length > 1) {
            summary.flakyTests++;
          }
        }
      }
    }

    summary.duration = jsonReport.duration || 0;
    summary.successRate = summary.totalTests > 0 ? (summary.passedTests / summary.totalTests) * 100 : 0;
  }

  return summary;
}

/**
 * Read test configuration
 */
async function readTestConfiguration(): Promise<any> {
  try {
    const configPath = path.join(process.cwd(), 'tests/visual/visual-config.json');
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Could not read visual test configuration:', error);
    return {};
  }
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(jsonReport: any, diffData: any): string[] {
  const recommendations: string[] = [];

  if (!jsonReport) {
    return recommendations;
  }

  const summary = generateReportSummary(jsonReport);

  // Success rate recommendations
  if (summary.successRate < 95) {
    recommendations.push('Consider investigating failed visual tests - success rate is below 95%');
  }

  if (summary.flakyTests > 0) {
    recommendations.push(`${summary.flakyTests} flaky tests detected. Consider reviewing test stability and retry logic`);
  }

  // Diff analysis recommendations
  if (diffData) {
    if (diffData.failedComparisons > 0) {
      recommendations.push(`${diffData.failedComparisons} visual comparisons failed. Review baseline images and threshold settings`);
    }

    if (diffData.averageDiffPixels > 500) {
      recommendations.push('High average pixel differences detected. Consider adjusting visual thresholds or reviewing recent UI changes');
    }

    if (diffData.totalDiffs > summary.failedTests * 2) {
      recommendations.push('More diff files than failed tests detected. Some tests may have intermittent visual differences');
    }
  }

  // Duration recommendations
  if (summary.duration > 300000) { // 5 minutes
    recommendations.push('Visual tests are taking longer than expected. Consider optimizing test parallelization');
  }

  // No recommendations if everything looks good
  if (recommendations.length === 0) {
    recommendations.push('Visual regression tests are performing well. Continue current testing practices.');
  }

  return recommendations;
}

/**
 * Generate HTML report
 */
async function generateHtmlReport(reportData: any): Promise<void> {
  try {
    const htmlContent = generateHtmlTemplate(reportData);
    const reportsDir = path.join(process.cwd(), 'tests/visual/reports');

    await fs.writeFile(
      path.join(reportsDir, 'comprehensive-visual-report.html'),
      htmlContent
    );

  } catch (error) {
    console.warn('Could not generate HTML report:', error);
  }
}

/**
 * Generate HTML template for visual test report
 */
function generateHtmlTemplate(data: any): string {
  const { summary, screenshotAnalysis, diffAnalysis, recommendations } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Regression Test Report - Turbo Flow</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 2.5em;
        }
        .header .subtitle {
            color: #7f8c8d;
            margin: 10px 0 0 0;
            font-size: 1.1em;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #3498db;
            text-align: center;
        }
        .summary-card.success {
            border-left-color: #27ae60;
        }
        .summary-card.warning {
            border-left-color: #f39c12;
        }
        .summary-card.danger {
            border-left-color: #e74c3c;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 1.1em;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #2c3e50;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #2c3e50;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .recommendations {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 20px;
            margin-top: 20px;
        }
        .recommendations h3 {
            margin: 0 0 15px 0;
            color: #856404;
        }
        .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }
        .recommendations li {
            margin-bottom: 10px;
            color: #856404;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        .stats-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
        }
        .stats-card h4 {
            margin: 0 0 10px 0;
            color: #495057;
        }
        .stats-card .stat-value {
            font-size: 1.2em;
            font-weight: bold;
            color: #2c3e50;
        }
        .timestamp {
            text-align: center;
            color: #6c757d;
            font-size: 0.9em;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Visual Regression Test Report</h1>
            <div class="subtitle">
                Environment: ${data.metadata.environment} |
                Generated: ${new Date(data.metadata.generatedAt).toLocaleString()}
            </div>
        </div>

        <div class="section">
            <h2>📊 Test Summary</h2>
            <div class="summary-grid">
                <div class="summary-card ${summary.successRate >= 95 ? 'success' : summary.successRate >= 80 ? 'warning' : 'danger'}">
                    <h3>Success Rate</h3>
                    <div class="value">${summary.successRate.toFixed(1)}%</div>
                </div>
                <div class="summary-card">
                    <h3>Total Tests</h3>
                    <div class="value">${summary.totalTests}</div>
                </div>
                <div class="summary-card success">
                    <h3>Passed</h3>
                    <div class="value">${summary.passedTests}</div>
                </div>
                <div class="summary-card ${summary.failedTests > 0 ? 'danger' : 'success'}">
                    <h3>Failed</h3>
                    <div class="value">${summary.failedTests}</div>
                </div>
                ${summary.flakyTests > 0 ? `
                <div class="summary-card warning">
                    <h3>Flaky</h3>
                    <div class="value">${summary.flakyTests}</div>
                </div>
                ` : ''}
            </div>
        </div>

        ${screenshotAnalysis ? `
        <div class="section">
            <h2>📸 Screenshot Analysis</h2>
            <div class="stats-grid">
                <div class="stats-card">
                    <h4>Total Screenshots</h4>
                    <div class="stat-value">${screenshotAnalysis.totalScreenshots}</div>
                </div>
                <div class="stats-card">
                    <h4>Total Size</h4>
                    <div class="stat-value">${(screenshotAnalysis.totalSize / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div class="stats-card">
                    <h4>Average Size</h4>
                    <div class="stat-value">${(screenshotAnalysis.averageSize / 1024).toFixed(2)} KB</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${diffAnalysis ? `
        <div class="section">
            <h2>🔄 Visual Diff Analysis</h2>
            <div class="stats-grid">
                <div class="stats-card">
                    <h4>Total Diffs</h4>
                    <div class="stat-value">${diffAnalysis.totalDiffs}</div>
                </div>
                <div class="stats-card">
                    <h4>Average Diff Pixels</h4>
                    <div class="stat-value">${Math.round(diffAnalysis.averageDiffPixels)}</div>
                </div>
                <div class="stats-card ${diffAnalysis.failedComparisons > 0 ? 'danger' : 'success'}">
                    <h4>Failed Comparisons</h4>
                    <div class="stat-value">${diffAnalysis.failedComparisons}</div>
                </div>
                <div class="stats-card">
                    <h4>Max Diff Pixels</h4>
                    <div class="stat-value">${diffAnalysis.maxDiffPixels}</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${recommendations && recommendations.length > 0 ? `
        <div class="recommendations">
            <h3>💡 Recommendations</h3>
            <ul>
                ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="timestamp">
            Report generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>
`;
}