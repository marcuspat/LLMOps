import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright Global Setup');

  // Create necessary directories
  const directories = [
    'coverage/playwright-assets',
    'coverage/playwright-screenshots',
    'coverage/playwright-videos',
    'coverage/playwright-traces'
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Setup test database and services
  console.log('📊 Setting up test environment...');

  // Setup browser extensions if needed
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Install required extensions for testing
  // await context.addInitScript(() => {
  //   // Browser extension setup code
  // });

  await context.close();
  await browser.close();

  // Generate test data
  await generateTestData();

  console.log('✅ Playwright Global Setup Complete');
}

async function generateTestData() {
  // Generate test users, repositories, and other test data
  console.log('📝 Generating test data...');

  // This would connect to your test database and seed it
  // with realistic test data for E2E testing

  const testData = {
    users: [
      {
        id: 'test-user-1',
        email: 'user1@example.com',
        name: 'Test User One',
        role: 'developer'
      },
      {
        id: 'test-user-2',
        email: 'user2@example.com',
        name: 'Test User Two',
        role: 'admin'
      }
    ],
    repositories: [
      {
        id: 'test-repo-1',
        name: 'turbo-flow-test',
        owner: 'test-user-1',
        private: false,
        language: 'TypeScript'
      }
    ]
  };

  // Save test data for use in tests
  fs.writeFileSync(
    path.join(process.cwd(), 'tests/fixtures/e2e-test-data.json'),
    JSON.stringify(testData, null, 2)
  );

  console.log('✅ Test data generated');
}

export default globalSetup;