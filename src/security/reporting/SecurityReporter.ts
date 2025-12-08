/**
 * Security Reporting and Metrics System
 * Comprehensive security reporting with real-time dashboards and analytics
 */

import { createHash, randomBytes } from 'crypto';
import { SecurityConfig } from '../core/SecurityConfig.js';
import { SecurityReport } from '../core/SecurityFramework.js';

export class SecurityReporter {
  private config: SecurityConfig;
  private metricsCollector: MetricsCollector;
  private dashboardGenerator: DashboardGenerator;
  private reportGenerator: ReportGenerator;
  private alertManager: AlertManager;
  private dataAnalyzer: DataAnalyzer;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.metricsCollector = new MetricsCollector(config);
    this.dashboardGenerator = new DashboardGenerator(config);
    this.reportGenerator = new ReportGenerator(config);
    this.alertManager = new AlertManager(config);
    this.dataAnalyzer = new DataAnalyzer(config);
  }

  async initialize(): Promise<void> {
    await this.metricsCollector.initialize();
    await this.dashboardGenerator.initialize();
    await this.reportGenerator.initialize();
    await this.alertManager.initialize();
    await this.dataAnalyzer.initialize();
  }

  /**
   * Generate comprehensive security report
   */
  async generateReport(timeframe: ReportTimeframe, format: 'html' | 'pdf' | 'json' | 'csv' = 'html'): Promise<GeneratedReport> {
    try {
      const reportId = this.generateReportId();

      // Collect data for the report
      const [
        scanMetrics,
        threatMetrics,
        authMetrics,
        policyMetrics,
        vulnerabilityMetrics,
        complianceMetrics
      ] = await Promise.all([
        this.metricsCollector.getScanMetrics(timeframe),
        this.metricsCollector.getThreatMetrics(timeframe),
        this.metricsCollector.getAuthMetrics(timeframe),
        this.metricsCollector.getPolicyMetrics(timeframe),
        this.metricsCollector.getVulnerabilityMetrics(timeframe),
        this.metricsCollector.getComplianceMetrics(timeframe)
      ]);

      // Analyze trends and patterns
      const trends = await this.dataAnalyzer.analyzeTrends(timeframe);
      const patterns = await this.dataAnalyzer.identifyPatterns(timeframe);

      // Calculate overall security score
      const overallScore = this.calculateOverallSecurityScore({
        scanMetrics,
        threatMetrics,
        authMetrics,
        policyMetrics,
        vulnerabilityMetrics,
        complianceMetrics
      });

      // Generate report data
      const reportData: SecurityReport = {
        timeframe,
        overallSecurityScore,
        scanMetrics,
        threatMetrics,
        authMetrics,
        policyMetrics,
        vulnerabilityMetrics,
        complianceMetrics,
        trends,
        patterns,
        recommendations: await this.generateRecommendations({
          scanMetrics,
          threatMetrics,
          authMetrics,
          policyMetrics,
          vulnerabilityMetrics,
          complianceMetrics
        }),
        generatedAt: new Date().toISOString(),
        reportId
      };

      // Format report based on requested format
      let reportContent: any;
      let mimeType: string;

      switch (format) {
        case 'html':
          reportContent = await this.reportGenerator.generateHTML(reportData);
          mimeType = 'text/html';
          break;
        case 'pdf':
          reportContent = await this.reportGenerator.generatePDF(reportData);
          mimeType = 'application/pdf';
          break;
        case 'json':
          reportContent = reportData;
          mimeType = 'application/json';
          break;
        case 'csv':
          reportContent = await this.reportGenerator.generateCSV(reportData);
          mimeType = 'text/csv';
          break;
        default:
          throw new Error(`Unsupported report format: ${format}`);
      }

      return {
        reportId,
        content: reportContent,
        format,
        mimeType,
        generatedAt: new Date().toISOString(),
        size: JSON.stringify(reportContent).length
      };
    } catch (error) {
      throw new Error(`Report generation failed: ${error}`);
    }
  }

  /**
   * Generate real-time security dashboard
   */
  async generateDashboard(timeframe: DashboardTimeframe): Promise<SecurityDashboard> {
    try {
      // Collect real-time metrics
      const [
        currentThreats,
        systemHealth,
        activeAlerts,
        recentScans,
        complianceStatus,
        keyMetrics
      ] = await Promise.all([
          this.metricsCollector.getCurrentThreats(),
          this.metricsCollector.getSystemHealth(),
          this.metricsCollector.getActiveAlerts(),
          this.metricsCollector.getRecentScans(timeframe),
          this.metricsCollector.getComplianceStatus(),
          this.metricsCollector.getKeyMetrics()
      ]);

      // Generate dashboard components
      const dashboard: SecurityDashboard = {
        id: this.generateDashboardId(),
        timeframe,
        generatedAt: new Date().toISOString(),
        summary: {
          overallScore: this.calculateDashboardScore(keyMetrics),
          threatLevel: this.calculateThreatLevel(currentThreats),
          systemHealth: systemHealth.status,
          complianceStatus: complianceStatus.status
        },
        widgets: {
          threatsOverview: await this.dashboardGenerator.generateThreatsWidget(currentThreats),
          systemHealth: await this.dashboardGenerator.generateHealthWidget(systemHealth),
          alerts: await this.dashboardGenerator.generateAlertsWidget(activeAlerts),
          scans: await this.dashboardGenerator.generateScansWidget(recentScans),
          compliance: await this.dashboardGenerator.generateComplianceWidget(complianceStatus),
          metrics: await this.dashboardGenerator.generateMetricsWidget(keyMetrics)
        },
        charts: await this.dashboardGenerator.generateCharts(timeframe),
        recommendations: await this.generateDashboardRecommendations({
          currentThreats,
          systemHealth,
          activeAlerts,
          complianceStatus,
          keyMetrics
        })
      };

      return dashboard;
    } catch (error) {
      throw new Error(`Dashboard generation failed: ${error}`);
    }
  }

  /**
   * Get security metrics summary
   */
  async getMetricsSummary(timeframe: MetricsTimeframe): Promise<SecurityMetricsSummary> {
    const [
      scanSummary,
      threatSummary,
      authSummary,
      policySummary,
      vulnerabilitySummary
    ] = await Promise.all([
        this.metricsCollector.getScanSummary(timeframe),
        this.metricsCollector.getThreatSummary(timeframe),
        this.metricsCollector.getAuthSummary(timeframe),
        this.metricsCollector.getPolicySummary(timeframe),
        this.metricsCollector.getVulnerabilitySummary(timeframe)
    ]);

    return {
      timeframe,
      overallScore: this.calculateOverallScore({
        scanSummary,
        threatSummary,
        authSummary,
        policySummary,
        vulnerabilitySummary
      }),
      scan: scanSummary,
      threats: threatSummary,
      authentication: authSummary,
      policies: policySummary,
      vulnerabilities: vulnerabilitySummary,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(standards: ComplianceStandard[], timeframe: ReportTimeframe): Promise<ComplianceReport> {
    try {
      const complianceResults = [];

      for (const standard of standards) {
        const result = await this.assessCompliance(standard, timeframe);
        complianceResults.push(result);
      }

      const overallCompliance = this.calculateOverallCompliance(complianceResults);
      const recommendations = this.generateComplianceRecommendations(complianceResults);

      return {
        standards,
        timeframe,
        overallCompliance,
        results: complianceResults,
        recommendations,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Compliance report generation failed: ${error}`);
    }
  }

  /**
   * Export security data
   */
  async exportData(exportRequest: SecurityDataExportRequest): Promise<ExportResult> {
    try {
      const exportId = this.generateExportId();
      const data = await this.collectExportData(exportRequest);

      let exportContent: any;
      let fileName: string;

      switch (exportRequest.format) {
        case 'json':
          exportContent = JSON.stringify(data, null, 2);
          fileName = `security-export-${exportId}.json`;
          break;
        case 'csv':
          exportContent = await this.convertToCSV(data);
          fileName = `security-export-${exportId}.csv`;
          break;
        case 'excel':
          exportContent = await this.convertToExcel(data);
          fileName = `security-export-${exportId}.xlsx`;
          break;
        default:
          throw new Error(`Unsupported export format: ${exportRequest.format}`);
      }

      // Apply encryption if requested
      if (exportRequest.encrypt) {
        exportContent = await this.encryptData(exportContent);
      }

      return {
        exportId,
        fileName,
        content: exportContent,
        format: exportRequest.format,
        recordCount: data.length,
        exportedAt: new Date().toISOString(),
        integrityHash: this.calculateDataHash(exportContent)
      };
    } catch (error) {
      throw new Error(`Data export failed: ${error}`);
    }
  }

  /**
   * Schedule automated reports
   */
  async scheduleReport(reportConfig: ScheduledReportConfig): Promise<string> {
    const scheduleId = this.generateScheduleId();

    // Implementation would set up scheduled report generation
    // This could use cron jobs, GitHub Actions, or other scheduling mechanisms

    return scheduleId;
  }

  /**
   * Get real-time security alerts
   */
  async getRealtimeAlerts(timeframe: AlertTimeframe): Promise<RealtimeAlerts> {
    const [
      criticalAlerts,
      warningAlerts,
      infoAlerts,
      recentAlerts
    ] = await Promise.all([
      this.alertManager.getAlertsBySeverity('critical', timeframe),
      this.alertManager.getAlertsBySeverity('warning', timeframe),
      this.alertManager.getAlertsBySeverity('info', timeframe),
      this.alertManager.getRecentAlerts(timeframe)
    ]);

    return {
      critical: criticalAlerts,
      warning: warningAlerts,
      info: infoAlerts,
      recent: recentAlerts,
      summary: {
        total: criticalAlerts.length + warningAlerts.length + infoAlerts.length,
        criticalCount: criticalAlerts.length,
        warningCount: warningAlerts.length,
        infoCount: infoAlerts.length
      }
    };
  }

  // Private helper methods
  private calculateOverallSecurityScore(metrics: any): number {
    const weights = {
      scan: 0.2,
      threats: 0.25,
      auth: 0.2,
      policies: 0.15,
      vulnerabilities: 0.2
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      const score = this.getComponentScore(metrics[`${key}Metrics`]);
      totalScore += score * weight;
      totalWeight += weight;
    });

    return Math.round(totalScore / totalWeight);
  }

  private getComponentScore(componentMetrics: any): number {
    if (!componentMetrics) return 50; // Default score

    // Implementation would calculate component-specific score
    return Math.max(0, Math.min(100, componentMetrics.score || 50));
  }

  private calculateDashboardScore(keyMetrics: any): number {
    // Implementation would calculate dashboard-specific score
    return 85;
  }

  private calculateThreatLevel(threats: any[]): string {
    if (!threats || threats.length === 0) return 'low';

    const criticalThreats = threats.filter(t => t.severity === 'critical').length;
    const highThreats = threats.filter(t => t.severity === 'high').length;

    if (criticalThreats > 0) return 'critical';
    if (highThreats > 0) return 'high';
    if (threats.length > 5) return 'medium';
    return 'low';
  }

  private async generateRecommendations(metrics: any): Promise<string[]> {
    const recommendations: string[] = [];

    // Scan recommendations
    if (metrics.scanMetrics && metrics.scanMetrics.failedScans > 0) {
      recommendations.push('Investigate and fix failed security scans');
    }

    // Threat recommendations
    if (metrics.threatMetrics && metrics.threatMetrics.activeThreats > 0) {
      recommendations.push('Address active security threats immediately');
    }

    // Authentication recommendations
    if (metrics.authMetrics && metrics.authMetrics.failedAuthRate > 5) {
      recommendations.push('Review authentication policies and implement additional security measures');
    }

    // Policy recommendations
    if (metrics.policyMetrics && metrics.policyMetrics.violations > 0) {
      recommendations.push('Address policy violations and improve compliance');
    }

    // Vulnerability recommendations
    if (metrics.vulnerabilityMetrics && metrics.vulnerabilityMetrics.criticalVulns > 0) {
      recommendations.push('Prioritize and fix critical vulnerabilities');
    }

    return recommendations;
  }

  private async generateDashboardRecommendations(context: any): Promise<string[]> {
    const recommendations: string[] = [];

    if (context.currentThreats && context.currentThreats.length > 0) {
      recommendations.push('Immediate attention required for active threats');
    }

    if (context.systemHealth && context.systemHealth.status !== 'healthy') {
      recommendations.push('System health issues need investigation');
    }

    if (context.activeAlerts && context.activeAlerts.length > 5) {
      recommendations.push('High number of active alerts - review security posture');
    }

    if (context.complianceStatus && context.complianceStatus.status !== 'compliant') {
      recommendations.push('Compliance issues need to be addressed');
    }

    return recommendations;
  }

  private async assessCompliance(standard: ComplianceStandard, timeframe: ReportTimeframe): Promise<ComplianceResult> {
    // Implementation would assess compliance against specific standard
    return {
      standard: standard.name,
      framework: standard.framework,
      score: 85,
      requirements: [],
      violations: [],
      status: 'compliant'
    };
  }

  private calculateOverallCompliance(results: ComplianceResult[]): OverallCompliance {
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    const averageScore = Math.round(totalScore / results.length);

    const compliantCount = results.filter(result => result.status === 'compliant').length;
    const status = compliantCount === results.length ? 'compliant' :
                     compliantCount > results.length / 2 ? 'partially_compliant' : 'non_compliant';

    return {
      score: averageScore,
      status,
      compliantStandards: compliantCount,
      totalStandards: results.length
    };
  }

  private generateComplianceRecommendations(results: ComplianceResult[]): string[] {
    return results
      .filter(result => result.status !== 'compliant')
      .map(result => `Address ${result.framework} compliance issues for ${result.standard}`);
  }

  private async collectExportData(request: SecurityDataExportRequest): Promise<any[]> {
    // Implementation would collect data for export based on request
    return [];
  }

  private async convertToCSV(data: any[]): Promise<string> {
    // Implementation would convert data to CSV format
    return 'csv,data';
  }

  private async convertToExcel(data: any[]): Promise<any> {
    // Implementation would convert data to Excel format
    return { worksheets: [] };
  }

  private async encryptData(data: any): Promise<EncryptedData> {
    // Implementation would encrypt data
    return {
      encrypted: data,
      algorithm: 'aes-256-gcm',
      keyId: 'default'
    };
  }

  private calculateDataHash(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateExportId(): string {
    return `export_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }
}

// Supporting classes
class MetricsCollector {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize metrics collection
  }

  async getScanMetrics(timeframe: ReportTimeframe): Promise<ScanMetrics> {
    // Implementation would collect scan metrics
    return {
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      averageScanTime: 0,
      criticalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0
    };
  }

  async getThreatMetrics(timeframe: ReportTimeframe): Promise<ThreatMetrics> {
    // Implementation would collect threat metrics
    return {
      totalThreats: 0,
      criticalThreats: 0,
      highThreats: 0,
      mediumThreats: 0,
      lowThreats: 0,
      threatsBlocked: 0,
      threatsInvestigating: 0,
      falsePositives: 0
    };
  }

  async getAuthMetrics(timeframe: ReportTimeframe): Promise<AuthMetrics> {
    // Implementation would collect auth metrics
    return {
      totalAuthAttempts: 0,
      successfulAuth: 0,
      failedAuth: 0,
      mfaUsage: 0,
      averageSessionDuration: 0,
      activeUsers: 0,
      blockedIPs: 0
    };
  }

  async getPolicyMetrics(timeframe: ReportTimeframe): Promise<PolicyMetrics> {
    // Implementation would collect policy metrics
    return {
      totalPolicyChecks: 0,
      violations: 0,
      policiesEnforced: 0,
      complianceRate: 0,
      autoRemediations: 0,
      policyUpdates: 0
    };
  }

  async getVulnerabilityMetrics(timeframe: ReportTimeframe): Promise<VulnerabilityMetrics> {
    // Implementation would collect vulnerability metrics
    return {
      totalVulnerabilities: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      fixed: 0,
      open: 0,
      timeToFix: 0
    };
  }

  async getComplianceMetrics(timeframe: ReportTimeframe): Promise<ComplianceMetrics> {
    // Implementation would collect compliance metrics
    return {
      overallCompliance: 0,
      owaspCompliance: 0,
      gdprCompliance: 0,
      soxCompliance: 0,
      pciCompliance: 0,
      hipaaCompliance: 0
    };
  }

  async getCurrentThreats(): Promise<any[]> {
    // Implementation would get current threats
    return [];
  }

  async getSystemHealth(): Promise<SystemHealth> {
    // Implementation would get system health
    return {
      status: 'healthy',
      uptime: 100,
      responseTime: 100,
      errorRate: 0
    };
  }

  async getActiveAlerts(): Promise<any[]> {
    // Implementation would get active alerts
    return [];
  }

  async getRecentScans(timeframe: DashboardTimeframe): Promise<any[]> {
    // Implementation would get recent scans
    return [];
  }

  async getComplianceStatus(): Promise<any> {
    // Implementation would get compliance status
    return {
      status: 'compliant'
    };
  }

  async getKeyMetrics(): Promise<any> {
    // Implementation would get key metrics
    return {};
  }

  async getScanSummary(timeframe: MetricsTimeframe): Promise<any> {
    return {};
  }

  async getThreatSummary(timeframe: MetricsTimeframe): Promise<any> {
    return {};
  }

  async getAuthSummary(timeframe: MetricsTimeframe): Promise<any> {
    return {};
  }

  async getPolicySummary(timeframe: MetricsTimeframe): Promise<any> {
    return {};
  }

  async getVulnerabilitySummary(timeframe: MetricsTimeframe): Promise<any> {
    return {};
  }
}

class DashboardGenerator {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize dashboard generation
  }

  async generateThreatsWidget(threats: any[]): Promise<DashboardWidget> {
    return {
      id: 'threats-overview',
      type: 'chart',
      title: 'Threats Overview',
      data: threats,
      config: {
        chartType: 'pie',
        colors: ['#ff6b6b', '#ffd43b', '#4ecdc4', '#45b7d1']
      }
    };
  }

  async generateHealthWidget(health: SystemHealth): Promise<DashboardWidget> {
    return {
      id: 'system-health',
      type: 'metric',
      title: 'System Health',
      data: health,
      config: {
        showTrend: true
      }
    };
  }

  async generateAlertsWidget(alerts: any[]): Promise<DashboardWidget> {
    return {
      id: 'active-alerts',
      type: 'list',
      title: 'Active Alerts',
      data: alerts,
      config: {
        maxItems: 10,
        sortBy: 'severity'
      }
    };
  }

  async generateScansWidget(scans: any[]): Promise<DashboardWidget> {
    return {
      id: 'recent-scans',
      type: 'table',
      title: 'Recent Security Scans',
      data: scans,
      config: {
        maxRows: 10
      }
    };
  }

  async generateComplianceWidget(compliance: any): Promise<DashboardWidget> {
    return {
      id: 'compliance-status',
      type: 'progress',
      title: 'Compliance Status',
      data: compliance,
      config: {
        showDetails: true
      }
    };
  }

  async generateMetricsWidget(metrics: any): Promise<DashboardWidget> {
    return {
      id: 'key-metrics',
      type: 'metrics',
      title: 'Key Security Metrics',
      data: metrics,
      config: {
        gridColumns: 3
      }
    };
  }

  async generateCharts(timeframe: DashboardTimeframe): Promise<DashboardChart[]> {
    // Implementation would generate dashboard charts
    return [];
  }
}

class ReportGenerator {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize report generation
  }

  async generateHTML(data: SecurityReport): Promise<string> {
    // Implementation would generate HTML report
    return '<html><body><h1>Security Report</h1></body></html>';
  }

  async generatePDF(data: SecurityReport): Promise<Buffer> {
    // Implementation would generate PDF report
    return Buffer.from('PDF Report');
  }

  async generateCSV(data: SecurityReport): Promise<string> {
    // Implementation would generate CSV report
    return 'csv,data';
  }
}

