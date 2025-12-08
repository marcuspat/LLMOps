import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Turbo Flow Complete User Workflows', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();

    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('PAGE ERROR:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.error('PAGE ERROR:', error);
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Authentication and Authorization Workflow', () => {
    test('should complete full login and authorization flow', async ({ page }) => {
      // Navigate to login page
      await page.goto('http://localhost:3000/login');
      await expect(page).toHaveTitle(/Turbo Flow - Login/);

      // Fill login form
      await page.fill('[data-testid="email-input"]', 'test@turboflow.com');
      await page.fill('[data-testid="password-input"]', 'securePassword123!');
      await page.click('[data-testid="login-button"]');

      // Verify successful login and redirect
      await expect(page).toHaveURL(/dashboard/);
      await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();

      // Verify user permissions are loaded
      await expect(page.locator('[data-testid="permissions-panel"]')).toContainText('developer');

      // Check for authorization tokens
      const authToken = await page.evaluate(() => {
        return localStorage.getItem('auth_token');
      });
      expect(authToken).toBeTruthy();
    });

    test('should handle login errors gracefully', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      // Try login with invalid credentials
      await page.fill('[data-testid="email-input"]', 'invalid@email.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');

      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');

      // Verify still on login page
      await expect(page).toHaveURL(/login/);
    });

    test('should handle session timeout and re-authentication', async ({ page }) => {
      await page.goto('http://localhost:3000/login');

      // Login successfully
      await page.fill('[data-testid="email-input"]', 'test@turboflow.com');
      await page.fill('[data-testid="password-input"]', 'securePassword123!');
      await page.click('[data-testid="login-button"]');

      // Wait for session to be established
      await expect(page).toHaveURL(/dashboard/);

      // Simulate session timeout by clearing storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Try to access protected page
      await page.goto('http://localhost:3000/projects');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
      await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    });
  });

  test.describe('Swarm Creation and Management Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid="email-input"]', 'test@turboflow.com');
      await page.fill('[data-testid="password-input"]', 'securePassword123!');
      await page.click('[data-testid="login-button"]');
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should create and configure a new swarm from scratch', async ({ page }) => {
      // Navigate to swarm creation
      await page.click('[data-testid="create-swarm-button"]');
      await expect(page).toHaveURL(/swarms\/create/);

      // Fill swarm configuration
      await page.fill('[data-testid="swarm-name"]', 'Test Development Swarm');
      await page.selectOption('[data-testid="swarm-topology"]', 'mesh');
      await page.fill('[data-testid="max-agents"]', '10');
      await page.check('[data-testid="enable-auto-scaling"]');

      // Add initial agents
      await page.click('[data-testid="add-agent-button"]');
      await page.selectOption('[data-testid="agent-type"]', 'coordinator');
      await page.fill('[data-testid="agent-name"]', 'Main Coordinator');
      await page.check('[data-testid="capability-coordination"]');
      await page.check('[data-testid="capability-management"]');
      await page.click('[data-testid="confirm-agent"]');

      await page.click('[data-testid="add-another-agent"]');
      await page.selectOption('[data-testid="agent-type"]', 'coder');
      await page.fill('[data-testid="agent-name"]', 'Primary Developer');
      await page.check('[data-testid="capability-coding"]');
      await page.check('[data-testid="capability-development"]');
      await page.click('[data-testid="confirm-agent"]');

      // Create swarm
      await page.click('[data-testid="create-swarm-final"]');
      await expect(page.locator('[data-testid="swarm-created-notification"]')).toBeVisible();

      // Verify swarm appears in list
      await page.goto('http://localhost:3000/swarms');
      await expect(page.locator('text=Test Development Swarm')).toBeVisible();
      await expect(page.locator('[data-testid="swarm-status"]')).toContainText('Active');
      await expect(page.locator('[data-testid="agent-count"]')).toContainText('2');
    });

    test('should scale swarm dynamically based on workload', async ({ page }) => {
      // Create initial swarm
      await page.goto('http://localhost:3000/swarms/create');
      await page.fill('[data-testid="swarm-name"]', 'Auto-Scaling Swarm');
      await page.selectOption('[data-testid="swarm-topology"]', 'adaptive');
      await page.fill('[data-testid="max-agents"]', '15');
      await page.check('[data-testid="enable-auto-scaling"]');
      await page.click('[data-testid="create-swarm-final"]');

      // Navigate to swarm management
      await page.goto('http://localhost:3000/swarms');
      await page.click('text=Auto-Scaling Swarm');
      await expect(page.locator('[data-testid="swarm-dashboard"]')).toBeVisible();

      // Add high workload to trigger scaling
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="add-task-button"]');
        await page.fill(`[data-testid="task-name-${i}"]`, `Processing Task ${i + 1}`);
        await page.selectOption(`[data-testid="task-type-${i}"]`, 'code_generation');
        await page.selectOption(`[data-testid="task-priority-${i}"]`, 'high');
        await page.click(`[data-testid="submit-task-${i}"]`);
      }

      // Monitor auto-scaling
      await expect(page.locator('[data-testid="scaling-indicator"]')).toBeVisible();
      await page.waitForTimeout(2000);

      // Verify agent count increased
      const agentCount = await page.locator('[data-testid="current-agent-count"]');
      const initialCount = await agentCount.textContent();
      expect(parseInt(initialCount || '0')).toBeGreaterThan(2);

      // Check scaling logs
      await page.click('[data-testid="scaling-logs-tab"]');
      await expect(page.locator('[data-testid="log-entry"]')).toContainText('Auto-scaling triggered');
    });

    test('should optimize swarm topology automatically', async ({ page }) => {
      // Create swarm with adaptive topology
      await page.goto('http://localhost:3000/swarms/create');
      await page.fill('[data-testid="swarm-name"]', 'Optimization Test Swarm');
      await page.selectOption('[data-testid="swarm-topology"]', 'adaptive');
      await page.fill('[data-testid="max-agents"]', '20');
      await page.click('[data-testid="create-swarm-final"]');

      // Navigate to optimization panel
      await page.goto('http://localhost:3000/swarms');
      await page.click('text=Optimization Test Swarm');
      await page.click('[data-testid="optimization-tab"]');

      // Monitor topology changes
      await page.click('[data-testid="start-optimization"]');

      // Should show optimization in progress
      await expect(page.locator('[data-testid="optimization-progress"]')).toBeVisible();

      // Wait for optimization to complete
      await page.waitForSelector('[data-testid="optimization-complete"]', { timeout: 10000 });

      // Verify optimization results
      await expect(page.locator('[data-testid="topology-change"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-improvement"]')).toContainText('%');

      // Check optimization metrics
      await expect(page.locator('[data-testid="before-metrics"]')).toBeVisible();
      await expect(page.locator('[data-testid="after-metrics"]')).toBeVisible();
      await expect(page.locator('[data-testid="improvement-summary"]')).toBeVisible();
    });
  });

  test.describe('Task Orchestration and Execution Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Login and setup basic swarm
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid="email-input"]', 'test@turboflow.com');
      await page.fill('[data-testid="password-input"]', 'securePassword123!');
      await page.click('[data-testid="login-button"]');

      // Create test swarm
      await page.goto('http://localhost:3000/swarms/create');
      await page.fill('[data-testid="swarm-name"]', 'Task Execution Swarm');
      await page.selectOption('[data-testid="swarm-topology"]', 'mesh');
      await page.click('[data-testid="create-swarm-final"]');
    });

    test('should submit and track complex multi-stage task', async ({ page }) => {
      // Navigate to task creation
      await page.goto('http://localhost:3000/tasks');
      await page.click('[data-testid="create-complex-task"]');

      // Configure multi-stage task
      await page.fill('[data-testid="task-name"]', 'API Feature Development');
      await page.fill('[data-testid="task-description"]', 'Develop complete REST API with authentication and validation');
      await page.selectOption('[data-testid="task-type"]', 'code_generation');
      await page.selectOption('[data-testid="task-priority"]', 'high');

      // Add task stages
      await page.click('[data-testid="add-stage-button"]');
      await page.fill('[data-testid="stage-1-name"]', 'API Design and Architecture');
      await page.selectOption('[data-testid="stage-1-type"]', 'analysis');
      await page.fill('[data-testid="stage-1-duration"]', '2');

      await page.click('[data-testid="add-another-stage"]');
      await page.fill('[data-testid="stage-2-name"]', 'Implementation');
      await page.selectOption('[data-testid="stage-2-type"]', 'development');
      await page.fill('[data-testid="stage-2-duration"]', '4');

      await page.click('[data-testid="add-final-stage"]');
      await page.fill('[data-testid="stage-3-name"]', 'Testing and Validation');
      await page.selectOption('[data-testid="stage-3-type"]', 'testing');
      await page.fill('[data-testid="stage-3-duration"]', '2');

      // Submit task
      await page.click('[data-testid="submit-complex-task"]');

      // Track task progress
      await expect(page.locator('[data-testid="task-submitted-notification"]')).toBeVisible();

      // Navigate to task tracking
      await page.goto('http://localhost:3000/tasks/active');
      await expect(page.locator('text=API Feature Development')).toBeVisible();

      // Monitor stage execution
      await page.click('[data-testid="expand-task-details"]');
      await expect(page.locator('[data-testid="stage-1"]')).toContainText('In Progress');

      // Wait for first stage to complete
      await page.waitForSelector('[data-testid="stage-1"].text(/Completed/)', { timeout: 30000 });

      // Verify agent assignments
      const assignedAgents = await page.locator('[data-testid="assigned-agents"]').textContent();
      expect(assignedAgents).toBeTruthy();

      // Monitor task metrics
      await page.click('[data-testid="task-metrics-tab"]');
      await expect(page.locator('[data-testid="execution-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="agent-utilization"]')).toBeVisible();
      await expect(page.locator('[data-testid="resource-usage"]')).toBeVisible();
    });

    test('should handle task dependencies and parallel execution', async ({ page }) => {
      // Create dependent tasks
      const taskIds: string[] = [];

      // Create prerequisite task
      await page.goto('http://localhost:3000/tasks/create');
      await page.fill('[data-testid="task-name"]', 'Database Schema Design');
      await page.selectOption('[data-testid="task-type"]', 'analysis');
      await page.click('[data-testid="submit-task"]');

      // Get task ID from URL or response
      const currentUrl = page.url();
      const taskId = currentUrl.split('/').pop() || 'unknown';
      taskIds.push(taskId);

      // Create dependent task
      await page.goto('http://localhost:3000/tasks/create');
      await page.fill('[data-testid="task-name"]', 'API Endpoint Implementation');
      await page.selectOption('[data-testid="task-type"]', 'code_generation');

      // Add dependency
      await page.click('[data-testid="add-dependency"]');
      await page.selectOption('[data-testid="dependency-select"]', taskId);
      await page.click('[data-testid="confirm-dependency"]');

      await page.click('[data-testid="submit-task"]');

      // Create parallel tasks
      await page.goto('http://localhost:3000/tasks/create-batch');
      await page.fill('[data-testid="batch-name"]', 'Parallel Testing Tasks');

      // Add multiple parallel tasks
      for (let i = 1; i <= 3; i++) {
        await page.click(`[data-testid="add-batch-task-${i}"]`);
        await page.fill(`[data-testid="batch-task-name-${i}"]`, `Unit Test Suite ${i}`);
        await page.selectOption(`[data-testid="batch-task-type-${i}"]`, 'testing');
        await page.selectOption(`[data-testid="batch-task-priority-${i}"]`, 'medium');
      }

      await page.click('[data-testid="submit-batch-tasks"]');

      // Monitor execution in task dashboard
      await page.goto('http://localhost:3000/tasks/dashboard');

      // Check dependency graph visualization
      await expect(page.locator('[data-testid="dependency-graph"]')).toBeVisible();

      // Verify parallel execution indicators
      await expect(page.locator('[data-testid="parallel-execution"]')).toBeVisible();

      // Monitor completion status
      await page.waitForTimeout(5000);
      const completedTasks = await page.locator('[data-testid="completed-tasks"]').textContent();
      const totalTasks = await page.locator('[data-testid="total-tasks"]').textContent();

      expect(parseInt(completedTasks || '0')).toBeGreaterThanOrEqual(0);
      expect(parseInt(totalTasks || '0')).toBeGreaterThan(0);
    });

    test('should handle task failure and recovery', async ({ page }) => {
      // Create task designed to fail
      await page.goto('http://localhost:3000/tasks/create');
      await page.fill('[data-testid="task-name"]', 'Test Failure Scenario');
      await page.selectOption('[data-testid="task-type"]', 'code_generation');
      await page.check('[data-testid="simulate-failure"]');
      await page.selectOption('[data-testid="failure-type"]', 'agent_timeout');
      await page.click('[data-testid="submit-task"]');

      // Monitor failure detection
      await page.goto('http://localhost:3000/tasks/monitoring');
      await expect(page.locator('[data-testid="failure-detected-alert"]')).toBeVisible();

      // Verify failure details
      await page.click('[data-testid="task-failure-details"]');
      await expect(page.locator('[data-testid="failure-reason"]')).toBeVisible();
      await expect(page.locator('[data-testid="failure-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="affected-agents"]')).toBeVisible();

      // Test recovery mechanisms
      await page.click('[data-testid="initiate-recovery"]');
      await expect(page.locator('[data-testid="recovery-in-progress"]')).toBeVisible();

      // Verify automatic retry
      await expect(page.locator('[data-testid="retry-attempt"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-count"]')).toContainText('1');

      // Wait for recovery to complete
      await page.waitForSelector('[data-testid="recovery-complete"]', { timeout: 15000 });

      // Verify task resumed
      await expect(page.locator('[data-testid="task-status"]')).toContainText('In Progress');
    });
  });

  test.describe('Truth Verification Integration Workflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid="email-input"]', 'test@turboflow.com');
      await page.fill('[data-testid="password-input"]', 'securePassword123!');
      await page.click('[data-testid="login-button"]');
    });

    test('should verify code with comprehensive truth checking', async ({ page }) => {
      // Navigate to verification interface
      await page.goto('http://localhost:3000/verification');
      await expect(page.locator('[data-testid="verification-dashboard"]')).toBeVisible();

      // Submit code for verification
      await page.click('[data-testid="verify-code-button"]');

      // Paste or type code
      await page.fill('[data-testid="code-input"]', `
        function processUserInput(input: string): string {
          if (!input || typeof input !== 'string') {
            throw new Error('Invalid input');
          }

          // Simple processing logic
          return input.trim().toLowerCase().replace(/[^a-z0-9\\s]/g, '');
        }
      `);

      // Configure verification settings
      await page.selectOption('[data-testid="verification-type"]', 'code_quality');
      await page.fill('[data-testid="threshold-input"]', '0.95');
      await page.check('[data-testid="enable-security-check"]');
      await page.check('[data-testid="enable-performance-check"]');

      // Submit for verification
      await page.click('[data-testid="run-verification"]');

      // Monitor verification progress
      await expect(page.locator('[data-testid="verification-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();

      // Wait for results
      await page.waitForSelector('[data-testid="verification-results"]', { timeout: 10000 });

      // Analyze verification results
      await expect(page.locator('[data-testid="verification-score"]')).toBeVisible();
      await expect(page.locator('[data-testid="verification-status"]')).toBeVisible();

      const score = await page.locator('[data-testid="verification-score"]').textContent();
      const scoreValue = parseFloat(score || '0');
      expect(scoreValue).toBeGreaterThanOrEqual(0);
      expect(scoreValue).toBeLessThanOrEqual(1);

      // Check issues and suggestions
      const issuesCount = await page.locator('[data-testid="issues-count"]').textContent();
      const suggestionsCount = await page.locator('[data-testid="suggestions-count"]').textContent();

      expect(parseInt(issuesCount || '0')).toBeGreaterThanOrEqual(0);
      expect(parseInt(suggestionsCount || '0')).toBeGreaterThanOrEqual(0);

      // Verify detailed breakdown
      await page.click('[data-testid="detailed-analysis-tab"]');
      await expect(page.locator('[data-testid="code-structure-analysis"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-safety-analysis"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-analysis"]')).toBeVisible();

      // Check metrics
      await expect(page.locator('[data-testid="complexity-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="maintainability-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="security-metric"]')).toBeVisible();
    });

    test('should handle verification failure and provide actionable feedback', async ({ page }) => {
      await page.goto('http://localhost:3000/verification');
      await page.click('[data-testid="verify-code-button"]');

      // Submit problematic code
      await page.fill('[data-testid="code-input"]', `
        function badFunction(x, y) {
          eval(x + y); // Security risk
          document.write(x); // XSS risk

          // Long function with poor structure
          let result = '';
          for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 100; j++) {
              if (i % 2 == 0) {
                if (j % 3 == 0) {
                  result += i * j + 123456789; // Magic number
                }
              }
            }
          }
          return result + 789012345; // Another magic number
        }
      `);

      await page.click('[data-testid="run-verification"]');
      await page.waitForSelector('[data-testid="verification-results"]', { timeout: 10000 });

      // Verify failure indication
      await expect(page.locator('[data-testid="verification-failed"]')).toBeVisible();
      await expect(page.locator('[data-testid="below-threshold"]')).toBeVisible();

      // Check critical issues
      await expect(page.locator('[data-testid="critical-issues"]')).toBeVisible();
      await expect(page.locator('[data-testid="security-violations"]')).toBeVisible();
      await expect(page.locator('[data-testid="code-smells"]')).toBeVisible();

      // Verify actionable feedback
      await expect(page.locator('[data-testid="improvement-suggestions"]')).toBeVisible();

      const suggestions = await page.locator('[data-testid="suggestion-list"]').allTextContents();
      expect(suggestions.length).toBeGreaterThan(0);

      // Should include specific suggestions for security issues
      await expect(page.locator('text=eval').first()).toBeVisible();
      await expect(page.locator('text=document.write').first()).toBeVisible();

      // Test improvement recommendations
      await page.click('[data-testid="auto-fix-tab"]');
      await expect(page.locator('[data-testid="auto-fix-suggestions"]')).toBeVisible();

      // Verify code improvement preview
      await page.click('[data-testid="show-improved-code"]');
      await expect(page.locator('[data-testid="improved-code-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
    });

    test('should support batch verification of multiple files', async ({ page }) => {
      await page.goto('http://localhost:3000/verification');
      await page.click('[data-testid="batch-verification-button"]');

      // Upload multiple files
      await page.setInputFiles('[data-testid="file-input"]', [
        'tests/fixtures/sample1.js',
        'tests/fixtures/sample2.ts',
        'tests/fixtures/sample3.js'
      ]);

      // Configure batch verification
      await page.selectOption('[data-testid="batch-verification-type"]', 'comprehensive');
      await page.check('[data-testid="parallel-processing"]');
      await page.fill('[data-testid="batch-threshold"]', '0.90');

      await page.click('[data-testid="run-batch-verification"]');

      // Monitor batch progress
      await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="files-processed"]')).toBeVisible();
      await expect(page.locator('[data-testid="files-remaining"]')).toBeVisible();

      await page.waitForSelector('[data-testid="batch-results"]', { timeout: 20000 });

      // Analyze batch results summary
      await expect(page.locator('[data-testid="batch-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-files"]')).toContainText('3');
      await expect(page.locator('[data-testid="passed-files"]')).toBeVisible();
      await expect(page.locator('[data-testid="failed-files"]')).toBeVisible();

      // Check detailed results for each file
      await expect(page.locator('[data-testid="file-results-table"]')).toBeVisible();
      const fileRows = await page.locator('[data-testid="file-result-row"]').count();
      expect(fileRows).toBe(3);

      // Verify aggregate metrics
      await expect(page.locator('[data-testid="batch-average-score"]')).toBeVisible();
      await expect(page.locator('[data-testid="batch-pass-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="batch-common-issues"]')).toBeVisible();

      // Test batch report generation
      await page.click('[data-testid="generate-batch-report"]');
      await page.selectOption('[data-testid="report-format"]', 'pdf');
      await page.click('[data-testid="download-report"]');

      // Verify report was generated
      await expect(page.locator('[data-testid="report-generated-notification"]')).toBeVisible();
    });
  });

  test.describe('Real-time Monitoring and Analytics Workflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid="email-input"]', 'test@turboflow.com');
      await page.fill('[data-testid="password-input"]', 'securePassword123!');
      await page.click('[data-testid="login-button"]');
    });

    test('should provide real-time swarm monitoring dashboard', async ({ page }) => {
      // Navigate to monitoring dashboard
      await page.goto('http://localhost:3000/monitoring');
      await expect(page.locator('[data-testid="monitoring-dashboard"]')).toBeVisible();

      // Check system overview metrics
      await expect(page.locator('[data-testid="total-swarms"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-agents"]')).toBeVisible();
      await expect(page.locator('[data-testid="running-tasks"]')).toBeVisible();
      await expect(page.locator('[data-testid="system-health"]')).toBeVisible();

      // Verify real-time charts
      await expect(page.locator('[data-testid="swarm-activity-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="agent-performance-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-completion-chart"]')).toBeVisible();

      // Check live updates
      await page.click('[data-testid="enable-live-updates"]');
      await expect(page.locator('[data-testid="live-update-indicator"]')).toBeVisible();

      // Monitor WebSocket connection status
      await expect(page.locator('[data-testid="websocket-status"]')).toContainText('Connected');

      // Test real-time notifications
      await expect(page.locator('[data-testid="notification-panel"]')).toBeVisible();

      // Create activity to test real-time updates
      await page.goto('http://localhost:3000/swarms/create');
      await page.fill('[data-testid="swarm-name"]', 'Monitoring Test Swarm');
      await page.click('[data-testid="create-swarm-final"]');

      // Return to monitoring and check for updates
      await page.goto('http://localhost:3000/monitoring');
      await page.waitForSelector('[data-testid="activity-feed"]', { timeout: 5000 });

      // Verify activity feed shows recent actions
      const activityItems = await page.locator('[data-testid="activity-item"]').count();
      expect(activityItems).toBeGreaterThan(0);
    });

    test('should display comprehensive performance analytics', async ({ page }) => {
      await page.goto('http://localhost:3000/analytics');
      await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();

      // Navigate to performance section
      await page.click('[data-testid="performance-analytics-tab"]');

      // Check performance metrics
      await expect(page.locator('[data-testid="cpu-usage-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="memory-usage-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="network-throughput-chart"]')).toBeVisible();

      // Verify time range controls
      await page.selectOption('[data-testid="time-range"]', 'last-24-hours');
      await page.click('[data-testid="apply-time-filter"]');

      // Check detailed metrics table
      await expect(page.locator('[data-testid="performance-metrics-table"]')).toBeVisible();
      const metricsRows = await page.locator('[data-testid="metric-row"]').count();
      expect(metricsRows).toBeGreaterThan(0);

      // Test performance alerts
      await page.click('[data-testid="performance-alerts-tab"]');
      await expect(page.locator('[data-testid="alerts-list"]')).toBeVisible();

      // Verify alert configuration
      await page.click('[data-testid="configure-alerts"]');
      await expect(page.locator('[data-testid="alert-thresholds"]')).toBeVisible();
      await page.fill('[data-testid="cpu-threshold"]', '80');
      await page.fill('[data-testid="memory-threshold"]', '90');
      await page.check('[data-testid="enable-email-alerts"]');
      await page.click('[data-testid="save-alert-config"]');

      await expect(page.locator('[data-testid="alert-config-saved"]')).toBeVisible();
    });

    test('should provide predictive insights and recommendations', async ({ page }) => {
      await page.goto('http://localhost:3000/analytics');
      await page.click('[data-testid="insights-tab"]');
      await expect(page.locator('[data-testid="insights-dashboard"]')).toBeVisible();

      // Check ML-powered insights
      await expect(page.locator('[data-testid="predictive-analysis"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-trends"]')).toBeVisible();
      await expect(page.locator('[data-testid="capacity-planning"]')).toBeVisible();

      // Test swarm optimization recommendations
      await page.click('[data-testid="swarm-optimization"]');
      await expect(page.locator('[data-testid="optimization-recommendations"]')).toBeVisible();

      const recommendations = await page.locator('[data-testid="recommendation-card"]').count();
      expect(recommendations).toBeGreaterThan(0);

      // Verify detailed recommendation analysis
      await page.click('[data-testid="recommendation-0"]');
      await expect(page.locator('[data-testid="recommendation-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="expected-impact"]')).toBeVisible();
      await expect(page.locator('[data-testid="implementation-steps"]')).toBeVisible();

      // Test cost optimization insights
      await page.click('[data-testid="cost-optimization"]');
      await expect(page.locator('[data-testid="resource-efficiency"]')).toBeVisible();
      await expect(page.locator('[data-testid="cost-savings-estimate"]')).toBeVisible();

      // Check automation opportunities
      await page.click('[data-testid="automation-opportunities"]');
      await expect(page.locator('[data-testid="automatable-tasks"]')).toBeVisible();
      await expect(page.locator('[data-testid="time-savings-potential"]')).toBeVisible();
    });
  });

  test.describe('GitHub Integration Workflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:3000/login');
      await page.fill('[data-testid="email-input"]', 'test@turboflow.com');
      await page.fill('[data-testid="password-input"]', 'securePassword123!');
      await page.click('[data-testid="login-button"]');
    });

    test('should integrate GitHub repository and manage PRs', async ({ page }) => {
      // Navigate to GitHub integration
      await page.goto('http://localhost:3000/github');
      await expect(page.locator('[data-testid="github-dashboard"]')).toBeVisible();

      // Connect repository
      await page.click('[data-testid="connect-repository"]');
      await page.fill('[data-testid="repo-owner"]', 'turbo-flow');
      await page.fill('[data-testid="repo-name"]', 'example-repo');
      await page.click('[data-testid="authorize-github"]');

      // Handle GitHub authorization (mock)
      await page.waitForSelector('[data-testid="github-auth-modal"]');
      await page.fill('[data-testid="github-username"]', 'test-user');
      await page.fill('[data-testid="github-token"]', 'ghp_test_token');
      await page.click('[data-testid="authorize-github-submit"]');

      // Verify repository connection
      await expect(page.locator('[data-testid="repo-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="repo-info"]')).toContainText('turbo-flow/example-repo');

      // Setup webhooks
      await page.click('[data-testid="setup-webhooks"]');
      await expect(page.locator('[data-testid="webhook-events"]')).toBeVisible();
      await page.check('[data-testid="push-events"]');
      await page.check('[data-testid="pull-request-events"]');
      await page.check('[data-testid="issue-events"]');
      await page.click('[data-testid="create-webhooks"]');

      // Test PR automation
      await page.click('[data-testid="pr-automation-tab"]');
      await expect(page.locator('[data-testid="pr-workflows"]')).toBeVisible();

      // Configure automatic code review
      await page.click('[data-testid="configure-code-review"]');
      await page.check('[data-testid="enable-verification"]');
      await page.check('[data-testid="enable-security-scan"]');
      await page.check('[data-testid="enable-performance-check"]');
      await page.fill('[data-testid="approval-threshold"]', '0.9');
      await page.click('[data-testid="save-pr-config"]');

      // Verify workflow activation
      await expect(page.locator('[data-testid="pr-workflow-active"]')).toBeVisible();
    });

    test('should handle GitHub webhook processing', async ({ page }) => {
      await page.goto('http://localhost:3000/github');
      await page.click('[data-testid="webhook-logs-tab"]');

      // Simulate webhook payload
      await page.click('[data-testid="simulate-webhook"]');
      await page.selectOption('[data-testid="webhook-event"]', 'pull_request');
      await page.selectOption('[data-testid="webhook-action"]', 'opened');

      // Test webhook processing
      await page.click('[data-testid="process-webhook"]');

      // Monitor webhook processing
      await expect(page.locator('[data-testid="webhook-processing"]')).toBeVisible();
      await page.waitForSelector('[data-testid="webhook-processed"]', { timeout: 10000 });

      // Verify webhook log
      await expect(page.locator('[data-testid="webhook-log-entry"]')).toBeVisible();
      await expect(page.locator('[data-testid="webhook-status"]')).toContainText('processed');
      await expect(page.locator('[data-testid="processing-time"]')).toBeVisible();

      // Check webhook payload details
      await page.click('[data-testid="webhook-details"]');

      await expect(page.locator('[data-testid="payload-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="headers-preview"]')).toBeVisible();

      // Verify PR analysis results
      await expect(page.locator('[data-testid="pr-analysis-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="verification-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="security-scan-results"]')).toBeVisible();
    });

    test('should manage repository branches and deployments', async ({ page }) => {
      await page.goto('http://localhost:3000/github');
      await page.click('[data-testid="repository-management-tab"]');

      // Check branch management
      await expect(page.locator('[data-testid="branch-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="default-branch"]')).toContainText('main');

      // Test branch protection rules
      await page.click('[data-testid="branch-protection"]');
      await expect(page.locator('[data-testid="protection-rules"]')).toBeVisible();

      await page.check('[data-testid="require-pr-reviews"]');
      await page.check('[data-testid="require-status-checks"]');
      await page.check('[data-testid="require-up-to-date"]');
      await page.fill('[data-testid="min-reviewers"]', '2');
      await page.click('[data-testid="save-protection-rules"]');

      // Configure deployment workflows
      await page.click('[data-testid="deployment-workflows"]');
      await expect(page.locator('[data-testid="workflow-list"]')).toBeVisible();

      // Create deployment workflow
      await page.click('[data-testid="create-workflow"]');
      await page.fill('[data-testid="workflow-name"]', 'CI/CD Pipeline');
      await page.selectOption('[data-testid="workflow-trigger"]', 'push');
      await page.check('[data-testid="build-stage"]');
      await page.check('[data-testid="test-stage"]');
      await page.click('[data-testid="save-workflow"]');

      // Verify workflow creation
      await expect(page.locator('[data-testid="workflow-success"]')).toBeVisible();
    });
  });
});