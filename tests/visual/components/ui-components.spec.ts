import { test, expect } from '@playwright/test';
import { VisualRegressionConfig } from '../utils/visual-config.js';
import { screenshotPath, getScreenshotOptions } from '../utils/helpers.js';

const config = new VisualRegressionConfig();

test.describe('UI Components Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for visual tests
    await page.setViewportSize({ width: 1280, height: 720 });

    // Wait for page to be fully loaded
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Header Component', () => {
    test('header renders correctly with navigation', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // Take full header screenshot
      const header = page.locator('header');
      await expect(header).toBeVisible();

      await expect(header).toMatchScreenshot(getScreenshotOptions('header-navigation'));
    });

    test('header responsive design - mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile viewport
      await page.goto('http://localhost:3000');

      const header = page.locator('header');
      await expect(header).toBeVisible();

      await expect(header).toMatchScreenshot(getScreenshotOptions('header-mobile'));
    });

    test('header responsive design - tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // Tablet viewport
      await page.goto('http://localhost:3000');

      const header = page.locator('header');
      await expect(header).toBeVisible();

      await expect(header).toMatchScreenshot(getScreenshotOptions('header-tablet'));
    });

    test('header with user menu dropdown', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.waitForSelector('[data-testid="user-menu"]');

      // Click to open dropdown
      await page.click('[data-testid="user-menu"]');
      await page.waitForTimeout(300); // Wait for animation

      const headerWithDropdown = page.locator('header');
      await expect(headerWithDropdown).toMatchScreenshot(getScreenshotOptions('header-user-dropdown'));
    });
  });

  test.describe('Swarm Management Components', () => {
    test('swarm card component', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms');
      await page.waitForSelector('[data-testid="swarm-card"]');

      const firstSwarmCard = page.locator('[data-testid="swarm-card"]').first();
      await expect(firstSwarmCard).toBeVisible();

      await expect(firstSwarmCard).toMatchScreenshot(getScreenshotOptions('swarm-card'));
    });

    test('swarm creation form', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/create');
      await page.waitForSelector('[data-testid="swarm-creation-form"]');

      const form = page.locator('[data-testid="swarm-creation-form"]');
      await expect(form).toBeVisible();

      await expect(form).toMatchScreenshot(getScreenshotOptions('swarm-creation-form'));
    });

    test('swarm status indicators', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms');
      await page.waitForSelector('[data-testid="swarm-status"]');

      const statusIndicators = page.locator('[data-testid="swarm-status"]').first();
      await expect(statusIndicators).toBeVisible();

      await expect(statusIndicators).toMatchScreenshot(getScreenshotOptions('swarm-status-indicators'));
    });

    test('agent list component', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/test-swarm');
      await page.waitForSelector('[data-testid="agent-list"]');

      const agentList = page.locator('[data-testid="agent-list"]');
      await expect(agentList).toBeVisible();

      await expect(agentList).toMatchScreenshot(getScreenshotOptions('agent-list'));
    });

    test('task queue visualization', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/test-swarm/tasks');
      await page.waitForSelector('[data-testid="task-queue"]');

      const taskQueue = page.locator('[data-testid="task-queue"]');
      await expect(taskQueue).toBeVisible();

      await expect(taskQueue).toMatchScreenshot(getScreenshotOptions('task-queue'));
    });
  });

  test.describe('Dashboard Components', () => {
    test('dashboard overview', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForSelector('[data-testid="dashboard-overview"]');

      const dashboard = page.locator('[data-testid="dashboard-overview"]');
      await expect(dashboard).toBeVisible();

      await expect(dashboard).toMatchScreenshot(getScreenshotOptions('dashboard-overview'));
    });

    test('metrics cards', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForSelector('[data-testid="metrics-card"]');

      const metricsCards = page.locator('[data-testid="metrics-card"]').first();
      await expect(metricsCards).toBeVisible();

      await expect(metricsCards).toMatchScreenshot(getScreenshotOptions('metrics-card'));
    });

    test('charts and graphs', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForSelector('[data-testid="performance-chart"]');

      const chart = page.locator('[data-testid="performance-chart"]');
      await expect(chart).toBeVisible();

      await expect(chart).toMatchScreenshot(getScreenshotOptions('performance-chart'));
    });

    test('activity feed', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForSelector('[data-testid="activity-feed"]');

      const activityFeed = page.locator('[data-testid="activity-feed"]');
      await expect(activityFeed).toBeVisible();

      await expect(activityFeed).toMatchScreenshot(getScreenshotOptions('activity-feed'));
    });
  });

  test.describe('Task Management Components', () => {
    test('task creation form', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/create');
      await page.waitForSelector('[data-testid="task-creation-form"]');

      const form = page.locator('[data-testid="task-creation-form"]');
      await expect(form).toBeVisible();

      await expect(form).toMatchScreenshot(getScreenshotOptions('task-creation-form'));
    });

    test('task list view', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks');
      await page.waitForSelector('[data-testid="task-list"]');

      const taskList = page.locator('[data-testid="task-list"]');
      await expect(taskList).toBeVisible();

      await expect(taskList).toMatchScreenshot(getScreenshotOptions('task-list'));
    });

    test('task status badges', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks');
      await page.waitForSelector('[data-testid="task-status-badge"]');

      const statusBadges = page.locator('[data-testid="task-status-badge"]').first();
      await expect(statusBadges).toBeVisible();

      await expect(statusBadges).toMatchScreenshot(getScreenshotOptions('task-status-badge'));
    });

    test('task priority indicators', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks');
      await page.waitForSelector('[data-testid="task-priority"]');

      const priorityIndicators = page.locator('[data-testid="task-priority"]').first();
      await expect(priorityIndicators).toBeVisible();

      await expect(priorityIndicators).toMatchScreenshot(getScreenshotOptions('task-priority'));
    });
  });

  test.describe('Form Components', () => {
    test('input fields and validation', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/create');
      await page.waitForSelector('[data-testid="form-input"]');

      const formInput = page.locator('[data-testid="form-input"]').first();
      await expect(formInput).toBeVisible();

      await expect(formInput).toMatchScreenshot(getScreenshotOptions('form-input'));

      // Test with validation state
      await formInput.fill('');
      await formInput.blur();
      await page.waitForTimeout(300);

      await expect(formInput).toMatchScreenshot(getScreenshotOptions('form-input-validation'));
    });

    test('dropdown selects', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/create');
      await page.waitForSelector('[data-testid="form-select"]');

      const formSelect = page.locator('[data-testid="form-select"]').first();
      await expect(formSelect).toBeVisible();

      // Test closed state
      await expect(formSelect).toMatchScreenshot(getScreenshotOptions('form-select-closed'));

      // Test open state
      await formSelect.click();
      await page.waitForTimeout(300);

      await expect(formSelect).toMatchScreenshot(getScreenshotOptions('form-select-open'));
    });

    test('text areas', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/create');
      await page.waitForSelector('[data-testid="form-textarea"]');

      const formTextarea = page.locator('[data-testid="form-textarea"]').first();
      await expect(formTextarea).toBeVisible();

      await expect(formTextarea).toMatchScreenshot(getScreenshotOptions('form-textarea'));
    });

    test('checkboxes and radio buttons', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/create');
      await page.waitForSelector('[data-testid="form-checkbox"]');

      const formCheckbox = page.locator('[data-testid="form-checkbox"]').first();
      await expect(formCheckbox).toBeVisible();

      await expect(formCheckbox).toMatchScreenshot(getScreenshotOptions('form-checkbox'));

      // Test radio buttons
      const formRadio = page.locator('[data-testid="form-radio"]').first();
      if (await formRadio.isVisible()) {
        await expect(formRadio).toMatchScreenshot(getScreenshotOptions('form-radio'));
      }
    });
  });

  test.describe('Modal and Dialog Components', () => {
    test('confirmation modal', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms');
      await page.waitForSelector('[data-testid="delete-button"]');

      // Trigger modal
      await page.click('[data-testid="delete-button"]');
      await page.waitForSelector('[data-testid="confirmation-modal"]');

      const modal = page.locator('[data-testid="confirmation-modal"]');
      await expect(modal).toBeVisible();

      await expect(modal).toMatchScreenshot(getScreenshotOptions('confirmation-modal'));
    });

    test('task detail modal', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks');
      await page.waitForSelector('[data-testid="task-item"]');

      // Open task detail modal
      await page.click('[data-testid="task-item"]');
      await page.waitForSelector('[data-testid="task-detail-modal"]');

      const modal = page.locator('[data-testid="task-detail-modal"]');
      await expect(modal).toBeVisible();

      await expect(modal).toMatchScreenshot(getScreenshotOptions('task-detail-modal'));
    });

    test('settings modal', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForSelector('[data-testid="settings-button"]');

      // Open settings modal
      await page.click('[data-testid="settings-button"]');
      await page.waitForSelector('[data-testid="settings-modal"]');

      const modal = page.locator('[data-testid="settings-modal"]');
      await expect(modal).toBeVisible();

      await expect(modal).toMatchScreenshot(getScreenshotOptions('settings-modal'));
    });
  });

  test.describe('Interactive Components', () => {
    test('buttons in different states', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/create');
      await page.waitForSelector('[data-testid="primary-button"]');

      const buttons = page.locator('[data-testid="primary-button"]');
      await expect(buttons.first()).toBeVisible();

      // Test normal state
      await expect(buttons.first()).toMatchScreenshot(getScreenshotOptions('button-primary-normal'));

      // Test hover state
      await buttons.first().hover();
      await page.waitForTimeout(200);

      await expect(buttons.first()).toMatchScreenshot(getScreenshotOptions('button-primary-hover'));

      // Test disabled state if available
      const disabledButton = page.locator('[data-testid="disabled-button"]');
      if (await disabledButton.isVisible()) {
        await expect(disabledButton).toMatchScreenshot(getScreenshotOptions('button-disabled'));
      }
    });

    test('tabs navigation', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/test-swarm');
      await page.waitForSelector('[data-testid="tabs-container"]');

      const tabs = page.locator('[data-testid="tabs-container"]');
      await expect(tabs).toBeVisible();

      await expect(tabs).toMatchScreenshot(getScreenshotOptions('tabs-navigation'));

      // Test active tab
      await tabs.locator('[data-testid="tab"]:nth-child(2)').click();
      await page.waitForTimeout(300);

      await expect(tabs).toMatchScreenshot(getScreenshotOptions('tabs-active-tab'));
    });

    test('tooltips and popovers', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForSelector('[data-testid="tooltip-trigger"]');

      const tooltipTrigger = page.locator('[data-testid="tooltip-trigger"]').first();
      await expect(tooltipTrigger).toBeVisible();

      // Hover to show tooltip
      await tooltipTrigger.hover();
      await page.waitForTimeout(500);

      const tooltip = page.locator('[data-testid="tooltip"]').first();
      if (await tooltip.isVisible()) {
        await expect(tooltip).toMatchScreenshot(getScreenshotOptions('tooltip'));
      }
    });

    test('progress bars and loaders', async ({ page }) => {
      await page.goto('http://localhost:3000/swarms/test-swarm');
      await page.waitForSelector('[data-testid="progress-bar"]');

      const progressBar = page.locator('[data-testid="progress-bar"]').first();
      if (await progressBar.isVisible()) {
        await expect(progressBar).toMatchScreenshot(getScreenshotOptions('progress-bar'));
      }

      // Test loader/spinner
      const loader = page.locator('[data-testid="loader"]').first();
      if (await loader.isVisible()) {
        await expect(loader).toMatchScreenshot(getScreenshotOptions('loader'));
      }
    });
  });

  test.describe('Table Components', () => {
    test('data table with sorting', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks');
      await page.waitForSelector('[data-testid="data-table"]');

      const dataTable = page.locator('[data-testid="data-table"]');
      await expect(dataTable).toBeVisible();

      await expect(dataTable).toMatchScreenshot(getScreenshotOptions('data-table'));
    });

    test('table with pagination', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks');
      await page.waitForSelector('[data-testid="pagination"]');

      const pagination = page.locator('[data-testid="pagination"]').first();
      if (await pagination.isVisible()) {
        await expect(pagination).toMatchScreenshot(getScreenshotOptions('pagination'));
      }
    });

    test('table with filters', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks');
      await page.waitForSelector('[data-testid="table-filters"]');

      const filters = page.locator('[data-testid="table-filters"]').first();
      if (await filters.isVisible()) {
        await expect(filters).toMatchScreenshot(getScreenshotOptions('table-filters'));
      }
    });
  });

  test.describe('Dark Mode Visual Testing', () => {
    test('header in dark mode', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // Enable dark mode
      await page.click('[data-testid="theme-toggle"]');
      await page.waitForTimeout(500);

      const header = page.locator('header');
      await expect(header).toBeVisible();

      await expect(header).toMatchScreenshot(getScreenshotOptions('header-dark-mode'));
    });

    test('dashboard in dark mode', async ({ page }) => {
      await page.goto('http://localhost:3000/dashboard');

      // Enable dark mode
      await page.click('[data-testid="theme-toggle"]');
      await page.waitForTimeout(500);

      const dashboard = page.locator('[data-testid="dashboard-overview"]');
      await expect(dashboard).toBeVisible();

      await expect(dashboard).toMatchScreenshot(getScreenshotOptions('dashboard-dark-mode'));
    });

    test('forms in dark mode', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks/create');

      // Enable dark mode
      await page.click('[data-testid="theme-toggle"]');
      await page.waitForTimeout(500);

      const form = page.locator('[data-testid="task-creation-form"]');
      await expect(form).toBeVisible();

      await expect(form).toMatchScreenshot(getScreenshotOptions('form-dark-mode'));
    });
  });

  test.describe('Accessibility Visual Testing', () => {
    test('high contrast mode', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // Enable high contrast mode
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addStyleTag({ content: 'body { filter: contrast(1.5); }' });

      const header = page.locator('header');
      await expect(header).toBeVisible();

      await expect(header).toMatchScreenshot(getScreenshotOptions('header-high-contrast'));
    });

    test('focus states', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.waitForSelector('[data-testid="focusable-element"]');

      const focusableElement = page.locator('[data-testid="focusable-element"]').first();
      await focusableElement.focus();

      await expect(focusableElement).toMatchScreenshot(getScreenshotOptions('focus-state'));
    });
  });

  test.describe('Error States Visual Testing', () => {
    test('empty state components', async ({ page }) => {
      await page.goto('http://localhost:3000/tasks?filter=nonexistent');
      await page.waitForSelector('[data-testid="empty-state"]');

      const emptyState = page.locator('[data-testid="empty-state"]');
      if (await emptyState.isVisible()) {
        await expect(emptyState).toMatchScreenshot(getScreenshotOptions('empty-state'));
      }
    });

    test('error message components', async ({ page }) => {
      await page.goto('http://localhost:3000/error-test');
      await page.waitForSelector('[data-testid="error-message"]');

      const errorMessage = page.locator('[data-testid="error-message"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toMatchScreenshot(getScreenshotOptions('error-message'));
      }
    });

    test('network error states', async ({ page }) => {
      // Simulate network error
      await page.route('**/api/**', route => route.abort());

      await page.goto('http://localhost:3000/dashboard');
      await page.waitForTimeout(2000); // Wait for error to appear

      const networkError = page.locator('[data-testid="network-error"]');
      if (await networkError.isVisible()) {
        await expect(networkError).toMatchScreenshot(getScreenshotOptions('network-error'));
      }

      // Clean up routes
      await page.unroute('**/api/**');
    });
  });
});