class AlertManager {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize alert management
  }

  async getAlertsBySeverity(severity: string, timeframe: AlertTimeframe): Promise<any[]> {
    // Implementation would get alerts by severity
    return [];
  }

  async getRecentAlerts(timeframe: AlertTimeframe): Promise<any[]> {
    // Implementation would get recent alerts
    return [];
  }
}

class DataAnalyzer {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize data analysis
  }

  async analyzeTrends(timeframe: ReportTimeframe): Promise<TrendAnalysis[]> {
    // Implementation would analyze trends
    return [];
  }

  async identifyPatterns(timeframe: ReportTimeframe): Promise<Pattern[]> {
    // Implementation would identify patterns
    return [];
  }
}

// Type definitions
export interface ReportTimeframe {
  start: string;
  end: string;
}

export interface DashboardTimeframe {
  period: '1h' | '6h' | '24h' | '7d' | '30d';
}

export interface MetricsTimeframe {
  start: string;
  end: string;
}

export interface AlertTimeframe {
  period: '1h' | '6h' | '24h' | '7d';
}

export interface GeneratedReport {
  reportId: string;
  content: any;
  format: string;
  mimeType: string;
  generatedAt: string;
  size: number;
}

export interface SecurityDashboard {
  id: string;
  timeframe: DashboardTimeframe;
  generatedAt: string;
  summary: {
    overallScore: number;
    threatLevel: string;
    systemHealth: string;
    complianceStatus: string;
  };
  widgets: {
    threatsOverview: DashboardWidget;
    systemHealth: DashboardWidget;
    alerts: DashboardWidget;
    scans: DashboardWidget;
    compliance: DashboardWidget;
    metrics: DashboardWidget;
  };
  charts: DashboardChart[];
  recommendations: string[];
}

