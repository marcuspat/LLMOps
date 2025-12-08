/**
 * E2E tests for Collaborative Development Workflow
 * Tests complete workflow from code creation to deployment with verification
 */

import { test, expect } from '@playwright/test';

test.describe('Collaborative Development Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login to the application
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'developer@example.com');
    await page.fill('[data-testid="password"]', 'securepassword123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('complete pull request workflow with truth verification', async ({ page }) => {
    // 1. Navigate to project repository
    await page.click('[data-testid="projects-tab"]');
    await page.click('[data-testid="project-card"]:first-child');

    // 2. Create new feature branch
    await page.click('[data-testid="branches-tab"]');
    await page.click('[data-testid="new-branch-button"]');
    await page.fill('[data-testid="branch-name"]', 'feature/user-authentication');
    await page.selectOption('[data-testid="base-branch"]', 'main');
    await page.click('[data-testid="create-branch-button"]');
    await expect(page.locator('[data-testid="branch-name"]')).toContainText('feature/user-authentication');

    // 3. Create new authentication file
    await page.click('[data-testid="file-explorer"]');
    await page.click('[data-testid="new-file-button"]');
    await page.fill('[data-testid="file-name"]', 'src/auth/authenticator.ts');
    await page.click('[data-testid="create-file-button"]');

    // Add authentication code with proper TypeScript types
    const authCode = `
/**
 * Authentication service for user management
 * Implements secure authentication with JWT tokens
 */
import { jwt, bcrypt } from '../dependencies';
import { User, AuthCredentials, AuthResult } from '../types';

export class Authenticator {
  private static instance: Authenticator;
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly TOKEN_EXPIRY = '24h';

  private constructor() {}

  public static getInstance(): Authenticator {
    if (!Authenticator.instance) {
      Authenticator.instance = new Authenticator();
    }
    return Authenticator.instance;
  }

  /**
   * Authenticates user credentials
   * @param credentials User login credentials
   * @returns Authentication result with JWT token
   */
  public async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    // Validate input parameters
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    // Retrieve user from database
    const user = await this.getUserByEmail(credentials.email);
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Verify password hash
    const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      this.JWT_SECRET,
      { expiresIn: this.TOKEN_EXPIRY }
    );

    return {
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name }
    };
  }

  /**
   * Validates JWT token
   * @param token JWT token to validate
   * @returns Decoded token payload or null if invalid
   */
  public validateToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Refreshes authentication token
   * @param refreshToken Current valid token
   * @returns New authentication token
   */
  public async refreshToken(refreshToken: string): Promise<AuthResult> {
    const decoded = this.validateToken(refreshToken);
    if (!decoded) {
      return { success: false, error: 'Invalid token' };
    }

    const newToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      this.JWT_SECRET,
      { expiresIn: this.TOKEN_EXPIRY }
    );

    return { success: true, token: newToken };
  }

  private async getUserByEmail(email: string): Promise<any> {
    // Database lookup implementation
    return null; // Placeholder
  }
}
    `;

    await page.fill('[data-testid="code-editor"]', authCode);

    // 4. Verify code quality with truth verification
    await page.click('[data-testid="verify-button"]');
    await expect(page.locator('[data-testid="verification-status"]')).toBeVisible();

    // Wait for verification to complete
    await page.waitForSelector('[data-testid="verification-score"]');
    const score = await page.locator('[data-testid="verification-score"]').textContent();
    expect(parseFloat(score || '0')).toBeGreaterThanOrEqual(0.95);

    // Check for no critical issues
    const criticalIssues = page.locator('[data-testid="critical-issue"]');
    await expect(criticalIssues).toHaveCount(0);

    // 5. Commit changes
    await page.click('[data-testid="commit-button"]');
    await page.fill('[data-testid="commit-message"]', 'feat: Add authentication service with JWT support');
    await page.fill('[data-testid="commit-description"]', 'Implements secure authentication with:\n- JWT token generation and validation\n- Password hashing with bcrypt\n- Token refresh mechanism\n- Type-safe implementation');
    await page.click('[data-testid="confirm-commit"]');

    // 6. Create pull request
    await page.click('[data-testid="pull-request-button"]');
    await page.fill('[data-testid="pr-title"]', 'feat: Implement user authentication system');
    await page.fill('[data-testid="pr-description"]', `## Summary
Adds comprehensive authentication system to support user management.

## Changes
- Created authentication service with JWT support
- Implemented secure password hashing
- Added token validation and refresh
- Full TypeScript type safety

## Verification
✅ Code quality score: ${score}
✅ All tests passing
✅ Security scan passed
✅ No breaking changes`);

    // Add reviewers
    await page.click('[data-testid="reviewer-input"]');
    await page.fill('[data-testid="reviewer-input"]', 'code-reviewer');
    await page.keyboard.press('Enter');
    await page.click('[data-testid="create-pr-button"]');

    // 7. Verify PR status checks
    await page.waitForSelector('[data-testid="pr-status-checks"]');

    // Check all required status checks
    const statusChecks = [
      'turbo-flow/verification',
      'CI/CD Pipeline',
      'Security Scan',
      'Code Coverage'
    ];

    for (const check of statusChecks) {
      const checkElement = page.locator(`[data-testid="status-${check.toLowerCase().replace(/[^a-z0-9]/g, '-')}"]`);
      await expect(checkElement).toBeVisible();
      // Wait for check to complete (either success or failure)
      await expect(checkElement.locator('.status-icon')).toHaveClass(/success|failure/);
    }

    // 8. Wait for automated code review
    await page.waitForSelector('[data-testid="ai-review-summary"]', { timeout: 30000 });
    const reviewSummary = page.locator('[data-testid="ai-review-summary"]');
    await expect(reviewSummary).toContainText('Automated Review');

    // 9. Verify the PR can be merged
    const mergeButton = page.locator('[data-testid="merge-button"]');
    await expect(mergeButton).toBeEnabled();

    // 10. Merge the pull request
    await mergeButton.click();
    await page.selectOption('[data-testid="merge-method"]', 'squash');
    await page.click('[data-testid="confirm-merge"]');

    // Verify merge success
    await expect(page.locator('[data-testid="merge-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="branch-deleted"]')).toBeVisible();

    // 11. Verify deployment trigger
    await page.click('[data-testid="actions-tab"]');
    await expect(page.locator('[data-testid="deployment-workflow"]')).toBeVisible();
    await page.locator('[data-testid="deployment-workflow"]').click();

    // Wait for deployment to start
    await expect(page.locator('[data-testid="workflow-status"]')).toContainText('in_progress');
  });

  test('collaborative code editing with real-time synchronization', async ({ page, context }) => {
    // Create a new browser context for the second user
    const secondUserContext = await context.browser().newContext();
    const secondUserPage = await secondUserContext.newPage();

    // Login first user
    await page.goto('/dashboard');

    // Login second user
    await secondUserPage.goto('/login');
    await secondUserPage.fill('[data-testid="email"]', 'collaborator@example.com');
    await secondUserPage.fill('[data-testid="password"]', 'collabpass123');
    await secondUserPage.click('[data-testid="login-button"]');
    await secondUserPage.waitForURL('/dashboard');

    // Both users navigate to the same file
    const filePath = '/workspaces/llmops/src/utils/helpers.ts';
    await page.goto(filePath);
    await secondUserPage.goto(filePath);

    // Enable collaboration mode
    await Promise.all([
      page.click('[data-testid="collaborate-button"]'),
      secondUserPage.click('[data-testid="collaborate-button"]')
    ]);

    // Verify both users are visible
    await expect(page.locator('[data-testid="active-user-developer"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-user-collaborator"]')).toBeVisible();

    // First user starts typing
    await page.click('[data-testid="code-editor"]');
    await page.type('[data-testid="code-editor"]', '\n// Utility function for date formatting\n');

    // Verify changes appear in real-time for second user
    await expect(secondUserPage.locator('[data-testid="code-editor"]')).toContainText(
      'Utility function for date formatting',
      { timeout: 2000 }
    );

    // Second user adds code simultaneously
    const helperFunction = `
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
    `;

    await secondUserPage.type('[data-testid="code-editor"]', helperFunction);

    // Verify synchronization
    await expect(page.locator('[data-testid="code-editor"]')).toContainText('formatDate');
    await expect(page.locator('[data-testid="code-editor"]')).toContainText('toISOString()');

    // Test conflict resolution
    await page.locator('[data-testid="code-editor"]').fill('formatDate', { timeout: 5000 });
    await page.type('[data-testid="code-editor"]', '(');
    await secondUserPage.type('[data-testid="code-editor"]', 'LocalDate');

    // Verify no conflicts occur with operational transform
    await expect(page.locator('[data-testid="code-editor"]')).toContainText('formatDate(LocalDate)');
    await expect(secondUserPage.locator('[data-testid="code-editor"]')).toContainText('formatDate(LocalDate)');

    // Save changes
    await Promise.all([
      page.click('[data-testid="save-button"]'),
      secondUserPage.click('[data-testid="save-button"]')
    ]);

    // Verify file is saved with all changes
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved');
    await expect(secondUserPage.locator('[data-testid="save-status"]')).toContainText('Saved');

    // Cleanup
    await secondUserContext.close();
  });

  test('emergency rollback mechanism', async ({ page }) => {
    // Navigate to deployment history
    await page.click('[data-testid="deployments-tab"]');
    await page.click('[data-testid="deployment-history"]');

    // Find a recent deployment
    await page.click('[data-testid="deployment-item"]:first-child');

    // Trigger emergency rollback
    await page.click('[data-testid="emergency-rollback"]');

    // Verify confirmation dialog
    await expect(page.locator('[data-testid="rollback-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="rollback-warning"]')).toContainText(
      'This will immediately revert to the previous version'
    );

    // Confirm rollback
    await page.fill('[data-testid="rollback-reason"]', 'Critical bug discovered in production');
    await page.click('[data-testid="confirm-rollback"]');

    // Monitor rollback progress
    await expect(page.locator('[data-testid="rollback-progress"]')).toBeVisible();

    // Verify rollback completion
    await expect(page.locator('[data-testid="rollback-success"]')).toBeVisible({
      timeout: 60000 // Rollback might take time
    });

    // Verify system health after rollback
    await page.click('[data-testid="system-health"]');
    await expect(page.locator('[data-testid="health-status"]')).toHaveClass('healthy');
    await expect(page.locator('[data-testid="uptime-metric"]')).toContainText('99.9%');

    // Verify incident was logged
    await page.click('[data-testid="incidents-tab"]');
    await expect(page.locator('[data-testid="incident-item"]')).toContainText('Emergency Rollback');
    await expect(page.locator('[data-testid="incident-severity"]')).toContainText('HIGH');
  });

  test('performance optimization workflow', async ({ page }) => {
    // Navigate to performance monitoring
    await page.click('[data-testid="performance-tab"]');

    // Run performance benchmarks
    await page.click('[data-testid="run-benchmarks"]');
    await expect(page.locator('[data-testid="benchmark-progress"]')).toBeVisible();

    // Wait for benchmark results
    await page.waitForSelector('[data-testid="benchmark-results"]');

    // Check API response times
    const apiResponseTime = page.locator('[data-testid="api-response-time"]');
    await expect(apiResponseTime).toContainText('ms');
    const responseTimeValue = parseFloat(await apiResponseTime.textContent() || '0');
    expect(responseTimeValue).toBeLessThan(500); // Should be under 500ms

    // Check memory usage
    const memoryUsage = page.locator('[data-testid="memory-usage"]');
    const memoryValue = parseFloat(await memoryUsage.textContent() || '0');
    expect(memoryValue).toBeLessThan(80); // Should be under 80%

    // Identify bottlenecks
    await page.click('[data-testid="analyze-bottlenecks"]');
    await expect(page.locator('[data-testid="bottleneck-report"]')).toBeVisible();

    // Apply optimization suggestions
    const optimizations = await page.locator('[data-testid="optimization-suggestion"]').all();
    if (optimizations.length > 0) {
      await optimizations[0].click();
      await page.click('[data-testid="apply-optimization"]');
      await expect(page.locator('[data-testid="optimization-applied"]')).toBeVisible();
    }

    // Verify improvements
    await page.click('[data-testid="compare-performance"]');
    await expect(page.locator('[data-testid="performance-comparison"]')).toBeVisible();

    const improvementPercentage = page.locator('[data-testid="improvement-percentage"]');
    const improvementValue = parseFloat(await improvementPercentage.textContent() || '0');
    expect(improvementValue).toBeGreaterThan(0); // Should show improvement
  });

  test('security vulnerability detection and remediation', async ({ page }) => {
    // Navigate to security scanning
    await page.click('[data-testid="security-tab"]');

    // Run comprehensive security scan
    await page.click('[data-testid="run-security-scan"]');
    await expect(page.locator('[data-testid="scan-progress"]')).toBeVisible();

    // Wait for scan completion
    await page.waitForSelector('[data-testid="scan-results"]');

    // Check for vulnerabilities
    const vulnerabilities = await page.locator('[data-testid="vulnerability-item"]').all();

    if (vulnerabilities.length > 0) {
      // Analyze first vulnerability
      await vulnerabilities[0].click();

      // Verify vulnerability details
      await expect(page.locator('[data-testid="vulnerability-severity"]')).toBeVisible();
      await expect(page.locator('[data-testid="vulnerability-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="remediation-steps"]')).toBeVisible();

      // Apply automatic fix if available
      const autoFixButton = page.locator('[data-testid="auto-fix"]');
      if (await autoFixButton.isVisible()) {
        await autoFixButton.click();
        await expect(page.locator('[data-testid="fix-applied"]')).toBeVisible();
      } else {
        // Manual fix workflow
        await page.click('[data-testid="create-fix-branch"]');
        await page.fill('[data-testid="branch-name"]', 'fix/security-vulnerability');
        await page.click('[data-testid="create-branch"]');

        // Apply manual fix
        await page.click('[data-testid="affected-file"]');
        await page.click('[data-testid="code-editor"]');
        await page.type('[data-testid="code-editor"]', '// Security fix applied');

        // Commit fix
        await page.click('[data-testid="commit-fix"]');
        await page.fill('[data-testid="commit-message"]', 'fix: Resolve security vulnerability');
        await page.click('[data-testid="confirm-commit"]');

        // Create PR for fix
        await page.click('[data-testid="create-fix-pr"]');
        await expect(page.locator('[data-testid="pr-created"]')).toBeVisible();
      }
    }

    // Verify compliance status
    await page.click('[data-testid="compliance-report"]');
    await expect(page.locator('[data-testid="compliance-score"]')).toContainText('%');
    const complianceScore = parseFloat(
      (await page.locator('[data-testid="compliance-score"]').textContent() || '0').replace('%', '')
    );
    expect(complianceScore).toBeGreaterThanOrEqual(95); // Should meet compliance threshold
  });
});