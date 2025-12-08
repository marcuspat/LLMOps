/**
 * Security Scanner Module
 * Comprehensive security scanning capabilities for code, dependencies, and infrastructure
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, access } from 'fs/promises';
import { join, extname } from 'path';
import { SecurityConfig } from '../core/SecurityConfig.js';
import { SecurityFramework } from '../core/SecurityFramework.js';

const execAsync = promisify(exec);

export class SecurityScanner {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize scanning tools and databases
    await this.updateVulnerabilityDatabase();
  }

  /**
   * Scan project dependencies for known vulnerabilities
   */
  async scanDependencies(projectPath: string): Promise<DependencyScanResult> {
    const scanId = this.generateScanId('deps');
    const vulnerabilities: DependencyVulnerability[] = [];

    try {
      // Node.js dependencies
      if (await this.fileExists(join(projectPath, 'package.json'))) {
        const npmVulns = await this.scanNpmDependencies(projectPath);
        vulnerabilities.push(...npmVulns);
      }

      // Python dependencies
      if (await this.fileExists(join(projectPath, 'requirements.txt'))) {
        const pipVulns = await this.scanPythonDependencies(projectPath);
        vulnerabilities.push(...pipVulns);
      }

      // Rust dependencies
      if (await this.fileExists(join(projectPath, 'Cargo.toml'))) {
        const cargoVulns = await this.scanRustDependencies(projectPath);
        vulnerabilities.push(...cargoVulns);
      }

      return {
        scanId,
        timestamp: new Date().toISOString(),
        totalDependencies: await this.countDependencies(projectPath),
        vulnerableDependencies: vulnerabilities.length,
        vulnerabilities
      };
    } catch (error) {
      throw new Error(`Dependency scanning failed: ${error}`);
    }
  }

  /**
   * Scan source code for security issues
   */
  async scanCode(projectPath: string): Promise<CodeScanResult> {
    const scanId = this.generateScanId('code');
    const issues: CodeIssue[] = [];

    try {
      const sourceFiles = await this.findSourceFiles(projectPath);

      for (const file of sourceFiles) {
        const fileIssues = await this.scanSourceFile(file);
        issues.push(...fileIssues);
      }

      return {
        scanId,
        timestamp: new Date().toISOString(),
        filesScanned: sourceFiles.length,
        totalIssues: issues.length,
        issues: this.groupIssuesBySeverity(issues)
      };
    } catch (error) {
      throw new Error(`Code scanning failed: ${error}`);
    }
  }

  /**
   * Scan configuration files for security misconfigurations
   */
  async scanConfiguration(projectPath: string): Promise<ConfigurationScanResult> {
    const scanId = this.generateScanId('config');
    const issues: ConfigurationIssue[] = [];

    try {
      const configFiles = await this.findConfigurationFiles(projectPath);

      for (const file of configFiles) {
        const fileIssues = await this.scanConfigurationFile(file);
        issues.push(...fileIssues);
      }

      return {
        scanId,
        timestamp: new Date().toISOString(),
        filesChecked: configFiles.length,
        totalIssues: issues.length,
        issues
      };
    } catch (error) {
      throw new Error(`Configuration scanning failed: ${error}`);
    }
  }

  /**
   * Scan infrastructure as code for security issues
   */
  async scanInfrastructure(projectPath: string): Promise<InfrastructureScanResult> {
    const scanId = this.generateScanId('infra');
    const issues: InfrastructureIssue[] = [];

    try {
      // Docker files
      const dockerFiles = await this.findDockerFiles(projectPath);
      for (const file of dockerFiles) {
        const dockerIssues = await this.scanDockerFile(file);
        issues.push(...dockerIssues);
      }

      // Kubernetes manifests
      const k8sFiles = await this.findKubernetesFiles(projectPath);
      for (const file of k8sFiles) {
        const k8sIssues = await this.scanKubernetesFile(file);
        issues.push(...k8sIssues);
      }

      // Terraform files
      const tfFiles = await this.findTerraformFiles(projectPath);
      for (const file of tfFiles) {
        const tfIssues = await this.scanTerraformFile(file);
        issues.push(...tfIssues);
      }

      return {
        scanId,
        timestamp: new Date().toISOString(),
        servicesChecked: dockerFiles.length + k8sFiles.length + tfFiles.length,
        totalIssues: issues.length,
        issues
      };
    } catch (error) {
      throw new Error(`Infrastructure scanning failed: ${error}`);
    }
  }

  private async scanNpmDependencies(projectPath: string): Promise<DependencyVulnerability[]> {
    try {
      // Use npm audit
      const { stdout } = await execAsync('npm audit --json', { cwd: projectPath });
      const auditResult = JSON.parse(stdout);

      const vulnerabilities: DependencyVulnerability[] = [];

      if (auditResult.vulnerabilities) {
        for (const [packageName, vulnData] of Object.entries(auditResult.vulnerabilities as any)) {
          for (const vuln of vulnData.vulnerabilities || []) {
            vulnerabilities.push({
              package: packageName,
              version: vulnData.version,
              vulnerability: {
                id: vuln.source || `${packageName}-${vuln.title}`,
                type: 'dependency',
                severity: this.mapNpmSeverity(vuln.severity),
                description: vuln.title || vuln.url || 'Unknown vulnerability',
                location: `package.json: ${packageName}@${vulnData.version}`,
                cve: vuln.cwe ? `CWE-${vuln.cwe}` : undefined,
                cvssScore: vuln.severity === 'critical' ? 9.0 : vuln.severity === 'high' ? 7.5 : vuln.severity === 'moderate' ? 5.0 : 3.0,
                remediation: vuln.fixAvailable?.version ? `Update to ${vuln.fixAvailable.version}` : 'No fix available',
                references: vuln.url ? [vuln.url] : []
              }
            });
          }
        }
      }

      return vulnerabilities;
    } catch (error) {
      console.error('npm audit failed:', error);
      return [];
    }
  }

  private async scanPythonDependencies(projectPath: string): Promise<DependencyVulnerability[]> {
    try {
      // Use safety
      const { stdout } = await execAsync('safety check --json', { cwd: projectPath });
      const safetyResult = JSON.parse(stdout);

      return safetyResult.vulnerabilities.map((vuln: any) => ({
        package: vuln.package,
        version: vuln.installed_version,
        vulnerability: {
          id: vuln.advisory_id || vuln.cve || `${vuln.package}-${vuln.id}`,
          type: 'dependency',
          severity: this.mapSafetySeverity(vuln.severity),
          description: vuln.advisory || vuln.analysis || 'Vulnerability detected',
          location: `requirements.txt: ${vuln.package}@${vuln.installed_version}`,
          cve: vuln.cve,
          cvssScore: vuln.cvss_score || undefined,
          remediation: `Update to safe version: ${vuln.fixed_versions?.join(', ') || 'unknown'}`,
          references: vuln.url ? [vuln.url] : []
        }
      }));
    } catch (error) {
      console.error('safety check failed:', error);
      return [];
    }
  }

  private async scanRustDependencies(projectPath: string): Promise<DependencyVulnerability[]> {
    try {
      // Use cargo audit
      const { stdout } = await execAsync('cargo audit --json', { cwd: projectPath });
      const auditResult = JSON.parse(stdout);

      const vulnerabilities: DependencyVulnerability[] = [];

      for (const vuln of auditResult.vulnerabilities?.list || []) {
        for (const affected of vuln.affected || []) {
          vulnerabilities.push({
            package: affected.name || vuln.advisory.package,
            version: affected.version || 'unknown',
            vulnerability: {
              id: vuln.advisory.id || `${vuln.advisory.package}-${vuln.advisory.title}`,
              type: 'dependency',
              severity: this.mapCargoAuditSeverity(vuln.advisory.severity),
              description: vuln.advisory.description || vuln.advisory.title || 'Vulnerability detected',
              location: `Cargo.toml: ${affected.name}@${affected.version}`,
              cve: vuln.advisory.cve,
              cvssScore: vuln.advisory.cvss,
              remediation: `Update to patched version. See advisory for details.`,
              references: vuln.advisory.url ? [vuln.advisory.url] : []
            }
          });
        }
      }

      return vulnerabilities;
    } catch (error) {
      console.error('cargo audit failed:', error);
      return [];
    }
  }

  private async scanSourceFile(filePath: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');

    // Common security patterns to detect
    const securityPatterns = [
      {
        pattern: /eval\s*\(/gi,
        type: 'dangerous-function',
        severity: 'high',
        message: 'Use of eval() function can lead to code injection'
      },
      {
        pattern: /innerHTML\s*=/gi,
        type: 'xss-vulnerability',
        severity: 'high',
        message: 'innerHTML assignment can lead to XSS attacks'
      },
      {
        pattern: /document\.write\s*\(/gi,
        type: 'xss-vulnerability',
        severity: 'high',
        message: 'document.write() can lead to XSS attacks'
      },
      {
        pattern: /exec\s*\(/gi,
        type: 'command-injection',
        severity: 'critical',
        message: 'exec() function can lead to command injection'
      },
      {
        pattern: /system\s*\(/gi,
        type: 'command-injection',
        severity: 'critical',
        message: 'system() function can lead to command injection'
      },
      {
        pattern: /password\s*=\s*["'][^"']+["']/gi,
        type: 'hardcoded-password',
        severity: 'high',
        message: 'Hardcoded password detected'
      },
      {
        pattern: /api[_-]?key\s*=\s*["'][^"']+["']/gi,
        type: 'hardcoded-secret',
        severity: 'high',
        message: 'Hardcoded API key detected'
      },
      {
        pattern: /mysql_query\s*\(/gi,
        type: 'sql-injection',
        severity: 'high',
        message: 'Potential SQL injection vulnerability'
      },
      {
        pattern: /SELECT.*FROM.*WHERE.*\+/gi,
        type: 'sql-injection',
        severity: 'medium',
        message: 'Potential SQL injection through string concatenation'
      }
    ];

    lines.forEach((line, index) => {
      securityPatterns.forEach(({ pattern, type, severity, message }) => {
        if (pattern.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            type,
            severity,
            message,
            ruleId: `SEC-${type.toUpperCase()}`,
            code: line.trim()
          });
        }
      });
    });

    // Language-specific scanning
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case '.js':
      case '.ts':
        issues.push(...await this.scanJavaScriptFile(filePath, content));
        break;
      case '.py':
        issues.push(...await this.scanPythonFile(filePath, content));
        break;
      case '.java':
        issues.push(...await this.scanJavaFile(filePath, content));
        break;
      case '.cs':
        issues.push(...await this.scanCSharpFile(filePath, content));
        break;
    }

    return issues;
  }

  private async scanJavaScriptFile(filePath: string, content: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    // JavaScript-specific security patterns
    const jsPatterns = [
      {
        pattern: /\$\..*\.(html|append|prepend|after|before)\s*\(/gi,
        type: 'xss-vulnerability',
        severity: 'high',
        message: 'jQuery HTML insertion can lead to XSS attacks'
      },
      {
        pattern: /crypto\.createHash\s*\(\s*['"`]md5['"`]\s*\)/gi,
        type: 'weak-cryptography',
        severity: 'medium',
        message: 'MD5 hash is cryptographically weak'
      },
      {
        pattern: /crypto\.createHash\s*\(\s*['"`]sha1['"`]\s*\)/gi,
        type: 'weak-cryptography',
        severity: 'medium',
        message: 'SHA1 hash is cryptographically weak'
      },
      {
        pattern: /Math\.random\s*\(\s*\)/gi,
        type: 'weak-randomness',
        severity: 'medium',
        message: 'Math.random() is not cryptographically secure'
      },
      {
        pattern: /process\.env\.[A-Z_]+\s*\|\|\s*["'][^"']+["']/gi,
        type: 'hardcoded-secret-fallback',
        severity: 'medium',
        message: 'Hardcoded fallback for environment variable'
      }
    ];

    lines.forEach((line, index) => {
      jsPatterns.forEach(({ pattern, type, severity, message }) => {
        if (pattern.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            type,
            severity,
            message,
            ruleId: `JS-SEC-${type.toUpperCase()}`,
            code: line.trim()
          });
        }
      });
    });

    return issues;
  }

  private async scanPythonFile(filePath: string, content: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    // Python-specific security patterns
    const pythonPatterns = [
      {
        pattern: /subprocess\.call\s*\([^,)]*\)/gi,
        type: 'command-injection',
        severity: 'high',
        message: 'subprocess.call without shell=True can be vulnerable'
      },
      {
        pattern: /pickle\.loads?\s*\(/gi,
        type: 'insecure-deserialization',
        severity: 'high',
        message: 'Pickle deserialization can execute arbitrary code'
      },
      {
        pattern: /exec\s*\(/gi,
        type: 'code-injection',
        severity: 'critical',
        message: 'exec() function can execute arbitrary code'
      },
      {
        pattern: /hashlib\.md5\s*\(/gi,
        type: 'weak-cryptography',
        severity: 'medium',
        message: 'MD5 hash is cryptographically weak'
      },
      {
        pattern: /random\.randint|random\.choice|random\.random/gi,
        type: 'weak-randomness',
        severity: 'medium',
        message: 'random module is not cryptographically secure'
      }
    ];

    lines.forEach((line, index) => {
      pythonPatterns.forEach(({ pattern, type, severity, message }) => {
        if (pattern.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            type,
            severity,
            message,
            ruleId: `PY-SEC-${type.toUpperCase()}`,
            code: line.trim()
          });
        }
      });
    });

    return issues;
  }

  private async scanJavaFile(filePath: string, content: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    // Java-specific security patterns
    const javaPatterns = [
      {
        pattern: /Runtime\.getRuntime\(\)\.exec\s*\(/gi,
        type: 'command-injection',
        severity: 'high',
        message: 'Runtime.exec can lead to command injection'
      },
      {
        pattern: /Class\.forName\s*\(/gi,
        type: 'reflection-abuse',
        severity: 'medium',
        message: 'Reflection can bypass security controls'
      },
      {
        pattern: /MessageDigest\.getInstance\s*\(\s*["']MD5["']\s*\)/gi,
        type: 'weak-cryptography',
        severity: 'medium',
        message: 'MD5 hash is cryptographically weak'
      },
      {
        pattern: /SecureRandom\.getInstance\s*\(\s*["']SHA1PRNG["']\s*\)/gi,
        type: 'weak-randomness',
        severity: 'low',
        message: 'SHA1PRNG has known weaknesses'
      }
    ];

    lines.forEach((line, index) => {
      javaPatterns.forEach(({ pattern, type, severity, message }) => {
        if (pattern.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            type,
            severity,
            message,
            ruleId: `JAVA-SEC-${type.toUpperCase()}`,
            code: line.trim()
          });
        }
      });
    });

    return issues;
  }

  private async scanCSharpFile(filePath: string, content: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    // C#-specific security patterns
    const csharpPatterns = [
      {
        pattern: /Process\.Start\s*\(/gi,
        type: 'command-injection',
        severity: 'high',
        message: 'Process.Start can lead to command injection'
      },
      {
        pattern: /Assembly\.LoadFrom\s*\(/gi,
        type: 'assembly-injection',
        severity: 'medium',
        message: 'Loading assemblies can be dangerous'
      },
      {
        pattern: /MD5CryptoServiceProvider/gi,
        type: 'weak-cryptography',
        severity: 'medium',
        message: 'MD5 is cryptographically weak'
      },
      {
        pattern: /SHA1CryptoServiceProvider/gi,
        type: 'weak-cryptography',
        severity: 'medium',
        message: 'SHA1 is cryptographically weak'
      }
    ];

    lines.forEach((line, index) => {
      csharpPatterns.forEach(({ pattern, type, severity, message }) => {
        if (pattern.test(line)) {
          issues.push({
            file: filePath,
            line: index + 1,
            type,
            severity,
            message,
            ruleId: `CS-SEC-${type.toUpperCase()}`,
            code: line.trim()
          });
        }
      });
    });

    return issues;
  }

  private async scanConfigurationFile(filePath: string): Promise<ConfigurationIssue[]> {
    const issues: ConfigurationIssue[] = [];
    const content = await readFile(filePath, 'utf8');
    const fileName = filePath.split('/').pop() || '';

    // Configuration-specific security checks
    const configChecks: ConfigCheck[] = [
      {
        fileName: 'docker-compose.yml',
        patterns: [
          {
            pattern: /privileged:\s*true/gi,
            issue: 'Privileged mode enabled',
            severity: 'high',
            recommendation: 'Remove privileged mode unless absolutely necessary'
          },
          {
            pattern: /--cap-add\s+ALL/gi,
            issue: 'All capabilities added',
            severity: 'high',
            recommendation: 'Only add specific capabilities needed'
          }
        ]
      },
      {
        fileName: 'Dockerfile',
        patterns: [
          {
            pattern: /USER\s+root/gi,
            issue: 'Running as root user',
            severity: 'medium',
            recommendation: 'Use non-root user'
          },
          {
            pattern: /ADD\s+http/gi,
            issue: 'Adding files from HTTP',
            severity: 'medium',
            recommendation: 'Use HTTPS or copy local files'
          }
        ]
      }
    ];

    const relevantCheck = configChecks.find(check => fileName === check.fileName);
    if (relevantCheck) {
      relevantCheck.patterns.forEach(({ pattern, issue, severity, recommendation }) => {
        if (pattern.test(content)) {
          issues.push({
            file: filePath,
            parameter: issue,
            currentValue: 'Detected',
            recommendedValue: recommendation,
            severity,
            rationale: this.getConfigurationRationale(issue)
          });
        }
      });
    }

    // General configuration checks
    const generalPatterns = [
      {
        pattern: /(password|secret|key)\s*=\s*["'][^"']+["']/gi,
        issue: 'Hardcoded credential',
        severity: 'critical',
        recommendation: 'Use environment variables or secret management'
      },
      {
        pattern: /debug\s*=\s*true/gi,
        issue: 'Debug mode enabled',
        severity: 'medium',
        recommendation: 'Disable debug mode in production'
      }
    ];

    generalPatterns.forEach(({ pattern, issue, severity, recommendation }) => {
      if (pattern.test(content)) {
        issues.push({
          file: filePath,
          parameter: issue,
          currentValue: 'Detected',
          recommendedValue: recommendation,
          severity,
          rationale: this.getConfigurationRationale(issue)
        });
      }
    });

    return issues;
  }

  private async scanDockerFile(filePath: string): Promise<InfrastructureIssue[]> {
    const issues: InfrastructureIssue[] = [];
    const content = await readFile(filePath, 'utf8');

    const dockerChecks = [
      {
        pattern: /FROM.*:latest/gi,
        issue: 'Using latest tag',
        severity: 'medium',
        recommendation: 'Use specific version tags for reproducibility'
      },
      {
        pattern: /USER\s+root/gi,
        issue: 'Running as root',
        severity: 'high',
        recommendation: 'Create and use non-root user'
      },
      {
        pattern: /ADD\s+http/gi,
        issue: 'Adding files via HTTP',
        severity: 'medium',
        recommendation: 'Use HTTPS or copy from secure source'
      }
    ];

    dockerChecks.forEach(({ pattern, issue, severity, recommendation }) => {
      if (pattern.test(content)) {
        issues.push({
          service: 'Docker',
          issue,
          severity,
          recommendation
        });
      }
    });

    return issues;
  }

  private async scanKubernetesFile(filePath: string): Promise<InfrastructureIssue[]> {
    const issues: InfrastructureIssue[] = [];
    const content = await readFile(filePath, 'utf8');

    const k8sChecks = [
      {
        pattern: /runAsUser:\s*0/gi,
        issue: 'Running as root user',
        severity: 'high',
        recommendation: 'Use non-root user in pod security context'
      },
      {
        pattern: /allowPrivilegeEscalation:\s*true/gi,
        issue: 'Privilege escalation allowed',
        severity: 'high',
        recommendation: 'Disable privilege escalation'
      },
      {
        pattern: /readOnlyRootFilesystem:\s*false/gi,
        issue: 'Writable root filesystem',
        severity: 'medium',
        recommendation: 'Set filesystem to read-only where possible'
      }
    ];

    k8sChecks.forEach(({ pattern, issue, severity, recommendation }) => {
      if (pattern.test(content)) {
        issues.push({
          service: 'Kubernetes',
          issue,
          severity,
          recommendation
        });
      }
    });

    return issues;
  }

  private async scanTerraformFile(filePath: string): Promise<InfrastructureIssue[]> {
    const issues: InfrastructureIssue[] = [];
    const content = await readFile(filePath, 'utf8');

    const terraformChecks = [
      {
        pattern: /associate_public_ip_address\s*=\s*true/gi,
        issue: 'Public IP assigned by default',
        severity: 'medium',
        recommendation: 'Only assign public IPs when necessary'
      },
      {
        pattern: /ssh_keys\s*=/gi,
        issue: 'SSH key management in code',
        severity: 'medium',
        recommendation: 'Use proper key management services'
      },
      {
        pattern: /password\s*=/gi,
        issue: 'Password in configuration',
        severity: 'critical',
        recommendation: 'Use secret management for passwords'
      }
    ];

    terraformChecks.forEach(({ pattern, issue, severity, recommendation }) => {
      if (pattern.test(content)) {
        issues.push({
          service: 'Terraform',
          issue,
          severity,
          recommendation
        });
      }
    });

    return issues;
  }

  // Helper methods
  private generateScanId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.c', '.cpp', '.go', '.rb', '.php'];
    // Implementation would recursively find files with these extensions
    return [];
  }

  private async findConfigurationFiles(projectPath: string): Promise<string[]> {
    const configFiles = [
      'package.json', 'tsconfig.json', 'webpack.config.js',
      'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
      '.env', '.env.example', 'config.json', 'settings.py'
    ];
    // Implementation would find these files
    return configFiles.map(file => join(projectPath, file)).filter(file => this.fileExists(file));
  }

  private async findDockerFiles(projectPath: string): Promise<string[]> {
    return []; // Implementation would find Docker-related files
  }

  private async findKubernetesFiles(projectPath: string): Promise<string[]> {
    return []; // Implementation would find Kubernetes manifests
  }

  private async findTerraformFiles(projectPath: string): Promise<string[]> {
    return []; // Implementation would find Terraform files
  }

  private async countDependencies(projectPath: string): Promise<number> {
    // Implementation would count dependencies from package managers
    return 0;
  }

  private groupIssuesBySeverity(issues: CodeIssue[]): CodeIssue[] {
    return issues; // Already grouped by individual issue severity
  }

  private mapNpmSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'moderate': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private mapSafetySeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'high': return 'critical';
      case 'medium': return 'high';
      case 'low': return 'medium';
      default: return 'low';
    }
  }

  private mapCargoAuditSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private getConfigurationRationale(issue: string): string {
    const rationales: Record<string, string> = {
      'Hardcoded credential': 'Credentials in configuration files can be exposed through version control',
      'Debug mode enabled': 'Debug mode can expose sensitive information and bypass security controls',
      'Privileged mode enabled': 'Privileged mode gives container extended capabilities that can be exploited',
      'Running as root': 'Running as root increases attack surface and potential damage',
      'Adding files from HTTP': 'HTTP connections can be intercepted and files modified'
    };
    return rationales[issue] || 'Security best practice recommendation';
  }

  private async updateVulnerabilityDatabase(): Promise<void> {
    // Implementation would update vulnerability databases from NVD, GitHub, etc.
  }
}

// Type definitions
export interface DependencyScanResult {
  scanId: string;
  timestamp: string;
  totalDependencies: number;
  vulnerableDependencies: number;
  vulnerabilities: DependencyVulnerability[];
}

export interface DependencyVulnerability {
  package: string;
  version: string;
  vulnerability: {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    location: string;
    cve?: string;
    cvssScore?: number;
    remediation: string;
    references: string[];
  };
}

export interface CodeScanResult {
  scanId: string;
  timestamp: string;
  filesScanned: number;
  totalIssues: number;
  issues: CodeIssue[];
}

export interface CodeIssue {
  file: string;
  line: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  ruleId: string;
  code?: string;
}

export interface ConfigurationScanResult {
  scanId: string;
  timestamp: string;
  filesChecked: number;
  totalIssues: number;
  issues: ConfigurationIssue[];
}

export interface ConfigurationIssue {
  file: string;
  parameter: string;
  currentValue: string;
  recommendedValue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
}

export interface InfrastructureScanResult {
  scanId: string;
  timestamp: string;
  servicesChecked: number;
  totalIssues: number;
  issues: InfrastructureIssue[];
}

export interface InfrastructureIssue {
  service: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

interface ConfigCheck {
  fileName: string;
  patterns: {
    pattern: RegExp;
    issue: string;
    severity: string;
    recommendation: string;
  }[];
}