export interface SecurityMetricsSummary {
  timeframe: MetricsTimeframe;
  overallScore: number;
  scan: any;
  threats: any;
  authentication: any;
  policies: any;
  vulnerabilities: any;
  generatedAt: string;
}

export interface ComplianceStandard {
  name: string;
  framework: string;
  requirements: string[];
}

export interface ComplianceReport {
  standards: ComplianceStandard[];
  timeframe: ReportTimeframe;
  overallCompliance: OverallCompliance;
  results: ComplianceResult[];
  recommendations: string[];
  generatedAt: string;
}

export interface ComplianceResult {
  standard: string;
  framework: string;
  score: number;
  requirements: any[];
  violations: any[];
  status: 'compliant' | 'partially_compliant' | 'non_compliant';
}

export interface OverallCompliance {
  score: number;
  status: 'compliant' | 'partially_compliant' | 'non_compliant';
  compliantStandards: number;
  totalStandards: number;
}

export interface SecurityDataExportRequest {
  timeframe: ReportTimeframe;
  format: 'json' | 'csv' | 'excel';
  dataTypes?: string[];
  encrypt?: boolean;
}

export interface ExportResult {
  exportId: string;
  fileName: string;
  content: any;
  format: string;
  recordCount: number;
  exportedAt: string;
  integrityHash: string;
}

