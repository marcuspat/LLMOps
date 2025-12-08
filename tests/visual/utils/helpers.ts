import { test, expect, type Page, type Locator } from '@playwright/test';
import { VisualRegressionConfig, VIEWPORTS } from './visual-config.js';
import path from 'path';

const config = new VisualRegressionConfig();

/**
 * Generate consistent screenshot options for visual testing
 */
export function getScreenshotOptions(
  testName: string,
  options: {
    fullPage?: boolean;
    viewport?: typeof VIEWPORTS[keyof typeof VIEWPORTS];
    customMask?: string[];
    customStyle?: string;
  } = {}
) {
  const baseOptions = config.getScreenshotOptionsForComponent(testName);

  return {
    ...baseOptions,
    fullPage: options.fullPage ?? baseOptions.fullPage,
    animations: 'disabled',
    deviceScaleFactor: options.viewport?.name.includes('mobile') ? 2 : 1,
    mask: options.customMask ? [...baseOptions.mask!, ...options.customMask] : baseOptions.mask,
    style: options.customStyle ? baseOptions.style + '\n' + options.customStyle : baseOptions.style,
  };
}

/**
 * Generate screenshot file path with proper naming convention
 */
export function screenshotPath(testName: string, viewport?: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const viewportSuffix = viewport ? `-${viewport}` : '';
  return `${testName}${viewportSuffix}.png`;
}

/**
 * Wait for animations to complete before taking screenshot
 */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');

  // Wait for CSS animations and transitions
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const elements = document.getAnimations();
      if (elements.length === 0) {
        resolve();
        return;
      }

      Promise.all(elements.map(animation => animation.finished))
        .then(() => resolve())
        .catch(() => resolve()); // Resolve even if some animations fail
    });
  });

  // Additional wait for any JavaScript-driven animations
  await page.waitForTimeout(300);
}

/**
 * Hide dynamic content that shouldn't be part of visual tests
 */
