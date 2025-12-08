import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright Global Teardown');

  // Cleanup test databases and services
  console.log('🗄️ Cleaning up test databases...');

  // Clean up test data
  await cleanupTestData();

  // Clean up temporary files
  await cleanupTempFiles();

  // Generate test reports
  await generateReports();

  console.log('✅ Playwright Global Teardown Complete');
}

async function cleanupTestData() {
  console.log('🧼 Cleaning up test data...');

  // This would connect to your test database and clean up
  // Remove test users, repositories, and other test data

  // Remove test data file
  const testDataPath = path.join(process.cwd(), 'tests/fixtures/e2e-test-data.json');
  if (fs.existsSync(testDataPath)) {
    fs.unlinkSync(testDataPath);
  }
}

async function cleanupTempFiles() {
  console.log('🗂️ Cleaning up temporary files...');

  // Clean up old coverage reports and artifacts
  const tempDirs = [
    'coverage/playwright-assets',
    'coverage/playwright-screenshots',
    'coverage/playwright-videos',
    'coverage/playwright-traces'
  ];

  tempDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        // Remove files older than 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (stats.mtime < sevenDaysAgo) {
          fs.unlinkSync(filePath);
        }
      });
    }
  });
}

async function generateReports() {
  console.log('📊 Generating test reports...');

  // Generate comprehensive test report
  const reportData = {
    timestamp: new Date().toISOString(),
    testRun: process.env.TEST_RUN_ID || 'unknown',
    environment: process.env.NODE_ENV || 'test',
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    }
  };

  // Save report
  const reportPath = path.join(process.cwd(), 'coverage/playwright-summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

  console.log('📈 Test reports generated');
}

export default globalTeardown;