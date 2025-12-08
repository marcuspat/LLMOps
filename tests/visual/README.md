# Visual Regression Testing Framework

This directory contains comprehensive visual regression testing for Turbo Flow with Claude-Flow Integration using Playwright.

## 🎯 Overview

The visual regression testing framework ensures UI consistency and prevents unintended visual changes by:
- Comparing screenshots against baseline images
- Testing across multiple browsers and devices
- Supporting responsive design validation
- Providing detailed failure analysis and reporting

## 📁 Directory Structure

```
tests/visual/
├── components/              # UI component visual tests
│   └── ui-components.spec.ts
├── pages/                   # Complete page flow tests
│   └── complete-page-flows.spec.ts
├── utils/                   # Helper utilities and configuration
│   ├── visual-config.ts
│   ├── helpers.ts
│   └── report-generator.ts
├── screenshots/             # Generated screenshots
├── diff/                    # Visual comparison diffs
├── baseline/                # Baseline reference images
├── reports/                 # Test reports and HTML output
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

1. Ensure Playwright is installed:
```bash
npm run playwright:install
```

2. Start the application:
```bash
npm run dev
```

### Running Visual Tests

#### Run All Visual Tests
```bash
npm run test:visual
```

#### Run Component Tests Only
```bash
npm run test:visual:components
```

#### Run Page Flow Tests Only
```bash
npm run test:visual:pages
```

#### Cross-Browser Testing
```bash
npm run test:visual:cross-browser
```

#### Responsive Design Testing
```bash
npm run test:visual:responsive
```

#### Dark Mode Testing
```bash
npm run test:visual:dark-mode
```

#### Accessibility Testing
```bash
npm run test:visual:accessibility
```

## 🖥️ Supported Browsers and Devices

### Desktop Browsers
- **Chrome** (Chromium) - Primary browser for visual testing
- **Firefox** - Cross-browser compatibility
- **Safari** (WebKit) - Safari browser testing

### Mobile Devices
- **iPhone 13** - iOS mobile testing
- **iPhone 13 Pro** - High-resolution mobile testing

### Tablet Devices
- **iPad Pro** - Tablet responsive testing

## ⚙️ Configuration

### Visual Test Configuration (`utils/visual-config.ts`)

The framework uses a centralized configuration system:

```typescript
import { VisualRegressionConfig } from './utils/visual-config.js';

const config = new VisualRegressionConfig();

// Configure thresholds
config.updateConfig({
  thresholds: {
    pixels: 1000,        // Maximum different pixels
    percentage: 0.01,    // 1% difference threshold
    colorChannel: 10,     // Color difference threshold
  },
  enableDebugMode: process.env.NODE_ENV === 'development',
});
```

### Playwright Configuration (`playwright.visual.config.ts`)

Key features:
- **Custom Screenshot Settings**: Optimized for visual testing
- **Multi-browser Support**: Cross-browser testing
- **Responsive Viewports**: Multiple device testing
- **Dark Mode Support**: Theme testing capabilities
- **Accessibility Testing**: High contrast and reduced motion

### Screenshot Comparison Settings

```typescript
toHaveScreenshot: {
  mode: 'auto',              // Auto-generate baseline
  animations: 'disabled',      // Disable animations
  caret: 'hide',               // Hide text cursor
  scale: 'css',                // CSS-based scaling
  threshold: 0.2,              // 20% difference threshold
  maxDiffPixels: 1000,         // Max different pixels
  maxDiffPixelRatio: 0.02,    // Max pixel difference ratio
}
```

## 📊 Test Types

### 1. Component Visual Tests

Tests individual UI components in isolation:

```typescript
test('button component renders correctly', async ({ page }) => {
  const button = page.locator('[data-testid="primary-button"]');
  await expect(button).toBeVisible();
  await expect(button).toMatchScreenshot(getScreenshotOptions('primary-button'));
});
```

### 2. Page Flow Tests

Tests complete user workflows and page layouts:

```typescript
test('dashboard page renders correctly', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const dashboard = page.locator('[data-testid="dashboard-overview"]');
  await expect(dashboard).toMatchScreenshot(getScreenshotOptions('dashboard-overview'));
});
```

### 3. Responsive Tests

Tests UI across different screen sizes:

```typescript
test('dashboard responsive design', async ({ page }) => {
  const viewports = [
    { width: 375, height: 667 },  // Mobile
    { width: 768, height: 1024 }, // Tablet
    { width: 1280, height: 720 }, // Desktop
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.reload();
    await takeResponsiveScreenshot(page, `dashboard-${viewport.width}x${viewport.height}`);
  }
});
```

## 🛠️ Advanced Features

### Dynamic Content Masking

Hide dynamic content that shouldn't be part of visual tests:

```typescript
await expect(header).toMatchScreenshot(getScreenshotOptions('header', {
  customMask: createDynamicContentMask(
    'notification-badge',
    'time-display',
    'user-avatar'
  ),
}));
```

### Mock Data for Consistency

Ensure consistent test data across runs:

```typescript
await mockDynamicData(page);
await hideDynamicContent(page);
```

### Theme Testing

Test both light and dark themes:

```typescript
// Light mode
await page.goto('/dashboard');
await expect(dashboard).toMatchScreenshot(getScreenshotOptions('dashboard-light'));