export async function hideDynamicContent(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      /* Hide time-based content */
      [data-testid="time-display"],
      [data-testid="timestamp"],
      [data-testid="relative-time"],
      .time-display,
      .timestamp {
        visibility: hidden !important;
      }

      /* Hide user-specific content */
      [data-testid="user-avatar"],
      [data-testid="user-name"],
      [data-testid="user-id"] {
        visibility: hidden !important;
      }

      /* Hide dynamic notifications */
      [data-testid="notification-badge"],
      [data-testid="live-counter"],
      [data-testid="real-time-data"] {
        visibility: hidden !important;
      }

      /* Hide loading spinners during screenshots */
      [data-testid="loading"],
      [data-testid="spinner"],
      .loading,
      .spinner {
        opacity: 0 !important;
      }

      /* Disable CSS animations for consistency */
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0.01ms !important;
        transition-duration: 0.01ms !important;
        transition-delay: 0.01ms !important;
      }
    `
  });
}

/**
 * Mock dynamic data for consistent visual testing
 */
export async function mockDynamicData(page: Page): Promise<void> {
  // Mock current time
  const fixedTime = new Date('2023-01-01T12:00:00Z');
  await page.addInitScript(() => {
    const originalDate = Date;
    (window as any).Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          return new originalDate('2023-01-01T12:00:00Z');
        }
        return new originalDate(...args);
      }
      static now() {
        return new originalDate('2023-01-01T12:00:00Z').getTime();
      }
    };
  });

  // Mock user data
  await page.route('**/api/user/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        avatar: null,
        role: 'user'
      })
    });
  });

  // Mock time-based API responses
  await page.route('**/api/metrics/current', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timestamp: fixedTime.toISOString(),
        activeUsers: 50,
        totalTasks: 1250,
        completedTasks: 1000,
        averageResponseTime: 250
      })
    });
  });
}

/**
 * Set up visual test environment
 */
export async function setupVisualTest(page: Page, options: {
  viewport?: typeof VIEWPORTS[keyof typeof VIEWPORTS];
  theme?: 'light' | 'dark';
  mockData?: boolean;
} = {}) {
  const { viewport = VIEWPORTS.DESKTOP_MD, theme = 'light', mockData = true } = options;

  // Set viewport
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  // Apply theme
  if (theme === 'dark') {
    await page.addStyleTag({
      content: `
        :root {
          --background-color: #1a1a1a;
          --text-color: #ffffff;
          --border-color: #333333;
        }
        body {
          background-color: var(--background-color) !important;
          color: var(--text-color) !important;
        }
      `
    });
  }

  // Mock dynamic data if requested
  if (mockData) {
    await mockDynamicData(page);
  }

  // Hide dynamic content
  await hideDynamicContent(page);

  // Wait for page stability
  await waitForAnimations(page);
}

/**
 * Take consistent screenshot with proper preparation
 */
export async function takeConsistentScreenshot(
  page: Page,
  locator: Locator | Page,
  testName: string,
  options: {
    fullPage?: boolean;
    viewport?: typeof VIEWPORTS[keyof typeof VIEWPORTS];
    customMask?: string[];
    customStyle?: string;
  } = {}
): Promise<void> {
  const screenshotOptions = getScreenshotOptions(testName, options);

  // Wait for animations and dynamic content to stabilize
  await waitForAnimations(page);

  // Hide dynamic content
  await hideDynamicContent(page);

  // Apply custom styles if provided
  if (options.customStyle) {
    await page.addStyleTag({
      content: options.customStyle
    });
  }

  // Take screenshot
  if (locator instanceof Page) {
    await locator.screenshot(screenshotOptions);
  } else {
    await locator.screenshot(screenshotOptions);
  }
}

/**
 * Compare screenshot with baseline (for custom comparison logic)
 */
export async function compareWithBaseline(
  page: Page,
  testName: string,
  currentScreenshot: Buffer,
  options: {
    threshold?: number;
    tolerance?: number;
  } = {}
): Promise<{
  matches: boolean;
  diffPixels: number;
  diffPercentage: number;
  diffBuffer?: Buffer;
}> {
  // This is a placeholder implementation
  // In a real scenario, you might use pixelmatch or similar library

  const threshold = options.threshold ?? config.thresholds.percentage ?? 0.01;
  const tolerance = options.tolerance ?? config.thresholds.colorChannel ?? 10;

  // Simulate comparison logic
  const mockDiffPixels = Math.floor(Math.random() * 1000);
  const mockDiffPercentage = mockDiffPixels / (1280 * 720); // Assuming 1280x720 image

  return {
    matches: mockDiffPercentage < threshold,
    diffPixels: mockDiffPixels,
    diffPercentage: mockDiffPercentage,
    diffBuffer: mockDiffPercentage > threshold ? Buffer.from([]) : undefined,
  };
}

/**
 * Visual regression test wrapper with retry logic
 */
export async function visualTest(
  testName: string,
  testFunction: (page: Page) => Promise<void>,
  options: {
    retries?: number;
    viewport?: typeof VIEWPORTS[keyof typeof VIEWPORTS];
    theme?: 'light' | 'dark';
    mockData?: boolean;
  } = {}
) {
  const { retries = 2, viewport = VIEWPORTS.DESKTOP_MD, theme = 'light', mockData = true } = options;

  await test(testName, async ({ page }) => {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= retries) {
      try {
        // Setup test environment
        await setupVisualTest(page, { viewport, theme, mockData });

        // Run the actual test
        await testFunction(page);

        // If we got here, the test passed
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt <= retries) {
          console.warn(`Visual test "${testName}" failed (attempt ${attempt}/${retries + 1}), retrying...`);
          await page.reload();
          await page.waitForLoadState('networkidle');
        } else {
          console.error(`Visual test "${testName}" failed after ${retries + 1} attempts`);
          throw lastError;
        }
      }
    }
  });
}

/**
 * Generate visual test report data
 */
export function generateVisualTestReport(results: Array<{
  testName: string;
  status: 'passed' | 'failed';
  viewport: string;
  theme: string;
  diffPixels?: number;
  diffPercentage?: number;
  duration: number;
  error?: string;
}>) {
  const passedTests = results.filter(r => r.status === 'passed').length;
  const failedTests = results.filter(r => r.status === 'failed').length;
  const totalTests = results.length;

  const summary = {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
    averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / totalTests,
    timestamp: new Date().toISOString(),
  };

  const details = results.map(result => ({
    ...result,
    status: result.status.toUpperCase() as 'PASSED' | 'FAILED',
  }));

  return {
    summary,
    details,
    environment: {
      nodeVersion: process.version,
      playwrightVersion: '1.40.0', // Get this from package.json in real scenario
      viewport: [...new Set(results.map(r => r.viewport))],
      themes: [...new Set(results.map(r => r.theme))],
    },
  };
}

/**
 * Utility for taking screenshots in different viewports
 */
export async function takeMultiViewportScreenshots(
  page: Page,
  locator: Locator,
  testName: string,
  viewports: Array<typeof VIEWPORTS[keyof typeof VIEWPORTS]> = [VIEWPORTS.MOBILE, VIEWPORTS.TABLET, VIEWPORTS.DESKTOP_MD]
) {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await waitForAnimations(page);

    await locator.screenshot(
      getScreenshotOptions(`${testName}-${viewport.name}`, { viewport })
    );
  }
}

/**
 * Utility for masking dynamic content
 */
export function createDynamicContentMask(...selectors: string[]): string[] {
  return selectors.map(selector => `[data-testid="${selector}"]`);
}

/**
 * Utility for adding custom styles during visual tests
 */
export function addCustomStyles(page: Page, styles: Record<string, string>): Promise<void> {
  const cssStyles = Object.entries(styles)
    .map(([selector, properties]) => `${selector} { ${properties} }`)
    .join('\n');

  return page.addStyleTag({ content: cssStyles });
}

/**
 * Wait for element to be stable before screenshot
 */
export async function waitForElementStability(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });

  // Wait for element dimensions to be stable
  let previousDimensions: { width: number; height: number } | null = null;
  let stableCount = 0;

  while (stableCount < 3) {
    const element = page.locator(selector);
    const dimensions = await element.evaluate(el => ({
      width: el.offsetWidth,
      height: el.offsetHeight,
    }));

    if (previousDimensions &&
        previousDimensions.width === dimensions.width &&
        previousDimensions.height === dimensions.height) {
      stableCount++;
    } else {
      stableCount = 0;
    }

    previousDimensions = dimensions;
    await page.waitForTimeout(100);
  }
}

/**
 * Generate visual test data for consistent testing
 */
export function generateMockData(type: string): any {
  const mockData = {
    user: {
      id: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com',
      avatar: null,
      role: 'user',
      createdAt: '2023-01-01T00:00:00Z',
    },
    swarm: {
      id: 'test-swarm-123',
      name: 'Test Swarm',
      description: 'A test swarm for visual testing',
      status: 'active',
      agentCount: 5,
      taskCount: 25,
      createdAt: '2023-01-01T00:00:00Z',
    },
    task: {
      id: 'test-task-123',
      name: 'Test Task',
      description: 'A test task for visual testing',
      status: 'pending',
      priority: 'medium',
      createdAt: '2023-01-01T00:00:00Z',
    },
    metrics: {
      activeUsers: 50,
      totalTasks: 1250,
      completedTasks: 1000,
      averageResponseTime: 250,
      cpuUsage: 45.5,
      memoryUsage: 62.3,
    },
  };

  return mockData[type as keyof typeof mockData] || null;
}