export interface ScheduledReportConfig {
  name: string;
  type: 'compliance' | 'vulnerability' | 'threat' | 'summary';
  schedule: string; // cron expression
  recipients: string[];
  format: 'html' | 'pdf' | 'json';
  timeframe: ReportTimeframe;
}

export interface RealtimeAlerts {
  critical: any[];
  warning: any[];
  info: any[];
  recent: any[];
  summary: {
    total: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
}

export interface ScanMetrics {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  averageScanTime: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
}

export interface ThreatMetrics {
  totalThreats: number;
  criticalThreats: number;
  highThreats: number;
  mediumThreats: number;
  lowThreats: number;
  threatsBlocked: number;
  threatsInvestigating: number;
  falsePositives: number;
}

export interface AuthMetrics {
  totalAuthAttempts: number;
  successfulAuth: number;
  failedAuth: number;
  mfaUsage: number;
  averageSessionDuration: number;
  activeUsers: number;
  blockedIPs: number;
}

export interface PolicyMetrics {
  totalPolicyChecks: number;
  violations: number;
  policiesEnforced: number;
  complianceRate: number;
  autoRemediations: number;
  policyUpdates: number;
}

export interface VulnerabilityMetrics {
  totalVulnerabilities: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  fixed: number;
  open: number;
  timeToFix: number;
}

export interface ComplianceMetrics {
  overallCompliance: number;
  owaspCompliance: number;
  gdprCompliance: number;
  soxCompliance: number;
  pciCompliance: number;
  hipaaCompliance: number;
}

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  data: any;
  config: any;
}

export interface DashboardChart {
  id: string;
  type: string;
  title: string;
  data: any;
  config: any;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  responseTime: number;
  errorRate: number;
}

export interface TrendAnalysis {
  metric: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  dataPoints: any[];
}

export interface Pattern {
  type: string;
  description: string;
  confidence: number;
  occurrences: number;
}

export interface EncryptedData {
  encrypted: any;
  algorithm: string;
  keyId: string;
}