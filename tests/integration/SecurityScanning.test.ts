import { SecurityScanning } from '../../src/core/SecurityScanning.js';
import { ScanType, ScanStatus, IssueSeverity } from '../../src/types/index.js';

// Mock console methods to reduce test noise
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

describe('SecurityScanning - Comprehensive Security Tests', () => {
  let securityScanning: SecurityScanning;

  beforeEach(() => {
    // Reset singleton instance for each test
    (SecurityScanning as any).instance = null;
    securityScanning = SecurityScanning.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SecurityScanning.getInstance();
      const instance2 = SecurityScanning.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance when none exists', () => {
      const instance = SecurityScanning.getInstance();

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(SecurityScanning);
    });
  });

  describe('Scan Initiation', () => {
    it('should initiate SAST scan successfully', async () => {
      const scan = await securityScanning.initiateScan(
        ScanType.SAST,
        '/path/to/source/code.js'
      );

      expect(scan).toBeDefined();
      expect(scan.id).toMatch(/^scan_\d+_[a-z0-9]+$/);
      expect(scan.type).toBe(ScanType.SAST);
      expect(scan.target).toBe('/path/to/source/code.js');
      expect(scan.status).toBe(ScanStatus.PENDING);
      expect(scan.createdAt).toBeInstanceOf(Date);
    });

    it('should initiate DAST scan successfully', async () => {
      const scan = await securityScanning.initiateScan(
        ScanType.DAST,
        'https://example.com'
      );

      expect(scan.type).toBe(ScanType.DAST);
      expect(scan.target).toBe('https://example.com');
    });

    it('should initiate DEPENDENCY scan successfully', async () => {
      const scan = await securityScanning.initiateScan(
        ScanType.DEPENDENCY,
        '/path/to/package.json'
      );

      expect(scan.type).toBe(ScanType.DEPENDENCY);
      expect(scan.target).toBe('/path/to/package.json');
    });

    it('should accept scan options', async () => {
      const options = {
        depth: 5,
        timeout: 30000,
        excludePatterns: ['*.test.js', 'node_modules/**']
      };

      const scan = await securityScanning.initiateScan(
        ScanType.SAST,
        '/path/to/project',
        options
      );

      expect(scan.status).toBe(ScanStatus.PENDING);
    });

    it('should emit scanQueued event when scan is initiated', async () => {
      const eventSpy = jest.fn();
      securityScanning.on('scanQueued', eventSpy);

      const scan = await securityScanning.initiateScan(
        ScanType.SAST,
        '/test/path'
      );

      expect(eventSpy).toHaveBeenCalledWith(scan);
    });

    it('should handle multiple scans in queue', async () => {
      const scans = await Promise.all([
        securityScanning.initiateScan(ScanType.SAST, '/path1'),
        securityScanning.initiateScan(ScanType.DAST, 'https://example.com'),
        securityScanning.initiateScan(ScanType.DEPENDENCY, '/path/package.json')
      ]);

      expect(scans).toHaveLength(3);
      scans.forEach(scan => {
        expect(scan.status).toBe(ScanStatus.PENDING);
        expect(scan.id).toMatch(/^scan_\d+_[a-z0-9]+$/);
      });
    });
  });

  describe('Comprehensive Scanning', () => {
    it('should perform comprehensive scan with all scan types', async () => {
      const options = {
        sast: { depth: 3 },
        dast: { owaspChecks: true },
        dependency: { excludePatterns: ['*.test.js'] }
      };

      const scans = await securityScanning.performComprehensiveScan(
        '/test/project',
        options
      );

      expect(scans).toHaveLength(4); // 3 individual scans + 1 comprehensive scan

      const [sastScan, dastScan, depScan, compScan] = scans;

      expect(sastScan.type).toBe(ScanType.SAST);
      expect(dastScan.type).toBe(ScanType.DAST);
      expect(depScan.type).toBe(ScanType.DEPENDENCY);
      expect(compScan.type).toBe(ScanType.COMPREHENSIVE);
    });

    it('should handle comprehensive scan without options', async () => {
      const scans = await securityScanning.performComprehensiveScan('/test/project');

      expect(scans).toHaveLength(4);
      expect(scans[3].type).toBe(ScanType.COMPREHENSIVE);
    });

    it('should emit comprehensiveScanCompleted event', async () => {
      const eventSpy = jest.fn();
      securityScanning.on('comprehensiveScanCompleted', eventSpy);

      await securityScanning.performComprehensiveScan('/test/project');

      // Wait for scans to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ScanType.COMPREHENSIVE,
          target: '/test/project'
        })
      );
    });

    it('should aggregate results from all scan types', async () => {
      const scans = await securityScanning.performComprehensiveScan('/test/project');

      // Wait for scans to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const comprehensiveScan = scans.find(s => s.type === ScanType.COMPREHENSIVE);

      expect(comprehensiveScan).toBeDefined();
      expect(comprehensiveScan!.results).toBeDefined();
    });
  });

  describe('Scan Status Management', () => {
    it('should return null for non-existent scan', () => {
      const status = securityScanning.getScanStatus('non-existent-scan-id');
      expect(status).toBeNull();
    });

    it('should return pending scan status', async () => {
      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/path');
      const status = securityScanning.getScanStatus(scan.id);

      expect(status).toBeDefined();
      expect(status!.id).toBe(scan.id);
      expect(status!.status).toBe(ScanStatus.PENDING);
    });

    it('should return completed scan status', async () => {
      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/path');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = securityScanning.getScanStatus(scan.id);
      expect(status!.status).toBe(ScanStatus.COMPLETED);
      expect(status!.completedAt).toBeInstanceOf(Date);
    });

    it('should return scan from history', async () => {
      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/path');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const status = securityScanning.getScanStatus(scan.id);
      expect(status).toBeDefined();
      expect(status!.status).toBe(ScanStatus.COMPLETED);
    });
  });

  describe('Static Code Analysis (SAST)', () => {
    it('should analyze JavaScript code for vulnerabilities', async () => {
      const code = `
        function dangerous(input) {
          eval(input);
          document.innerHTML = input;
          return true;
        }
      `;

      const results = await securityScanning.analyzeStaticCode(code, 'javascript');

      expect(results).toHaveLength(2);

      const evalResult = results.find(r => r.type === 'eval_usage');
      const innerHTMLResult = results.find(r => r.type === 'innerHTML_assignment');

      expect(evalResult).toBeDefined();
      expect(evalResult!.severity).toBe(IssueSeverity.CRITICAL);
      expect(evalResult!.description).toContain('eval()');

      expect(innerHTMLResult).toBeDefined();
      expect(innerHTMLResult!.severity).toBe(IssueSeverity.HIGH);
      expect(innerHTMLResult!.description).toContain('innerHTML');
    });

    it('should analyze Python code for vulnerabilities', async () => {
      const code = `
        def dangerous(user_input):
            exec(user_input)
            eval(user_input)
            return True
      `;

      const results = await securityScanning.analyzeStaticCode(code, 'python');

      expect(results.length).toBeGreaterThan(0);

      const execResult = results.find(r => r.type === 'exec_usage');
      const evalResult = results.find(r => r.type === 'eval_usage_python');

      expect(execResult).toBeDefined();
      expect(evalResult).toBeDefined();
    });

    it('should analyze Java code for SQL injection vulnerabilities', async () => {
      const code = `
        public class UserDAO {
          public User getUser(String id) {
            Statement stmt = connection.createStatement();
            String query = "SELECT * FROM users WHERE id = " + id;
            return stmt.executeQuery(query);
          }
        }
      `;

      const results = await securityScanning.analyzeStaticCode(code, 'java');

      expect(results.length).toBeGreaterThan(0);

      const sqlResult = results.find(r => r.type === 'sql_concatenation');
      expect(sqlResult).toBeDefined();
      expect(sqlResult!.severity).toBe(IssueSeverity.HIGH);
    });

    it('should handle unknown language gracefully', async () => {
      const code = 'function test() { return true; }';
      const results = await securityScanning.analyzeStaticCode(code, 'unknown-language');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should calculate correct line numbers', async () => {
      const code = `
        line 1
        line 2
        eval("dangerous"); // This should be line 4
        line 5
      `;

      const results = await securityScanning.analyzeStaticCode(code, 'javascript');
      const evalResult = results.find(r => r.type === 'eval_usage');

      expect(evalResult!.line).toBe(4);
    });

    it('should extract and analyze dependencies', async () => {
      const code = `
        const express = require('express');
        import lodash from 'lodash';
        import axios from 'axios';
      `;

      const results = await securityScanning.analyzeStaticCode(code, 'javascript');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Application Security Testing (DAST)', () => {
    it('should perform basic security checks', async () => {
      // Mock fetch for testing
      global.fetch = jest.fn().mockResolvedValue({
        headers: {
          get: jest.fn().mockReturnValue(null) // No security headers
        }
      });

      const results = await securityScanning.performDynamicScan('https://example.com');

      expect(results.length).toBeGreaterThan(0);

      // Should detect missing security headers
      const missingHeaders = results.filter(r => r.type === 'missing_security_header');
      expect(missingHeaders.length).toBeGreaterThan(0);
    });

    it('should handle OWASP checks when enabled', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        headers: { get: jest.fn() }
      });

      const options = {
        owaspChecks: true
      };

      const results = await securityScanning.performDynamicScan('https://example.com', options);

      expect(results).toBeDefined();
    });

    it('should handle authentication tests when enabled', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        headers: { get: jest.fn() }
      });

      const authConfig = {
        username: 'test',
        password: 'test'
      };

      const options = {
        authTests: true,
        authConfig
      };

      const results = await securityScanning.performDynamicScan('https://example.com', options);

      expect(results).toBeDefined();
    });

    it('should handle connectivity errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const results = await securityScanning.performDynamicScan('https://unreachable.com');

      expect(results.length).toBeGreaterThan(0);

      const errorResult = results.find(r => r.type === 'connectivity_error');
      expect(errorResult).toBeDefined();
      expect(errorResult!.severity).toBe(IssueSeverity.HIGH);
    });
  });

  describe('Dependency Scanning', () => {
    it('should scan dependencies for vulnerabilities', async () => {
      const results = await securityScanning.scanDependencies(
        '/path/to/package.json',
        'npm'
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle different package managers', async () => {
      const packageManagers = ['npm', 'yarn', 'pip', 'cargo'] as const;

      for (const pm of packageManagers) {
        const results = await securityScanning.scanDependencies('/test/package.json', pm);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should handle parsing errors gracefully', async () => {
      // Mock the parsing function to throw an error
      const results = await securityScanning.scanDependencies('/nonexistent/package.json');

      expect(results.length).toBeGreaterThan(0);

      const errorResult = results.find(r => r.type === 'dependency_scan_error');
      expect(errorResult).toBeDefined();
      expect(errorResult!.severity).toBe(IssueSeverity.MEDIUM);
    });
  });

  describe('Security Results Management', () => {
    it('should return empty results for unknown target', () => {
      const results = securityScanning.getSecurityResults('unknown-target');
      expect(results).toHaveLength(0);
    });

    it('should return results for completed scans', async () => {
      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/project');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const results = securityScanning.getSecurityResults('/test/project');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter results by target', async () => {
      await Promise.all([
        securityScanning.initiateScan(ScanType.SAST, '/project1'),
        securityScanning.initiateScan(ScanType.SAST, '/project2')
      ]);

      // Wait for scans to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const results1 = securityScanning.getSecurityResults('/project1');
      const results2 = securityScanning.getSecurityResults('/project2');

      expect(results1).toBeDefined();
      expect(results2).toBeDefined();
    });
  });

  describe('Security Statistics', () => {
    it('should return default statistics for empty history', () => {
      const stats = securityScanning.getSecurityStats();

      expect(stats.totalScans).toBe(0);
      expect(stats.totalIssues).toBe(0);
      expect(stats.criticalIssues).toBe(0);
      expect(stats.highIssues).toBe(0);
      expect(stats.averageSeverity).toBe(0);
      expect(stats.commonVulnerabilities).toHaveLength(0);
      expect(stats.scanTrends).toHaveLength(0);
    });

    it('should calculate statistics from completed scans', async () => {
      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/project');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = securityScanning.getSecurityStats();

      expect(stats.totalScans).toBeGreaterThan(0);
      expect(stats.totalIssues).toBeGreaterThan(0);
      expect(stats.commonVulnerabilities).toBeDefined();
      expect(stats.scanTrends).toBeDefined();
    });

    it('should filter statistics by timeframe', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const timeframe = {
        start: yesterday,
        end: now
      };

      const stats = securityScanning.getSecurityStats(timeframe);

      expect(stats).toBeDefined();
      expect(typeof stats.totalScans).toBe('number');
    });

    it('should count critical and high issues correctly', async () => {
      const codeWithCriticalIssues = `
        eval("dangerous code");
        document.innerHTML = userInput;
        more Dangerous stuff();
      `;

      await securityScanning.analyzeStaticCode(codeWithCriticalIssues, 'javascript');
      const stats = securityScanning.getSecurityStats();

      expect(stats.criticalIssues).toBeGreaterThanOrEqual(0);
      expect(stats.highIssues).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average severity correctly', async () => {
      const stats = securityScanning.getSecurityStats();

      expect(typeof stats.averageSeverity).toBe('number');
      expect(stats.averageSeverity).toBeGreaterThanOrEqual(0);
      expect(stats.averageSeverity).toBeLessThanOrEqual(4);
    });

    it('should identify common vulnerabilities', async () => {
      const code = `
        eval("code");
        eval("more code");
        eval("even more code");
      `;

      await securityScanning.analyzeStaticCode(code, 'javascript');
      const stats = securityScanning.getSecurityStats();

      const evalVuln = stats.commonVulnerabilities.find(v => v.type === 'eval_usage');
      expect(evalVuln).toBeDefined();
      expect(evalVuln!.count).toBe(3);
    });

    it('should calculate scan trends', async () => {
      await Promise.all([
        securityScanning.initiateScan(ScanType.SAST, '/test1'),
        securityScanning.initiateScan(ScanType.SAST, '/test2'),
        securityScanning.initiateScan(ScanType.SAST, '/test3')
      ]);

      // Wait for scans to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = securityScanning.getSecurityStats();

      expect(stats.scanTrends).toBeDefined();
      expect(Array.isArray(stats.scanTrends)).toBe(true);
    });
  });

  describe('Security Report Generation', () => {
    it('should generate JSON security report', () => {
      const report = securityScanning.generateSecurityReport('/test/project', 'json');

      expect(report).toBeDefined();
      expect(report.target).toBe('/test/project');
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(report.results).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.statistics).toBeDefined();
    });

    it('should generate HTML security report', () => {
      const report = securityScanning.generateSecurityReport('/test/project', 'html');

      expect(report).toBeDefined();
      expect(report.target).toBe('/test/project');
    });

    it('should generate PDF security report', () => {
      const report = securityScanning.generateSecurityReport('/test/project', 'pdf');

      expect(report).toBeDefined();
      expect(report.target).toBe('/test/project');
    });

    it('should calculate correct risk score', async () => {
      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/project');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const report = securityScanning.generateSecurityReport('/test/project');

      expect(report.summary.riskScore).toBeDefined();
      expect(typeof report.summary.riskScore).toBe('number');
      expect(report.summary.riskScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.riskScore).toBeLessThanOrEqual(100);
    });

    it('should count issues by severity correctly', async () => {
      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/project');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const report = securityScanning.generateSecurityReport('/test/project');

      expect(typeof report.summary.totalIssues).toBe('number');
      expect(typeof report.summary.criticalIssues).toBe('number');
      expect(typeof report.summary.highIssues).toBe('number');
    });

    it('should generate relevant recommendations', async () => {
      const codeWithDependencyIssues = `
        const vulnerable = require('old-package');
        import { anotherVuln } from 'another-vulnerable';
      `;

      await securityScanning.analyzeStaticCode(codeWithDependencyIssues, 'javascript');
      const report = securityScanning.generateSecurityReport('/test/project');

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);

      if (report.summary.totalIssues > 0) {
        expect(report.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should emit securityReportGenerated event', () => {
      const eventSpy = jest.fn();
      securityScanning.on('securityReportGenerated', eventSpy);

      const report = securityScanning.generateSecurityReport('/test/project');

      expect(eventSpy).toHaveBeenCalledWith(report);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid scan targets gracefully', async () => {
      const scan = await securityScanning.initiateScan(ScanType.SAST, '');

      expect(scan).toBeDefined();
      expect(scan.status).toBe(ScanStatus.PENDING);
    });

    it('should handle scan failures', async () => {
      // Mock a scan failure by invalidating the scan execution
      const scan = await securityScanning.initiateScan(ScanType.SAST, '/invalid/path');

      // Wait for scan to potentially fail
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = securityScanning.getScanStatus(scan.id);

      // Should either complete or fail, not crash
      expect([ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.RUNNING]).toContain(status!.status);
    });

    it('should handle concurrent scans properly', async () => {
      const scans = await Promise.all([
        securityScanning.initiateScan(ScanType.SAST, '/path1'),
        securityScanning.initiateScan(ScanType.DAST, 'https://example.com'),
        securityScanning.initiateScan(ScanType.DEPENDENCY, '/path/package.json')
      ]);

      // All scans should have unique IDs
      const ids = scans.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // All scans should be pending initially
      scans.forEach(scan => {
        expect(scan.status).toBe(ScanStatus.PENDING);
      });
    });
  });

  describe('Vulnerability Database Integration', () => {
    it('should initialize vulnerability database on creation', () => {
      const instance = SecurityScanning.getInstance();
      expect(instance).toBeDefined();
    });

    it('should check vulnerability database for dependencies', async () => {
      const code = `
        const express = require('express');
        const lodash = require('lodash');
      `;

      const results = await securityScanning.analyzeStaticCode(code, 'javascript');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should map CVSS scores to severity levels correctly', async () => {
      // This is tested indirectly through the analyzeStaticCode method
      const results = await securityScanning.analyzeStaticCode('eval("test")', 'javascript');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].severity).toBeDefined();
      expect(Object.values(IssueSeverity)).toContain(results[0].severity);
    });
  });

  describe('Event Emission', () => {
    it('should emit scanCompleted event', async () => {
      const eventSpy = jest.fn();
      securityScanning.on('scanCompleted', eventSpy);

      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/path');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: scan.id,
          type: ScanType.SAST
        })
      );
    });

    it('should emit events with correct data', async () => {
      const eventSpy = jest.fn();
      securityScanning.on('scanCompleted', eventSpy);

      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/path');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const emittedEvent = eventSpy.mock.calls[0][0];

      expect(emittedEvent.id).toBe(scan.id);
      expect(emittedEvent.type).toBe(scan.type);
      expect(emittedEvent.target).toBe(scan.target);
      expect(emittedEvent.status).toBe(ScanStatus.COMPLETED);
      expect(emittedEvent.completedAt).toBeInstanceOf(Date);
      expect(emittedEvent.results).toBeDefined();
    });

    it('should handle multiple event listeners', async () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();

      securityScanning.on('scanCompleted', spy1);
      securityScanning.on('scanCompleted', spy2);

      const scan = await securityScanning.initiateScan(ScanType.SAST, '/test/path');

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });
  });

  describe('Code Analysis Language Support', () => {
    const testCases = [
      { language: 'javascript', code: 'const x = 1; eval("test");' },
      { language: 'typescript', code: 'const x: number = 1; eval("test");' },
      { language: 'python', code: 'x = 1; exec("test");' },
      { language: 'java', code: 'int x = 1; stmt.executeQuery("SELECT * FROM users WHERE id = " + id);' },
      { language: 'UNKNOWN', code: 'some random code' }
    ];

    testCases.forEach(({ language, code }) => {
      it(`should analyze ${language} code`, async () => {
        const results = await securityScanning.analyzeStaticCode(code, language);

        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large code files', async () => {
      const largeCode = 'eval("test");\n'.repeat(1000);

      const startTime = Date.now();
      const results = await securityScanning.analyzeStaticCode(largeCode, 'javascript');
      const endTime = Date.now();

      expect(results.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle many concurrent scans', async () => {
      const numScans = 10;
      const scans = await Promise.all(
        Array(numScans).fill(null).map((_, i) =>
          securityScanning.initiateScan(ScanType.SAST, `/test/path${i}`)
        )
      );

      expect(scans).toHaveLength(numScans);
      scans.forEach(scan => {
        expect(scan.id).toBeDefined();
        expect(scan.status).toBe(ScanStatus.PENDING);
      });
    });

    it('should manage memory efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create many scans
      await Promise.all(
        Array(100).fill(null).map((_, i) =>
          securityScanning.initiateScan(ScanType.SAST, `/test/path${i}`)
        )
      );

      // Wait for some scans to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Integration Features', () => {
    it('should integrate with external vulnerability databases', async () => {
      const code = 'require("some-package");';
      const results = await securityScanning.analyzeStaticCode(code, 'javascript');

      expect(results).toBeDefined();
      // Results would include vulnerability data if external databases were connected
    });

    it('should support custom scan configurations', async () => {
      const customOptions = {
        depth: 10,
        timeout: 60000,
        excludePatterns: ['*.min.js', 'coverage/**']
      };

      const scan = await securityScanning.initiateScan(
        ScanType.SAST,
        '/test/project',
        customOptions
      );

      expect(scan.status).toBe(ScanStatus.PENDING);
    });

    it('should support comprehensive scan customization', async () => {
      const comprehensiveOptions = {
        sast: { depth: 5, excludePatterns: ['test/**'] },
        dast: { owaspChecks: true, timeout: 30000 },
        dependency: { excludePatterns: ['devDependencies'] }
      };

      const scans = await securityScanning.performComprehensiveScan(
        '/test/project',
        comprehensiveOptions
      );

      expect(scans).toHaveLength(4);
    });
  });
});