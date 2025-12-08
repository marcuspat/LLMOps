import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { generateVisualTestReport } from './utils/report-generator.js';

/**
 * Global teardown for visual regression testing
 * Cleans up temporary files, generates reports, and performs final validation
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Cleaning up visual regression testing environment...');

  try {
    // Generate comprehensive visual test report
    await generateVisualTestReport();

    // Clean up temporary test artifacts
    await cleanupTemporaryFiles();

    // Validate test results and generate summary
    await validateTestResults();

    // Archive test results if needed
    await archiveTestResults();

    console.log('🧹 Visual regression testing cleanup completed successfully');

  } catch (error) {
    console.error('❌ Error during visual testing cleanup:', error);
    throw error;
  }
}

/**
 * Clean up temporary files created during visual testing
 */
async function cleanupTemporaryFiles(): Promise<void> {
  const tempDirs = [
    'tests/visual/test-results/traces',
    'tests/visual/test-results/videos',
    'tests/visual/test-results/screenshots',
  ];

  for (const dir of tempDirs) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);

        // Remove files older than 1 day
        if (Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
          await fs.unlink(filePath);
          console.log(`🗑️  Removed old temporary file: ${file}`);
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`⚠️  Warning cleaning directory ${dir}:`, error);
      }
    }
  }
}

/**
 * Validate test results and generate summary statistics
 */
async function validateTestResults(): Promise<void> {
  try {
    const reportsDir = path.join(process.cwd(), 'tests/visual/reports');
    const jsonReport = path.join(reportsDir, 'visual-results.json');

    if (await fs.access(jsonReport).then(() => true).catch(() => false)) {
      const reportData = await fs.readFile(jsonReport, 'utf8');
      const results = JSON.parse(reportData);

      // Calculate statistics
      const totalTests = results.suites?.reduce((sum: number, suite: any) => sum + suite.specs?.length || 0, 0) || 0;
      const passedTests = results.suites?.reduce((sum: number, suite: any) =>
        sum + (suite.specs?.filter((spec: any) => spec.ok)?.length || 0), 0) || 0;
      const failedTests = totalTests - passedTests;

      const summary = {
        totalTests,
        passedTests,
        failedTests,
        successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
        timestamp: new Date().toISOString(),
        environment: process.env.TEST_ENVIRONMENT || 'development',
      };

      // Write summary file
      await fs.writeFile(
        path.join(reportsDir, 'test-summary.json'),
        JSON.stringify(summary, null, 2)
      );

      console.log(`📊 Visual Test Summary:`);
      console.log(`   Total: ${totalTests}`);
      console.log(`   Passed: ${passedTests}`);
      console.log(`   Failed: ${failedTests}`);
      console.log(`   Success Rate: ${summary.successRate.toFixed(2)}%`);

      // Log any failures for easy debugging
      if (failedTests > 0) {
        console.log(`❌ Failed visual tests detected. Check the HTML report for details.`);
      }

    } else {
      console.log('ℹ️  No test results found to validate');
    }

  } catch (error) {
    console.warn('⚠️  Warning validating test results:', error);
  }
}

/**
 * Archive test results for long-term storage
 */
async function archiveTestResults(): Promise<void> {
  const archiveEnabled = process.env.VISUAL_TEST_ARCHIVE === 'true';

  if (!archiveEnabled) {
    console.log('ℹ️  Test result archiving is disabled');
    return;
  }

  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const archiveDir = path.join(process.cwd(), 'tests/visual/archive', `visual-test-${timestamp}`);

    // Create archive directory
    await fs.mkdir(archiveDir, { recursive: true });

    // Copy important artifacts to archive
    const filesToArchive = [
      'tests/visual/reports',
      'tests/visual/screenshots',
      'tests/visual/baseline',
    ];

    for (const file of filesToArchive) {
      const fileName = path.basename(file);
      const archivePath = path.join(archiveDir, fileName);

      if (await fs.access(file).then(() => true).catch(() => false)) {
        await fs.cp(file, archivePath, { recursive: true });
        console.log(`📦 Archived: ${fileName}`);
      }
    }

    // Clean up old archives (keep last 10)
    const archiveBaseDir = path.join(process.cwd(), 'tests/visual/archive');
    const archives = await fs.readdir(archiveBaseDir);

    if (archives.length > 10) {
      const oldArchives = archives
        .map(name => ({ name, path: path.join(archiveBaseDir, name) }))
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(10);

      for (const archive of oldArchives) {
        await fs.rm(archive.path, { recursive: true, force: true });
        console.log(`🗑️  Removed old archive: ${archive.name}`);
      }
    }

    console.log(`📦 Test results archived to: visual-test-${timestamp}`);

  } catch (error) {
    console.warn('⚠️  Warning archiving test results:', error);
  }
}

/**
 * Generate notifications for test results (optional)
 */
async function generateNotifications(): Promise<void> {
  // This could be extended to send Slack notifications, emails, etc.
  // For now, we'll just log important information

  try {
    const summaryFile = path.join(process.cwd(), 'tests/visual/reports/test-summary.json');

    if (await fs.access(summaryFile).then(() => true).catch(() => false)) {
      const summary = JSON.parse(await fs.readFile(summaryFile, 'utf8'));

      if (summary.failedTests > 0) {
        console.log(`🚨 ALERT: ${summary.failedTests} visual regression tests failed!`);
        console.log(`📊 Success rate: ${summary.successRate.toFixed(2)}%`);
        console.log(`🌐 View detailed report: tests/visual/reports/index.html`);
      } else {
        console.log(`✅ All ${summary.totalTests} visual regression tests passed!`);
      }
    }

  } catch (error) {
    console.warn('⚠️  Warning generating notifications:', error);
  }
}

export default globalTeardown;