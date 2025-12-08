import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

/**
 * Global setup for visual regression testing
 * Prepares the environment, creates necessary directories, and sets up baseline screenshots
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🎨 Setting up visual regression testing environment...');

  try {
    // Create necessary directories for visual testing
    const directories = [
      'tests/visual/screenshots',
      'tests/visual/diff',
      'tests/visual/baseline',
      'tests/visual/reports',
      'tests/visual/test-results',
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          console.warn(`⚠️  Warning creating directory ${dir}:`, error);
        }
      }
    }

    // Set up environment variables for visual testing
    process.env.VISUAL_TEST_MODE = 'true';
    process.env.VISUAL_TEST_BASE_URL = config.webServer?.[0]?.url || 'http://localhost:3000';
    process.env.VISUAL_TEST_TIMEOUT = '60000';

    // Create visual test configuration file
    const visualConfig = {
      threshold: 0.2,
      maxDiffPixels: 1000,
      maxDiffPixelRatio: 0.02,
      animationTimeout: 5000,
      enableDebugMode: process.env.NODE_ENV === 'development',
      testEnvironment: process.env.TEST_ENVIRONMENT || 'development',
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(process.cwd(), 'tests/visual/visual-config.json'),
      JSON.stringify(visualConfig, null, 2)
    );

    console.log('✅ Visual test configuration created');

    // Verify application is ready for visual testing
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Wait for application to be ready
      await page.goto(process.env.VISUAL_TEST_BASE_URL!, { timeout: 30000 });
      await page.waitForLoadState('networkidle');

      // Check if application is properly loaded
      const appTitle = await page.title();
      console.log(`✅ Application is ready: "${appTitle}"`);

      // Check for critical elements
      const criticalElements = [
        '[data-testid="app-header"]',
        '[data-testid="main-content"]',
      ];

      for (const selector of criticalElements) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          console.log(`✅ Critical element found: ${selector}`);
        } catch {
          console.warn(`⚠️  Warning: Critical element not found: ${selector}`);
        }
      }

    } catch (error) {
      console.error('❌ Error checking application readiness:', error);
      throw new Error('Application is not ready for visual testing');
    } finally {
      await browser.close();
    }

    // Set up mock data for consistent visual testing
    await setupMockData();

    console.log('🎨 Visual regression testing setup completed successfully');

  } catch (error) {
    console.error('❌ Failed to set up visual testing environment:', error);
    throw error;
  }
}

/**
 * Set up mock data for consistent visual testing
 */
async function setupMockData(): Promise<void> {
  const mockDataDir = path.join(process.cwd(), 'tests/visual/mock-data');

  try {
    await fs.mkdir(mockDataDir, { recursive: true });

    // Create mock user data
    const mockUser = {
      id: 'visual-test-user',
      name: 'Visual Test User',
      email: 'visual-test@example.com',
      avatar: null,
      role: 'user',
      createdAt: '2023-01-01T12:00:00Z',
    };

    // Create mock swarm data
    const mockSwarm = {
      id: 'visual-test-swarm',
      name: 'Visual Test Swarm',
      description: 'A test swarm for visual regression testing',
      status: 'active',
      agents: [
        { id: 'agent-1', type: 'CODER', status: 'idle', name: 'Visual Agent 1' },
        { id: 'agent-2', type: 'TESTER', status: 'busy', name: 'Visual Agent 2' },
        { id: 'agent-3', type: 'DOCUMENTER', status: 'idle', name: 'Visual Agent 3' },
      ],
      tasks: [
        { id: 'task-1', name: 'Visual Task 1', status: 'completed', priority: 'HIGH' },
        { id: 'task-2', name: 'Visual Task 2', status: 'running', priority: 'MEDIUM' },
      ],
      createdAt: '2023-01-01T12:00:00Z',
    };

    // Create mock task data
    const mockTask = {
      id: 'visual-test-task',
      name: 'Visual Test Task',
      description: 'A test task for visual regression testing',
      status: 'pending',
      priority: 'medium',
      type: 'CODE_GENERATION',
      swarm: 'Visual Test Swarm',
      createdAt: '2023-01-01T12:00:00Z',
      updatedAt: '2023-01-01T13:00:00Z',
    };

    // Write mock data files
    await fs.writeFile(
      path.join(mockDataDir, 'user.json'),
      JSON.stringify(mockUser, null, 2)
    );

    await fs.writeFile(
      path.join(mockDataDir, 'swarm.json'),
      JSON.stringify(mockSwarm, null, 2)
    );

    await fs.writeFile(
      path.join(mockDataDir, 'task.json'),
      JSON.stringify(mockTask, null, 2)
    );

    // Create mock metrics data
    const mockMetrics = {
      activeUsers: 50,
      totalTasks: 1250,
      completedTasks: 1000,
      averageResponseTime: 250,
      cpuUsage: 45.5,
      memoryUsage: 62.3,
      timestamp: '2023-01-01T12:00:00Z',
    };

    await fs.writeFile(
      path.join(mockDataDir, 'metrics.json'),
      JSON.stringify(mockMetrics, null, 2)
    );

    console.log('✅ Mock data files created for visual testing');

  } catch (error) {
    console.warn('⚠️  Warning creating mock data:', error);
  }
}

export default globalSetup;