// Dark mode
await page.emulateMedia({ colorScheme: 'dark' });
await expect(dashboard).toMatchScreenshot(getScreenshotOptions('dashboard-dark'));
```

### Accessibility Testing

Test high contrast and reduced motion:

```typescript
await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
await expect(page).toMatchScreenshot(getScreenshotOptions('high-contrast'));
```

## 📈 Reports and Analysis

### HTML Reports

Comprehensive HTML reports with:
- Test results overview
- Screenshot comparisons
- Visual diff analysis
- Performance metrics
- Recommendations

Access reports at: `tests/visual/reports/index.html`

### JSON Reports

Machine-readable results for automation:
```json
{
  "suites": [...],
  "stats": {...},
  "duration": 12345
}
```

### Screenshot Analysis

Automated analysis of:
- Total screenshots taken
- File sizes and types
- Differences from baseline
- Failed vs. successful comparisons

## 🔧 Customization

### Adding New Visual Tests

1. **Component Test Example**:
```typescript
import { test, expect } from '@playwright/test';
import { setupVisualTest, takeConsistentScreenshot } from '../utils/helpers.js';

test('my component visual test', async ({ page }) => {
  await setupVisualTest(page);

  const component = page.locator('[data-testid="my-component"]');
  await expect(component).toBeVisible();

  await takeConsistentScreenshot(page, component, 'my-component-test');
});
```

2. **Multi-Viewport Test**:
```typescript
test('my component responsive', async ({ page }) => {
  const viewports = [
    { width: 375, height: 667, name: 'mobile' },
    { width: 1280, height: 720, name: 'desktop' },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await setupVisualTest(page, { viewport });

    const component = page.locator('[data-testid="my-component"]');
    await takeConsistentScreenshot(
      page,
      component,
      `my-component-${viewport.name}`,
      { viewport }
    );
  }
});
```

### Custom Screenshot Options

```typescript
import { getScreenshotOptions } from '../utils/helpers.js';

const options = getScreenshotOptions('component-name', {
  fullPage: false,
  customMask: ['[data-testid="dynamic-element"]'],
  customStyle: `
    .loading-indicator {
      display: none !important;
    }
  `
});
```

### Custom Thresholds

```typescript
// Override default thresholds for specific tests
await expect(component).toMatchScreenshot(options, {
  threshold: 0.1,      // 10% difference threshold
  maxDiffPixels: 500,  // Max 500 different pixels
  animation: 'disabled'
});
```

## 🐛 Troubleshooting

### Common Issues

1. **Flaky Tests**:
   - Increase timeout values
   - Use `waitForElementStability()` helper
   - Disable animations in test setup

2. **High Difference Thresholds**:
   - Review recent UI changes
   - Check for dynamic content masking
   - Adjust pixel difference thresholds

3. **Browser Rendering Differences**:
   - Test across multiple browsers
   - Use consistent CSS for critical visual elements
   - Consider browser-specific test files

4. **Performance Issues**:
   - Use selective screenshot testing
   - Reduce unnecessary page loads
   - Implement proper test isolation

### Debug Mode

Enable debug mode in development:

```typescript
// In visual-config.ts
const config = new VisualRegressionConfig({
  enableDebugMode: process.env.NODE_ENV === 'development'
});
```

### Local Testing

Run tests locally with debugging:

```bash
# Run single test file
npx playwright test --config=playwright.visual.config.ts tests/visual/components/ui-components.spec.ts --headed

# Run with debugging
npx playwright test --config=playwright.visual.config.ts tests/visual/components/ui-components.spec.ts --debug

# Run with trace
npx playwright test --config=playwright.visual.config.ts tests/visual/components/ui-components.spec.ts --trace on
```

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Visual Regression Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Install Playwright
      run: npx playwright install

    - name: Start application
      run: npm run dev &

    - name: Wait for application
      run: sleep 10

    - name: Run visual tests
      run: npm run test:visual

    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: visual-test-reports
        path: tests/visual/reports/
```

## 📚 Best Practices

1. **Consistent Test Environment**:
   - Use fixed viewport sizes
   - Mock dynamic data
   - Disable animations

2. **Selective Testing**:
   - Test critical user flows
   - Focus on high-value components
   - Use strategic masking

3. **Proper Naming**:
   - Descriptive test names
   - Consistent screenshot naming
   - Include viewport information

4. **Regular Updates**:
   - Update baseline images after intentional changes
   - Review and approve diff files
   - Maintain test documentation

5. **Performance Optimization**:
   - Use parallel execution
   - Limit unnecessary screenshots
   - Implement proper cleanup

## 🔗 Additional Resources

- [Playwright Visual Testing Documentation](https://playwright.dev/docs/visual-testing)
- [Visual Regression Testing Best Practices](https://playwright.dev/docs/test-snapshots)
- [Playwright Configuration Options](https://playwright.dev/docs/test-use-options)

## 📞 Support

For issues with the visual testing framework:
1. Check the troubleshooting section above
2. Review Playwright documentation
3. Examine test logs and error messages
4. Check application console for JavaScript errors
5. Verify baseline images and threshold settings