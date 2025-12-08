/**
 * Visual Regression Testing Configuration
 * Centralizes configuration for visual testing across the application
 */

export interface ViewportConfig {
  width: number;
  height: number;
  name: string;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  animations?: 'disabled' | 'enabled';
  deviceScaleFactor?: number;
  hasAlpha?: boolean;
  omitBackground?: boolean;
  mask?: Array<string>;
  maskColor?: string;
  style?: string;
}

export interface VisualRegressionThreshold {
  pixels?: number;
  percentage?: number;
  colorChannel?: number;
  antialiasing?: boolean;
}

export class VisualRegressionConfig {
  private readonly config: {
    thresholds: VisualRegressionThreshold;
    viewports: ViewportConfig[];
    screenshotOptions: ScreenshotOptions;
    baseDirectory: string;
    maxDiffPixelCount: number;
    animationTimeout: number;
    enableDebugMode: boolean;
  };

  constructor() {
    this.config = {
      thresholds: {
        pixels: 1000, // Maximum different pixels
        percentage: 0.01, // 1% difference threshold
        colorChannel: 10, // Color difference threshold (0-255)
        antialiasing: true, // Enable antialiasing tolerance
      },
      viewports: [
        { width: 1920, height: 1080, name: 'desktop-xl' },
        { width: 1440, height: 900, name: 'desktop-lg' },
        { width: 1280, height: 720, name: 'desktop-md' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' },
      ],
      screenshotOptions: {
        fullPage: false, // Capture specific elements by default
        animations: 'disabled', // Disable animations for consistency
        deviceScaleFactor: 1, // Standard scale factor
        hasAlpha: false, // No transparency
        omitBackground: false, // Include background
        mask: [], // No masking by default
        maskColor: '#FF00FF', // Magenta mask color
        style: '', // Additional CSS styles
      },
      baseDirectory: 'tests/visual/screenshots',
      maxDiffPixelCount: 5000,
      animationTimeout: 5000,
      enableDebugMode: process.env.NODE_ENV === 'development',
    };
  }

  // Getters for configuration
  get thresholds(): VisualRegressionThreshold {
    return this.config.thresholds;
  }

  get viewports(): ViewportConfig[] {
    return this.config.viewports;
  }

  get screenshotOptions(): ScreenshotOptions {
    return this.config.screenshotOptions;
  }

  get baseDirectory(): string {
    return this.config.baseDirectory;
  }

  get maxDiffPixelCount(): number {
    return this.config.maxDiffPixelCount;
  }

  get animationTimeout(): number {
    return this.config.animationTimeout;
  }

  get enableDebugMode(): boolean {
    return this.config.enableDebugMode;
  }

  // Get viewport by name
  getViewport(name: string): ViewportConfig | undefined {
    return this.config.viewports.find(viewport => viewport.name === name);
  }

  // Get mobile viewport
  getMobileViewport(): ViewportConfig {
    return this.config.viewports.find(viewport => viewport.name === 'mobile')!;
  }

  // Get desktop viewport
  getDesktopViewport(): ViewportConfig {
    return this.config.viewports.find(viewport => viewport.name === 'desktop-md')!;
  }

  // Get tablet viewport
  getTabletViewport(): ViewportConfig {
    return this.config.viewports.find(viewport => viewport.name === 'tablet')!;
  }

  // Screenshot options presets
  getFullPageScreenshot(): ScreenshotOptions {
    return {
      ...this.config.screenshotOptions,
      fullPage: true,
    };
  }

  getComponentScreenshot(): ScreenshotOptions {
    return {
      ...this.config.screenshotOptions,
      fullPage: false,
    };
  }

  getMobileScreenshot(): ScreenshotOptions {
    return {
      ...this.config.screenshotOptions,
      deviceScaleFactor: 2, // Higher DPI for mobile
    };
  }

  // Custom screenshot options for specific use cases
  getScreenshotOptionsForComponent(componentType: string): ScreenshotOptions {
    const baseOptions = this.config.screenshotOptions;

    switch (componentType.toLowerCase()) {
      case 'header':
        return {
          ...baseOptions,
          fullPage: false,
          mask: ['[data-testid="notification-badge"]', '[data-testid="time-display"]'],
        };

      case 'modal':
        return {
          ...baseOptions,
          fullPage: false,
          mask: ['[data-testid="dynamic-content"]'],
          style: `
            [data-testid="modal-backdrop"] {
              background-color: rgba(0, 0, 0, 0.5) !important;
            }
          `,
        };

      case 'chart':
        return {
          ...baseOptions,
          fullPage: false,
          mask: ['[data-testid="chart-tooltip"]'],
          style: `
            [data-testid="chart-animation"] {
              animation: none !important;
            }
          `,
        };

      case 'form':
        return {
          ...baseOptions,
          fullPage: false,
          animations: 'disabled',
          style: `
            input:focus {
              box-shadow: 0 0 0 2px #007bff !important;
            }
          `,
        };

      case 'table':
        return {
          ...baseOptions,
          fullPage: false,
          mask: ['[data-testid="loading-spinner"]'],
          style: `
            tr {
              background-color: #ffffff !important;
            }
          `,
        };

      case 'button':
        return {
          ...baseOptions,
          fullPage: false,
          animations: 'disabled',
        };

      default:
        return baseOptions;
    }
  }

  // Environment-specific configurations
  getDevelopmentConfig(): Partial<VisualRegressionConfig['config']> {
    return {
      thresholds: {
        pixels: 2000, // More lenient for development
        percentage: 0.02, // 2% difference
        colorChannel: 15,
        antialiasing: true,
      },
      enableDebugMode: true,
    };
  }

  getProductionConfig(): Partial<VisualRegressionConfig['config']> {
    return {
      thresholds: {
        pixels: 500, // Stricter for production
        percentage: 0.005, // 0.5% difference
        colorChannel: 5,
        antialiasing: false,
      },
      enableDebugMode: false,
    };
  }

  // Get configuration for specific environment
  getEnvironmentConfig(environment: string): VisualRegressionConfig['config'] {
    const baseConfig = { ...this.config };

    switch (environment.toLowerCase()) {
      case 'development':
      case 'dev':
        return { ...baseConfig, ...this.getDevelopmentConfig() };

      case 'production':
      case 'prod':
        return { ...baseConfig, ...this.getProductionConfig() };

      case 'staging':
      case 'test':
        return baseConfig; // Use default config for staging

      default:
        return baseConfig;
    }
  }

  // Validate screenshot paths and directories
  validateScreenshotPath(path: string): boolean {
    // Check if path is valid and within allowed directory
    const normalizedPath = path.replace(/\\/g, '/');
    const isWithinBaseDirectory = normalizedPath.includes(this.config.baseDirectory);

    return isWithinBaseDirectory && !normalizedPath.includes('..');
  }

  // Generate screenshot file path
  generateScreenshotPath(testName: string, viewport?: ViewportConfig): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const viewportSuffix = viewport ? `-${viewport.name}` : '';
    const filename = `${testName}${viewportSuffix}-${timestamp}.png`;

    return `${this.config.baseDirectory}/${filename}`;
  }

