/**
 * Security Scanning Engine Critical Path Tests
 * Comprehensive testing for SAST/DAST scanning and vulnerability detection
 */

import { SecurityScanner } from '../../src/security/scanning/SecurityScanner.js';
import { VulnerabilityManager } from '../../src/security/scanning/VulnerabilityManager.js';
import { SecurityConfig } from '../../src/security/core/SecurityConfig.js';
import { SecurityFramework } from '../../src/security/core/SecurityFramework.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Security Scanning Engine - Critical Path Tests', () => {
  let securityScanner: SecurityScanner;
  let vulnerabilityManager: VulnerabilityManager;
  let securityConfig: SecurityConfig;
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDirectory();

    securityConfig = {
      environment: 'test',
      jwtSecret: 'test-secret',
      tokenExpiry: 24,
      sessionTimeout: 60,
      maxLoginAttempts: 5,
      mfaRequired: false,
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      },
      apiSecurity: {
        rateLimiting: {
          windowMs: 15 * 60 * 1000,
          maxRequests: 100
        },
        inputValidation: {
          maxRequestBodySize: '10mb',
          allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded']
        }
      },
      encryptionSettings: {
        algorithm: 'aes-256-gcm',
        enableDataInTransitEncryption: true,
        enableDataAtRestEncryption: true
      }
    };

    // Create mock vulnerability database
    const vulnerabilityDatabase = new Map([
      ['eval-usage', {
        id: 'eval-usage',
        type: 'code_injection',
        severity: 'critical',
        description: 'Use of eval() function can lead to code injection',
        pattern: /eval\s*\(/g,
        remediation: 'Avoid using eval(), use safer alternatives'
      }],
      ['sql-injection', {
        id: 'sql-injection',
        type: 'injection',
        severity: 'critical',
        description: 'Potential SQL injection vulnerability',
        pattern: /query\s*\+\s*["']/g,
        remediation: 'Use parameterized queries'
      }],
      ['xss-vulnerability', {
        id: 'xss-vulnerability',
        type: 'xss',
        severity: 'high',
        description: 'Cross-site scripting vulnerability',
        pattern: /innerHTML\s*=.*["']/g,
        remediation: 'Use textContent or sanitize HTML'
      }],
      ['hardcoded-secret', {
        id: 'hardcoded-secret',
        type: 'sensitive_data',
        severity: 'high',
        description: 'Hardcoded secret detected',
        pattern: /(password|secret|key)\s*=\s*["'][^"']+["']/gi,
        remediation: 'Use environment variables or secure storage'
      }]
    ]);

    vulnerabilityManager = new VulnerabilityManager(securityConfig);
    (vulnerabilityManager as any).vulnerabilityDatabase = vulnerabilityDatabase;

    securityScanner = new SecurityScanner(securityConfig, vulnerabilityManager);
    await securityScanner.initialize();
  });

  afterEach(async () => {
    await cleanupTestDirectory(testDir);
  });

  describe('Vulnerability Detection', () => {
    describe('Static Application Security Testing (SAST)', () => {
      it('should detect eval() usage vulnerabilities', async () => {
        const vulnerableCode = `
          function processData(input) {
            return eval(input); // Vulnerable to code injection
          }

          function calculate(expression) {
            const result = eval(expression); // Another eval usage
            return result;
          }
        `;

        const scanResult = await securityScanner.scanCode(vulnerableCode, 'javascript');

        expect(scanResult.vulnerabilities).toHaveLength(2);
        expect(scanResult.vulnerabilities.every(v =>
          v.type === 'code_injection' && v.severity === 'critical'
        )).toBe(true);
        expect(scanResult.vulnerabilities.some(v =>
          v.description.includes('eval()')
        )).toBe(true);
      });

      it('should detect SQL injection vulnerabilities', async () => {
        const vulnerableCode = `
          function getUser(userId) {
            const query = "SELECT * FROM users WHERE id = '" + userId + "'"; // SQL injection
            return db.query(query);
          }

          function searchUsers(searchTerm) {
            const sql = "SELECT * FROM users WHERE name LIKE '%" + searchTerm + "%'";
            return db.query(sql);
          }
        `;

        const scanResult = await securityScanner.scanCode(vulnerableCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v =>
          v.type === 'injection' && v.severity === 'critical'
        )).toBe(true);
      });

      it('should detect XSS vulnerabilities', async () => {
        const vulnerableCode = `
          function displayMessage(message) {
            document.getElementById('output').innerHTML = message; // XSS vulnerability
          }

          function renderUserData(user) {
            const element = document.querySelector('.user-info');
            element.innerHTML = '<h2>' + user.name + '</h2>'; // Another XSS
          }
        `;

        const scanResult = await securityScanner.scanCode(vulnerableCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v =>
          v.type === 'xss' && v.severity === 'high'
        )).toBe(true);
      });

      it('should detect hardcoded secrets', async () => {
        const vulnerableCode = `
          const API_KEY = "sk-1234567890abcdef"; // Hardcoded API key
          const password = "SuperSecretPassword123!"; // Hardcoded password
          const secretToken = "jwt-secret-key-123"; // Hardcoded JWT secret

          function connectToDatabase() {
            const dbPassword = "db_admin_password"; // Another hardcoded secret
            return connect(dbPassword);
          }
        `;

        const scanResult = await securityScanner.scanCode(vulnerableCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v =>
          v.type === 'sensitive_data' && v.severity === 'high'
        )).toBe(true);
        expect(scanResult.vulnerabilities.some(v =>
          v.description.includes('Hardcoded secret')
        )).toBe(true);
      });

      it('should analyze code complexity for security implications', async () => {
        const complexCode = `
          function processData(input) {
            if (input.type === 'admin') {
              if (input.action === 'delete') {
                if (input.confirm) {
                  if (input.backup) {
                    if (input.audit) {
                      if (input.notification) {
                        return executeDelete(input);
                      }
                    }
                  }
                }
              }
            }
            return false;
          }
        `;

        const scanResult = await securityScanner.scanCode(complexCode, 'javascript');

        expect(scanResult.metrics.complexity).toBeGreaterThan(10);
        expect(scanResult.vulnerabilities.some(v =>
          v.type === 'complexity' && v.severity === 'medium'
        )).toBe(true);
      });
    });

    describe('False Negative Prevention', () => {
      it('should not miss vulnerabilities in obfuscated code', async () => {
        const obfuscatedCode = `
          function _0x1a2b(_0x3c4d, _0x5e6f) {
            return eval(_0x3c4d + _0x5e6f); // Obfuscated eval usage
          }

          const _0x7g8h = "SELECT * FROM users WHERE id = '" + _0x5e6f + "'"; // Obfuscated SQL injection
          eval(_0x7g8h);
        `;

        const scanResult = await securityScanner.scanCode(obfuscatedCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v => v.type === 'code_injection')).toBe(true);
      });

      it('should detect vulnerabilities in template literals', async () => {
        const vulnerableCode = `
          function getUserQuery(userId) {
            const query = \`SELECT * FROM users WHERE id = '\${userId}'\`; // SQL injection in template literal
            return db.query(query);
          }

          function renderTemplate(userName) {
            const html = \`<div>Hello \${userName}!</div>\`; // XSS in template literal
            return html;
          }
        `;

        const scanResult = await securityScanner.scanCode(vulnerableCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v => v.type === 'injection')).toBe(true);
      });

      it('should detect vulnerabilities in dynamically constructed code', async () => {
        const dynamicCode = `
          const funcName = 'eval';
          window[funcName]('malicious code'); // Dynamic eval usage

          const methodName = 'innerHTML';
          document.getElementById('output')[methodName] = userInput; // Dynamic XSS
        `;

        const scanResult = await securityScanner.scanCode(dynamicCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v =>
          v.type === 'code_injection' || v.type === 'xss'
        )).toBe(true);
      });
    });

    describe('Multi-language Support', () => {
      it('should scan Python code for security vulnerabilities', async () => {
        const pythonCode = `
          import subprocess
          import os

          def execute_command(user_input):
              return eval(user_input) # Code injection in Python

          def run_system_command(command):
              os.system(command) # Command injection

          def get_user_data(user_id):
              query = "SELECT * FROM users WHERE id = '" + user_id + "'" # SQL injection
              cursor.execute(query)
        `;

        const scanResult = await securityScanner.scanCode(pythonCode, 'python');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v => v.type === 'code_injection')).toBe(true);
        expect(scanResult.vulnerabilities.some(v => v.type === 'injection')).toBe(true);
      });

      it('should scan TypeScript code for security vulnerabilities', async () => {
        const typescriptCode = `
          interface User {
            id: number;
            name: string;
          }

          function renderUser(user: User): string {
            return \`<div>\${user.name}</div>\`; // XSS potential
          }

          function executeCode(code: string): any {
            return eval(code); // Code injection
          }

          function buildQuery(id: number): string {
            return \`SELECT * FROM users WHERE id = '\${id}'\`; // SQL injection
          }
        `;

        const scanResult = await securityScanner.scanCode(typescriptCode, 'typescript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v => v.type === 'code_injection')).toBe(true);
      });
    });
  });

  describe('Dynamic Application Security Testing (DAST)', () => {
    describe('API Security Testing', () => {
      it('should test for SQL injection in API endpoints', async () => {
        const maliciousPayloads = [
          "'; DROP TABLE users; --",
          "' OR '1'='1",
          "1' UNION SELECT username,password FROM users--"
        ];

        for (const payload of maliciousPayloads) {
          const testRequest = {
            method: 'POST',
            url: '/api/users',
            headers: { 'Content-Type': 'application/json' },
            body: { query: `SELECT * FROM users WHERE name = '${payload}'` }
          };

          const scanResult = await securityScanner.scanApiRequest(testRequest);

          expect(scanResult.vulnerabilities.some(v =>
            v.type === 'injection' && v.severity === 'critical'
          )).toBe(true);
        }
      });

      it('should test for XSS in API responses', async () => {
        const xssPayloads = [
          '<script>alert("XSS")</script>',
          'javascript:alert("XSS")',
          '<img src=x onerror=alert("XSS")>'
        ];

        for (const payload of xssPayloads) {
          const testResponse = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { message: `Hello ${payload}` }
          };

          const scanResult = await securityScanner.scanApiResponse(testResponse);

          expect(scanResult.vulnerabilities.some(v =>
            v.type === 'xss' && v.severity === 'high'
          )).toBe(true);
        }
      });

      it('should test for authentication bypass attempts', async () => {
        const bypassAttempts = [
          { headers: { 'Authorization': 'Bearer fake-token' } },
          { headers: { 'X-API-Key': 'admin' } },
          { body: { role: 'admin', permissions: ['*'] } }
        ];

        for (const attempt of bypassAttempts) {
          const testRequest = {
            method: 'POST',
            url: '/api/protected',
            headers: attempt.headers || {},
            body: attempt.body || {}
          };

          const scanResult = await securityScanner.scanApiRequest(testRequest);

          expect(scanResult.vulnerabilities.some(v =>
            v.type === 'auth_bypass' || v.type === 'privilege_escalation'
          )).toBe(true);
        }
      });
    });

    describe('Form Input Testing', () => {
      it('should test form fields for injection vulnerabilities', async () => {
        const maliciousInputs = [
          '<script>alert("XSS")</script>',
          '"; DROP TABLE users; --',
          '../../etc/passwd',
          '{{7*7}}' // Template injection
        ];

        for (const input of maliciousInputs) {
          const formData = {
            username: input,
            email: 'test@example.com',
            message: input
          };

          const scanResult = await securityScanner.scanFormData(formData);

          expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
          expect(scanResult.vulnerabilities.some(v =>
            ['xss', 'injection', 'path_traversal'].includes(v.type)
          )).toBe(true);
        }
      });

      it('should test file upload security', async () => {
        const maliciousFiles = [
          { name: 'malicious.php', content: '<?php system($_GET["cmd"]); ?>' },
          { name: 'script.js', content: '<script>alert("XSS")</script>' },
          { name: 'exploit.exe', content: 'MZ\x90\x00' } // PE header
        ];

        for (const file of maliciousFiles) {
          const scanResult = await securityScanner.scanFileUpload(file);

          expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
          expect(scanResult.vulnerabilities.some(v =>
            v.type === 'malicious_upload' && v.severity === 'critical'
          )).toBe(true);
        }
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large codebases efficiently', async () => {
      const largeCodebase = generateLargeCodebase(50000); // 50k lines

      const startTime = Date.now();
      const scanResult = await securityScanner.scanCode(largeCodebase, 'javascript');
      const duration = Date.now() - startTime;

      expect(scanResult).toBeDefined();
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(scanResult.metrics.linesScanned).toBeGreaterThan(49000);
    });

    it('should scan multiple files concurrently', async () => {
      const files = Array.from({ length: 100 }, (_, i) => ({
        path: `file${i}.js`,
        content: `function test${i}() { eval('console.log("test")'); }`
      }));

      const startTime = Date.now();
      const results = await securityScanner.scanFiles(files);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      expect(results.every(r => r.vulnerabilities.length > 0)).toBe(true);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should maintain consistent memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Scan multiple large files
      for (let i = 0; i < 20; i++) {
        const largeCode = generateLargeCodebase(5000);
        await securityScanner.scanCode(largeCode, 'javascript');
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Security and Attack Prevention', () => {
    describe('Scanner Evasion Detection', () => {
      it('should detect encoded malicious payloads', async () => {
        const encodedCode = `
          const encoded = 'ZXZhbCgiYWxlcnQoMSki'; // Base64 encoded "eval("alert(1)")"
          const decoded = atob(encoded);
          eval(decoded); // Still malicious after decoding
        `;

        const scanResult = await securityScanner.scanCode(encodedCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
        expect(scanResult.vulnerabilities.some(v => v.type === 'code_injection')).toBe(true);
      });

      it('should detect obfuscated vulnerability patterns', async () => {
        const obfuscatedCode = `
          const e = 'e' + 'va' + 'l';
          const malicious = 'alert("XSS")';
          window[e](malicious);

          const i = 'inner' + 'HTML';
          document.getElementById('output')[i] = userInput;
        `;

        const scanResult = await securityScanner.scanCode(obfuscatedCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
      });

      it('should detect comment-hidden vulnerabilities', async () => {
        const hiddenCode = `
          // TODO: Remove eval() in production
          // function debug() { eval(debugString); }

          /*
           * Backup code for emergency use:
           * eval(userInput);
           * document.body.innerHTML = response.data;
           */
        `;

        const scanResult = await securityScanner.scanCode(hiddenCode, 'javascript');

        expect(scanResult.vulnerabilities.length).toBeGreaterThan(0);
      });
    });

    describe('Resource Exhaustion Protection', ()     => {
      it('should limit scanning resource usage', async () => {
        const extremelyLargeCode = generateLargeCodebase(1000000); // 1M lines

        const scanResult = await securityScanner.scanCode(extremelyLargeCode, 'javascript', {
          maxLines: 50000, // Limit to 50k lines
          timeoutMs: 5000   // 5 second timeout
        });

        expect(scanResult).toBeDefined();
        expect(scanResult.metrics.linesScanned).toBeLessThanOrEqual(50000);
        expect(scanResult.warnings.some(w =>
          w.includes('limit') || w.includes('timeout')
        )).toBe(true);
      });

      it('should prevent regex DoS attacks', async () => {
        const regexDosCode = `
          // Complex nested regex that can cause ReDoS
          const pattern = /^(a+)+b$/;
          const testString = 'a'.repeat(10000) + 'b';
          pattern.test(testString);

          // Another potential ReDoS pattern
          const complexRegex = /(x+x+)+y/;
          complexRegex.test('x'.repeat(5000) + 'y');
        `;

        const startTime = Date.now();
        const scanResult = await securityScanner.scanCode(regexDosCode, 'javascript');
        const duration = Date.now() - startTime;

        expect(scanResult).toBeDefined();
        expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      });
    });

    describe('Path Traversal Prevention', () => {
      it('should detect file path traversal attempts', async () => {
        const traversalCode = `
          function readFile(filename) {
            const path = '../uploads/' + filename; // Path traversal
            return fs.readFileSync(path);
          }

          function include(template) {
            const file = '../../templates/' + template; // Another traversal
            return require(file);
          }
        `;

        const scanResult = await securityScanner.scanCode(traversalCode, 'javascript');

        expect(scanResult.vulnerabilities.some(v =>
          v.type === 'path_traversal' && v.severity === 'high'
        )).toBe(true);
      });

      it('should detect path normalization bypass attempts', async () => {
        const bypassCode = `
          function getSafePath(input) {
            const normalized = path.normalize(input);
            return '/var/www/' + normalized; // Can still be bypassed
          }

          function readFileSafe(filename) {
            const cleaned = filename.replace('../', ''); // Incomplete sanitization
            return fs.readFileSync(cleaned);
          }
        `;

        const scanResult = await securityScanner.scanCode(bypassCode, 'javascript');

        expect(scanResult.vulnerabilities.some(v =>
          v.type === 'path_traversal'
        )).toBe(true);
      });
    });
  });

  describe('Vulnerability Management', () => {
    describe('Vulnerability Classification', () => {
      it('should classify vulnerabilities by severity levels', async () => {
        const codeWithMultipleVulns = `
          function critical() {
            eval(userInput); // Critical: Direct code execution
          }

          function high() {
            document.getElementById('output').innerHTML = userInput; // High: XSS
          }

          function medium() {
            const secret = 'hardcoded-secret'; // Medium: Hardcoded secret
          }

          function low() {
            console.log(variable); // Low: Use of undefined variable
          }
        `;

        const scanResult = await securityScanner.scanCode(codeWithMultipleVulns, 'javascript');

        expect(scanResult.vulnerabilities.some(v => v.severity === 'critical')).toBe(true);
        expect(scanResult.vulnerabilities.some(v => v.severity === 'high')).toBe(true);
        expect(scanResult.vulnerabilities.some(v => v.severity === 'medium')).toBe(true);
        expect(scanResult.vulnerabilities.some(v => v.severity === 'low')).toBe(true);
      });

      it('should prioritize vulnerabilities by CVSS score', async () => {
        const highRiskCode = `
          // CVSS 9.8: Remote code execution
          eval(req.query.code);

          // CVSS 7.5: SQL injection
          const query = "SELECT * FROM users WHERE id = '" + req.params.id + "'";
        `;

        const scanResult = await securityScanner.scanCode(highRiskCode, 'javascript');

        expect(scanResult.vulnerabilities.every(v =>
          v.cvssScore !== undefined && v.cvssScore >= 7.0
        )).toBe(true);
        expect(scanResult.prioritizedIssues[0].cvssScore).toBeGreaterThanOrEqual(
          scanResult.prioritizedIssues[1].cvssScore
        );
      });
    });

    describe('Remediation Suggestions', () => {
      it('should provide specific remediation advice', async () => {
        const vulnerableCode = `
          function processData(input) {
            return eval(input);
          }
        `;

        const scanResult = await securityScanner.scanCode(vulnerableCode, 'javascript');

        expect(scanResult.vulnerabilities[0].remediation).toBeDefined();
        expect(scanResult.vulnerabilities[0].remediation).toContain('eval');
        expect(scanResult.vulnerabilities[0].suggestions.length).toBeGreaterThan(0);
      });

      it('should suggest secure alternatives', async () => {
        const sqlInjectionCode = `
          function getUser(id) {
            return db.query("SELECT * FROM users WHERE id = '" + id + "'");
          }
        `;

        const scanResult = await securityScanner.scanCode(sqlInjectionCode, 'javascript');

        expect(scanResult.vulnerabilities[0].secureAlternatives).toContain('parameterized queries');
        expect(scanResult.vulnerabilities[0].codeExamples).toBeDefined();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should integrate with CI/CD pipeline', async () => {
      const ciConfig = {
        failOnVulnerabilities: true,
        allowedSeverity: ['medium', 'high', 'critical'],
        outputFormat: 'junit',
        outputFile: 'security-scan-results.xml'
      };

      const codebase = `
        function safe() {
          return "safe code";
        }

        function vulnerable() {
          eval(userInput);
        }
      `;

      const scanResult = await securityScanner.scanForCI(codebase, 'javascript', ciConfig);

      expect(scanResult.passed).toBe(false); // Should fail due to critical vulnerability
      expect(scanResult.junitOutput).toBeDefined();
      expect(scanResult.exitCode).toBe(1);
    });

    it('should generate comprehensive security reports', async () => {
      const complexCode = generateVulnerableCodebase();

      const scanResult = await securityScanner.scanCode(complexCode, 'javascript');

      const report = await securityScanner.generateReport(scanResult, {
        format: 'html',
        includeMetrics: true,
        includeRemediation: true,
        includeExecutiveSummary: true
      });

      expect(report).toBeDefined();
      expect(report.summary.totalVulnerabilities).toBeGreaterThan(0);
      expect(report.summary.criticalIssues).toBeGreaterThan(0);
      expect(report.metrics.codeQuality).toBeDefined();
      expect(report.remediationPlan).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed code gracefully', async () => {
      const malformedCode = `
        function broken() {
          const unclosed = "missing end quote
          const invalidSyntax = @#$%#%^&
          return broken;
      `;

      const scanResult = await securityScanner.scanCode(malformedCode, 'javascript');

      expect(scanResult).toBeDefined();
      expect(scanResult.errors.length).toBeGreaterThan(0);
      expect(scanResult.warnings.some(w => w.includes('syntax'))).toBe(true);
    });

    it('should handle file system errors', async () => {
      const nonExistentFile = '/path/that/does/not/exist.js';

      await expect(securityScanner.scanFile(nonExistentFile))
        .rejects.toThrow(/File not found|ENOENT/);
    });

    it('should handle corrupted vulnerability database', async () => {
      // Mock corrupted database
      (vulnerabilityManager as any).vulnerabilityDatabase = null;

      const code = `
        function test() {
          eval("test");
        }
      `;

      const scanResult = await securityScanner.scanCode(code, 'javascript');

      expect(scanResult).toBeDefined();
      expect(scanResult.warnings.some(w => w.includes('vulnerability database'))).toBe(true);
    });
  });
});

// Helper functions

async function createTestDirectory(): Promise<string> {
  const testDir = path.join(process.cwd(), 'test-security-scanning');
  try {
    await fs.mkdir(testDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  return testDir;
}

async function cleanupTestDirectory(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist
  }
}

function generateLargeCodebase(lines: number): string {
  const functions = [];
  for (let i = 0; i < lines; i += 20) {
    functions.push(`
      function function${i}() {
        const x = ${i};
        const y = x * 2;
        const result = y + ${i % 100};
        return result;
      }

      function function${i + 1}() {
        const data = fetch('/api/data').then(res => res.json());
        return data;
      }

      function function${i + 2}() {
        const element = document.getElementById('item${i}');
        if (element) {
          element.textContent = 'Content ${i}';
        }
      }

      function function${i + 3}() {
        const config = {
          timeout: ${1000 + (i % 5000)},
          retries: ${i % 5},
          endpoint: '/api/endpoint${i}'
        };
        return config;
      }
    `);
  }
  return functions.join('\n');
}

function generateVulnerableCodebase(): string {
  return `
    // SQL Injection vulnerability
    function getUser(id) {
      const query = "SELECT * FROM users WHERE id = '" + id + "'";
      return db.query(query);
    }

    // XSS vulnerability
    function renderMessage(msg) {
      document.getElementById('output').innerHTML = msg;
    }

    // Code injection
    function execute(code) {
      return eval(code);
    }

    // Hardcoded secret
    const API_KEY = "sk-1234567890abcdef";

    // Path traversal
    function readFile(filename) {
      return fs.readFileSync('../files/' + filename);
    }

    // Command injection
    function runCommand(cmd) {
      return require('child_process').exec(cmd);
    }
  `;
}