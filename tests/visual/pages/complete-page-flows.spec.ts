import { test, expect } from '@playwright/test';
import {
  setupVisualTest,
  takeConsistentScreenshot,
  visualTest,
  takeMultiViewportScreenshots,
  waitForElementStability,
  createDynamicContentMask,
  addCustomStyles,
} from '../utils/helpers.js';
import { VIEWPORTS } from '../utils/visual-config.js';

test.describe('Complete Page Flows - Visual Regression Tests', () => {
  test.describe('Authentication Flow', () => {
    visualTest('login page - initial state', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      const loginForm = page.locator('[data-testid="login-form"]');
      await waitForElementStability(page, '[data-testid="login-form"]');

      await takeConsistentScreenshot(page, loginForm, 'login-page-initial');
    });

    visualTest('login page - with validation errors', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      // Submit empty form to trigger validation
      await page.click('[data-testid="login-submit"]');
      await page.waitForTimeout(300);

      const loginForm = page.locator('[data-testid="login-form"]');
      await takeConsistentScreenshot(page, loginForm, 'login-page-validation');
    });

    visualTest('login page - filled form', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      // Fill form with test data
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      const loginForm = page.locator('[data-testid="login-form"]');
      await takeConsistentScreenshot(page, loginForm, 'login-page-filled');
    });

    visualTest('registration page', async ({ page }) => {
      await page.goto('http://localhost:3000/register');

      const registrationForm = page.locator('[data-testid="registration-form"]');
      await waitForElementStability(page, '[data-testid="registration-form"]');

      await takeConsistentScreenshot(page, registrationForm, 'registration-page');
    });

    visualTest('forgot password page', async ({ page }) => {
      await page.goto('http://localhost:3000/forgot-password');

      const forgotPasswordForm = page.locator('[data-testid="forgot-password-form"]');
      await takeConsistentScreenshot(page, forgotPasswordForm, 'forgot-password-page');
    });
  });

  test.describe('Dashboard Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication for dashboard tests
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('user_data', JSON.stringify({
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com'
        }));
      });
    });

    visualTest('dashboard overview page', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');

      const dashboard = page.locator('[data-testid="dashboard-overview"]');
      await waitForElementStability(page, '[data-testid="dashboard-overview"]');

      await takeConsistentScreenshot(page, dashboard, 'dashboard-overview', {
        customMask: createDynamicContentMask('real-time-metrics', 'live-counter')
      });
    });

    visualTest('dashboard - analytics tab', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');

      // Click on analytics tab
      await page.click('[data-testid="analytics-tab"]');
      await page.waitForTimeout(500);

      const analyticsSection = page.locator('[data-testid="analytics-section"]');
      await takeConsistentScreenshot(page, analyticsSection, 'dashboard-analytics', {
        customMask: createDynamicContentMask('live-chart'),
        customStyle: `
          [data-testid="chart-loading"] {
            display: none !important;
          }
        `
      });
    });

    visualTest('dashboard - activity feed', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');

      const activityFeed = page.locator('[data-testid="activity-feed"]');
      await waitForElementStability(page, '[data-testid="activity-feed"]');

      await takeConsistentScreenshot(page, activityFeed, 'dashboard-activity-feed');
    });

    visualTest('dashboard - metrics cards', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');

      const metricsCards = page.locator('[data-testid="metrics-cards"]');
      await takeConsistentScreenshot(page, metricsCards, 'dashboard-metrics-cards');
    });
  });

  test.describe('Swarm Management Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('user_data', JSON.stringify({
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com'
        }));
      });
    });

    visualTest('swarms list page', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms');

      const swarmsList = page.locator('[data-testid="swarms-list"]');
      await waitForElementStability(page, '[data-testid="swarms-list"]');

      await takeConsistentScreenshot(page, swarmsList, 'swarms-list', {
        customMask: createDynamicContentMask('last-updated', 'status-indicator-dynamic')
      });
    });

    visualTest('swarm creation workflow', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/create');

      // Fill swarm creation form
      await page.fill('[data-testid="swarm-name"]', 'Test Swarm Visual');
      await page.fill('[data-testid="swarm-description"]', 'A test swarm for visual regression testing');
      await page.selectOption('[data-testid="swarm-topology"]', 'MESH');
      await page.fill('[data-testid="max-agents"]', '10');

      const creationForm = page.locator('[data-testid="swarm-creation-form"]');
      await takeConsistentScreenshot(page, creationForm, 'swarm-creation-filled');

      // Mock API response for creation
      await page.route('**/api/swarms', (route) => {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-swarm-visual',
            name: 'Test Swarm Visual',
            status: 'active',
            createdAt: new Date().toISOString()
          })
        });
      });

      await page.click('[data-testid="create-swarm-btn"]');
      await page.waitForTimeout(1000);

      const successMessage = page.locator('[data-testid="success-message"]');
      if (await successMessage.isVisible()) {
        await takeConsistentScreenshot(page, successMessage, 'swarm-creation-success');
      }
    });

    visualTest('swarm detail page', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/test-swarm');

      // Mock swarm data
      await page.route('**/api/swarms/test-swarm', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-swarm',
            name: 'Test Swarm',
            status: 'active',
            agents: [
              { id: 'agent-1', type: 'CODER', status: 'idle', name: 'Agent 1' },
              { id: 'agent-2', type: 'TESTER', status: 'busy', name: 'Agent 2' },
              { id: 'agent-3', type: 'DOCUMENTER', status: 'idle', name: 'Agent 3' },
            ],
            tasks: [
              { id: 'task-1', name: 'Task 1', status: 'completed', priority: 'HIGH' },
              { id: 'task-2', name: 'Task 2', status: 'running', priority: 'MEDIUM' },
            ],
            metrics: { totalTasks: 2, completedTasks: 1, activeTasks: 1 }
          })
        });
      });

      const swarmDetail = page.locator('[data-testid="swarm-detail"]');
      await waitForElementStability(page, '[data-testid="swarm-detail"]');

      await takeConsistentScreenshot(page, swarmDetail, 'swarm-detail', {
        customMask: createDynamicContentMask('agent-status-dynamic', 'real-time-stats')
      });
    });

    visualTest('swarm agents view', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/test-swarm/agents');

      const agentsView = page.locator('[data-testid="agents-view"]');
      await waitForElementStability(page, '[data-testid="agents-view"]');

      await takeConsistentScreenshot(page, agentsView, 'swarm-agents-view', {
        customMask: createDynamicContentMask('agent-heartbeat', 'agent-performance')
      });
    });

    visualTest('swarm tasks view', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/test-swarm/tasks');

      const tasksView = page.locator('[data-testid="tasks-view"]');
      await waitForElementStability(page, '[data-testid="tasks-view"]');

      await takeConsistentScreenshot(page, tasksView, 'swarm-tasks-view', {
        customMask: createDynamicContentMask('task-progress', 'task-timer')
      });
    });

    visualTest('swarm settings page', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/test-swarm/settings');

      const settingsPage = page.locator('[data-testid="swarm-settings"]');
      await waitForElementStability(page, '[data-testid="swarm-settings"]');

      await takeConsistentScreenshot(page, settingsPage, 'swarm-settings');
    });
  });

  test.describe('Task Management Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('user_data', JSON.stringify({
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com'
        }));
      });
    });

    visualTest('tasks list page', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks');

      // Mock tasks data
      await page.route('**/api/tasks', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tasks: [
              { id: 'task-1', name: 'Visual Test Task 1', status: 'PENDING', priority: 'HIGH', swarm: 'Test Swarm' },
              { id: 'task-2', name: 'Visual Test Task 2', status: 'RUNNING', priority: 'MEDIUM', swarm: 'Test Swarm' },
              { id: 'task-3', name: 'Visual Test Task 3', status: 'COMPLETED', priority: 'LOW', swarm: 'Test Swarm' },
            ],
            pagination: { page: 1, total: 25, limit: 10 }
          })
        });
      });

      const tasksList = page.locator('[data-testid="tasks-list"]');
      await waitForElementStability(page, '[data-testid="tasks-list"]');

      await takeConsistentScreenshot(page, tasksList, 'tasks-list', {
        customMask: createDynamicContentMask('task-dynamic-info')
      });
    });

    visualTest('task creation workflow', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/create');

      // Fill task creation form
      await page.fill('[data-testid="task-name"]', 'Visual Test Task');
      await page.fill('[data-testid="task-description"]', 'A task created for visual regression testing');
      await page.selectOption('[data-testid="task-type"]', 'CODE_GENERATION');
      await page.selectOption('[data-testid="task-priority"]', 'MEDIUM');

      const creationForm = page.locator('[data-testid="task-creation-form"]');
      await takeConsistentScreenshot(page, creationForm, 'task-creation-filled');

      // Mock API response
      await page.route('**/api/tasks', (route) => {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'visual-test-task',
            name: 'Visual Test Task',
            status: 'PENDING',
            createdAt: new Date().toISOString()
          })
        });
      });

      await page.click('[data-testid="create-task-btn"]');
      await page.waitForTimeout(1000);

      // Check for success message or redirect
      const successMessage = page.locator('[data-testid="success-message"]');
      if (await successMessage.isVisible()) {
        await takeConsistentScreenshot(page, successMessage, 'task-creation-success');
      }
    });

    visualTest('task detail page', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/visual-test-task');

      // Mock task data
      await page.route('**/api/tasks/visual-test-task', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'visual-test-task',
            name: 'Visual Test Task',
            description: 'A task created for visual regression testing',
            status: 'RUNNING',
            priority: 'MEDIUM',
            type: 'CODE_GENERATION',
            swarm: 'Test Swarm',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T01:00:00Z',
            logs: [
              { timestamp: '2023-01-01T01:00:00Z', level: 'INFO', message: 'Task started' },
              { timestamp: '2023-01-01T01:30:00Z', level: 'INFO', message: 'Processing...' }
            ]
          })
        });
      });

      const taskDetail = page.locator('[data-testid="task-detail"]');
      await waitForElementStability(page, '[data-testid="task-detail"]');

      await takeConsistentScreenshot(page, taskDetail, 'task-detail', {
        customMask: createDynamicContentMask('task-status-dynamic', 'task-logs-live')
      });
    });
  });

  test.describe('Settings and Configuration Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication as admin
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'mock-admin-token');
        localStorage.setItem('user_data', JSON.stringify({
          id: 'test-admin',
          name: 'Test Admin',
          email: 'admin@example.com',
          role: 'admin'
        }));
      });
    });

    visualTest('profile settings page', async ({ page }) => {
      await page.goto('http://localhost:3000/settings/profile');

      const profileSettings = page.locator('[data-testid="profile-settings"]');
      await waitForElementStability(page, '[data-testid="profile-settings"]');

      await takeConsistentScreenshot(page, profileSettings, 'profile-settings', {
        customMask: createDynamicContentMask('user-avatar', 'user-stats')
      });
    });

    visualTest('application settings page', async ({ page }) => {
      await page.goto('http://localhost:3000/settings/application');

      const appSettings = page.locator('[data-testid="application-settings"]');
      await waitForElementStability(page, '[data-testid="application-settings"]');

      await takeConsistentScreenshot(page, appSettings, 'application-settings');
    });

    visualTest('theme customization', async ({ page }) => {
      await page.goto('http://localhost:3000/settings/themes');

      const themeSettings = page.locator('[data-testid="theme-settings"]');
      await takeConsistentScreenshot(page, themeSettings, 'theme-settings');

      // Test theme preview
      await page.click('[data-testid="theme-dark"]');
      await page.waitForTimeout(300);

      await takeConsistentScreenshot(page, themeSettings, 'theme-dark-preview');

      await page.click('[data-testid="theme-light"]');
      await page.waitForTimeout(300);

      await takeConsistentScreenshot(page, themeSettings, 'theme-light-preview');
    });
  });

  test.describe('Error and Empty States Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('user_data', JSON.stringify({
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com'
        }));
      });
    });

    visualTest('404 error page', async ({ page }) => {
      await page.goto('http://localhost:3000/nonexistent-page');

      const errorPage = page.locator('[data-testid="error-404"]');
      await waitForElementStability(page, '[data-testid="error-404"]');

      await takeConsistentScreenshot(page, errorPage, 'error-404-page');
    });

    visualTest('500 error page', async ({ page }) => {
      // Mock server error
      await page.route('**/api/dashboard', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });

      await page.goto('http://localhost:3000/dashboard');
      await page.waitForTimeout(1000);

      const errorPage = page.locator('[data-testid="error-500"]');
      if (await errorPage.isVisible()) {
        await takeConsistentScreenshot(page, errorPage, 'error-500-page');
      }
    });

    visualTest('empty swarms state', async ({ page }) => {
      // Mock empty swarms response
      await page.route('**/api/swarms', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ swarms: [], total: 0 })
        });
      });

      await page.goto('http://localhost:3000/swarms');
      await page.waitForTimeout(500);

      const emptyState = page.locator('[data-testid="empty-swarms"]');
      if (await emptyState.isVisible()) {
        await takeConsistentScreenshot(page, emptyState, 'empty-swarms-state');
      }
    });

    visualTest('empty tasks state', async ({ page }) => {
      // Mock empty tasks response
      await page.route('**/api/tasks', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ tasks: [], total: 0 })
        });
      });

      await page.goto('http://localhost:3000/tasks');
      await page.waitForTimeout(500);

      const emptyState = page.locator('[data-testid="empty-tasks"]');
      if (await emptyState.isVisible()) {
        await takeConsistentScreenshot(page, emptyState, 'empty-tasks-state');
      }
    });

    visualTest('network error state', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/**', (route) => route.abort());

      await page.goto('http://localhost:3000/dashboard');
      await page.waitForTimeout(2000);

      const networkError = page.locator('[data-testid="network-error"]');
      if (await networkError.isVisible()) {
        await takeConsistentScreenshot(page, networkError, 'network-error-state');
      }
    });
  });

  test.describe('Multi-Device Responsive Testing', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('user_data', JSON.stringify({
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com'
        }));
      });
    });

    visualTest('dashboard responsive - mobile', async ({ page }) => {
      await setupVisualTest(page, { viewport: VIEWPORTS.MOBILE });
      await page.goto('http://localhost:3000/dashboard');

      const dashboard = page.locator('[data-testid="dashboard-overview"]');
      await waitForElementStability(page, '[data-testid="dashboard-overview"]');

      await takeConsistentScreenshot(page, dashboard, 'dashboard-mobile', { viewport: VIEWPORTS.MOBILE });
    });

    visualTest('dashboard responsive - tablet', async ({ page }) => {
      await setupVisualTest(page, { viewport: VIEWPORTS.TABLET });
      await page.goto('http://localhost:3000/dashboard');

      const dashboard = page.locator('[data-testid="dashboard-overview"]');
      await waitForElementStability(page, '[data-testid="dashboard-overview"]');

      await takeConsistentScreenshot(page, dashboard, 'dashboard-tablet', { viewport: VIEWPORTS.TABLET });
    });

    visualTest('swarm detail responsive - mobile', async ({ page }) => {
      await setupVisualTest(page, { viewport: VIEWPORTS.MOBILE });
      await page.goto('http://localhost:3000/swarms/test-swarm');

      const swarmDetail = page.locator('[data-testid="swarm-detail"]');
      await waitForElementStability(page, '[data-testid="swarm-detail"]');

      await takeConsistentScreenshot(page, swarmDetail, 'swarm-detail-mobile', { viewport: VIEWPORTS.MOBILE });
    });

    visualTest('task creation responsive - mobile', async ({ page }) => {
      await setupVisualTest(page, { viewport: VIEWPORTS.MOBILE });
      await page.goto('http://localhost:3000/tasks/create');

      const taskForm = page.locator('[data-testid="task-creation-form"]');
      await waitForElementStability(page, '[data-testid="task-creation-form"]');

      await takeConsistentScreenshot(page, taskForm, 'task-creation-mobile', { viewport: VIEWPORTS.MOBILE });
    });
  });

  test.describe('Theme and Accessibility Testing', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'mock-token');
        localStorage.setItem('user_data', JSON.stringify({
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com'
        }));
      });
    });

    visualTest('dark mode - dashboard', async ({ page }) => {
      await setupVisualTest(page, { theme: 'dark' });
      await page.goto('http://localhost:3000/dashboard');

      const dashboard = page.locator('[data-testid="dashboard-overview"]');
      await waitForElementStability(page, '[data-testid="dashboard-overview"]');

      await takeConsistentScreenshot(page, dashboard, 'dashboard-dark-mode', { theme: 'dark' });
    });

    visualTest('dark mode - swarms list', async ({ page }) => {
      await setupVisualTest(page, { theme: 'dark' });
      await page.goto('http://localhost:3000/swarms');

      const swarmsList = page.locator('[data-testid="swarms-list"]');
      await waitForElementStability(page, '[data-testid="swarms-list"]');

      await takeConsistentScreenshot(page, swarmsList, 'swarms-list-dark-mode', { theme: 'dark' });
    });

    visualTest('high contrast mode', async ({ page }) => {
      await setupVisualTest(page);
      await page.goto('http://localhost:3000/dashboard');

      // Enable high contrast mode
      await addCustomStyles(page, {
        'body': 'filter: contrast(1.5) !important;',
        '*': 'text-shadow: none !important; box-shadow: none !important;'
      });

      const dashboard = page.locator('[data-testid="dashboard-overview"]');
      await waitForElementStability(page, '[data-testid="dashboard-overview"]');

      await takeConsistentScreenshot(page, dashboard, 'dashboard-high-contrast');
    });

    visualTest('reduced motion mode', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('http://localhost:3000/dashboard');

      const dashboard = page.locator('[data-testid="dashboard-overview"]');
      await waitForElementStability(page, '[data-testid="dashboard-overview"]');

      await takeConsistentScreenshot(page, dashboard, 'dashboard-reduced-motion');
    });
  });
});