  // Get retry configuration for flaky visual tests
  getRetryConfig(): {
    retries: number;
    retryDelay: number;
    maxRetries: number;
  } {
    return {
      retries: 2, // Retry flaky tests up to 2 times
      retryDelay: 1000, // 1 second between retries
      maxRetries: 3, // Maximum 3 total attempts
    };
  }

  // Update configuration dynamically
  updateConfig(updates: Partial<VisualRegressionConfig['config']>): void {
    Object.assign(this.config, updates);
  }

  // Export configuration for external use
  exportConfig(): VisualRegressionConfig['config'] {
    return { ...this.config };
  }

  // Validation utilities
  validateThreshold(threshold: VisualRegressionThreshold): boolean {
    return (
      (threshold.pixels === undefined || threshold.pixels >= 0) &&
      (threshold.percentage === undefined || (threshold.percentage >= 0 && threshold.percentage <= 1)) &&
      (threshold.colorChannel === undefined || (threshold.colorChannel >= 0 && threshold.colorChannel <= 255))
    );
  }

  validateViewport(viewport: ViewportConfig): boolean {
    return (
      viewport.width > 0 &&
      viewport.height > 0 &&
      viewport.name.length > 0
    );
  }

  // Debug utilities
  getDebugInfo(): string {
    return `
Visual Regression Configuration:
===============================
Thresholds:
  - Max pixels: ${this.config.thresholds.pixels}
  - Max percentage: ${(this.config.thresholds.percentage * 100).toFixed(2)}%
  - Color channel threshold: ${this.config.thresholds.colorChannel}
  - Antialiasing: ${this.config.thresholds.antialiasing}

Viewports:
${this.config.viewports.map(v => `  - ${v.name}: ${v.width}x${v.height}`).join('\n')}

Screenshot Options:
  - Full page: ${this.config.screenshotOptions.fullPage}
  - Animations: ${this.config.screenshotOptions.animations}
  - Device scale factor: ${this.config.screenshotOptions.deviceScaleFactor}
  - Base directory: ${this.config.baseDirectory}
  - Debug mode: ${this.config.enableDebugMode}

Environment: ${process.env.NODE_ENV || 'unknown'}
Timestamp: ${new Date().toISOString()}
`;
  }

  // Create configuration clone
  clone(): VisualRegressionConfig {
    const cloned = new VisualRegressionConfig();
    cloned.config = JSON.parse(JSON.stringify(this.config));
    return cloned;
  }
}

// Default instance
export const defaultVisualConfig = new VisualRegressionConfig();

// Export configuration constants
export const VIEWPORTS = {
  MOBILE: { width: 375, height: 667, name: 'mobile' },
  TABLET: { width: 768, height: 1024, name: 'tablet' },
  DESKTOP_MD: { width: 1280, height: 720, name: 'desktop-md' },
  DESKTOP_LG: { width: 1440, height: 900, name: 'desktop-lg' },
  DESKTOP_XL: { width: 1920, height: 1080, name: 'desktop-xl' },
} as const;

export const SCREENSHOT_PRESETS = {
  COMPONENT: 'component',
  FULL_PAGE: 'full-page',
  MOBILE: 'mobile',
  MODAL: 'modal',
  CHART: 'chart',
  FORM: 'form',
  TABLE: 'table',
  BUTTON: 'button',
} as const;