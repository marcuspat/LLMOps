/**
 * Security API Service
 */

import { apiClient } from './api';
import { ApiResponse, QueryParams } from '../types/frontend';

export interface SecurityScan {
  id: string;
  type: SecurityScanType;
  target: string;
  results: SecurityResult[];
  status: SecurityScanStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  config: SecurityScanConfig;
}

export type SecurityScanType =
  | 'sast'
  | 'dast'
  | 'dependency'
  | 'comprehensive'
  | 'container'
  | 'infrastructure';

export type SecurityScanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SecurityScanConfig {
  depth: 'basic' | 'standard' | 'deep';
  severity: 'all' | 'medium' | 'high' | 'critical';
  excludePatterns?: string[];
  includeTests?: boolean;
  timeout?: number;
}

export interface SecurityResult {
  id: string;
  severity: SecuritySeverity;
  type: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  cve?: string;
  cvss?: number;
  owaspCategory?: string;
  remediation: string;
  references: string[];
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
}

export type SecuritySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface SecurityAlert {
  id: string;
  type: SecurityAlertType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  status: SecurityAlertStatus;
  details: SecurityAlertDetails;
  actions: SecurityAction[];
  assignee?: string;
  dueDate?: Date;
  tags: string[];
}

export type SecurityAlertType =
  | 'vulnerability'
  | 'unauthorized-access'
  | 'data-leak'
  | 'malicious-code'
  | 'dependency-scan'
  | 'code-scan'
  | 'infrastructure'
  | 'compliance';

export type SecurityAlertStatus = 'open' | 'investigating' | 'resolved' | 'false-positive' | 'escalated';

export interface SecurityAlertDetails {
  cveId?: string;
  cvssScore?: number;
  affectedPackages?: string[];
  affectedFiles?: string[];
  affectedComponents?: string[];
  impact?: string;
  likelihood?: string;
  remediation?: string;
  references?: string[];
  metadata?: Record<string, any>;
}

export interface SecurityAction {
  id: string;
  type: SecurityActionType;
  description: string;
  automated: boolean;
  completedAt?: Date;
  completedBy?: string;
  result?: string;
  notes?: string;
}

export type SecurityActionType =
  | 'investigate'
  | 'remediate'
  | 'ignore'
  | 'escalate'
  | 'patch'
  | 'isolate'
  | 'monitor';

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  type: SecurityPolicyType;
  rules: SecurityRule[];
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  lastApplied?: Date;
}

export type SecurityPolicyType =
  | 'code-analysis'
  | 'dependency-security'
  | 'access-control'
  | 'data-protection'
  | 'infrastructure-security';

export interface SecurityRule {
  id: string;
  name: string;
  condition: string;
  severity: SecuritySeverity;
  action: SecurityActionType;
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface SecurityReport {
  id: string;
  title: string;
  type: SecurityReportType;
  period: {
    start: Date;
    end: Date;
  };
  summary: SecurityReportSummary;
  findings: SecurityResult[];
  trends: SecurityTrend[];
  recommendations: string[];
  generatedAt: Date;
  generatedBy: string;
}

export type SecurityReportType =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'custom';

export interface SecurityReportSummary {
  totalScans: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  avgTimeToResolution: number;
  resolvedFindings: number;
  openFindings: number;
  complianceScore: number;
}

export interface SecurityTrend {
  date: Date;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
}

export interface CreateSecurityScanRequest {
  type: SecurityScanType;
  target: string;
  config: SecurityScanConfig;
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time?: string;
    timezone?: string;
  };
}

export interface UpdateSecurityAlertRequest {
  status?: SecurityAlertStatus;
  assignee?: string;
  dueDate?: Date;
  notes?: string;
  tags?: string[];
}

export interface SecurityMetrics {
  timestamp: Date;
  scans: {
    total: number;
    completed: number;
    failed: number;
    running: number;
  };
  findings: {
    total: number;
    open: number;
    resolved: number;
    bySeverity: Record<SecuritySeverity, number>;
  };
  alerts: {
    total: number;
    open: number;
    investigating: number;
    resolved: number;
    bySeverity: Record<SecuritySeverity, number>;
  };
  compliance: {
    score: number;
    passed: number;
    failed: number;
    total: number;
  };
}

export class SecurityService {
  /**
   * Get all security scans
   */
  async getScans(params?: QueryParams): Promise<ApiResponse<SecurityScan[]>> {
    return apiClient.get('/security/scans', params);
  }

  /**
   * Get a specific security scan
   */
  async getScan(id: string): Promise<ApiResponse<SecurityScan>> {
    return apiClient.get(`/security/scans/${id}`);
  }

  /**
   * Create a new security scan
   */
  async createScan(data: CreateSecurityScanRequest): Promise<ApiResponse<SecurityScan>> {
    return apiClient.post('/security/scans', data);
  }

  /**
   * Update a security scan
   */
  async updateScan(id: string, data: Partial<SecurityScan>): Promise<ApiResponse<SecurityScan>> {
    return apiClient.put(`/security/scans/${id}`, data);
  }

  /**
   * Delete a security scan
   */
  async deleteScan(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/security/scans/${id}`);
  }

  /**
   * Start a security scan
   */
  async startScan(id: string): Promise<ApiResponse<SecurityScan>> {
    return apiClient.post(`/security/scans/${id}/start`);
  }

  /**
   * Stop a security scan
   */
  async stopScan(id: string): Promise<ApiResponse<SecurityScan>> {
    return apiClient.post(`/security/scans/${id}/stop`);
  }

  /**
   * Get scan results
   */
  async getScanResults(id: string): Promise<ApiResponse<SecurityResult[]>> {
    return apiClient.get(`/security/scans/${id}/results`);
  }

  /**
   * Get scan logs
   */
  async getScanLogs(id: string, params?: { lines?: number; offset?: number }): Promise<ApiResponse<string[]>> {
    return apiClient.get(`/security/scans/${id}/logs`, params);
  }

  /**
   * Get all security alerts
   */
  async getAlerts(params?: QueryParams & {
    severity?: SecuritySeverity[];
    type?: SecurityAlertType[];
    status?: SecurityAlertStatus[];
    assignee?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<ApiResponse<SecurityAlert[]>> {
    return apiClient.get('/security/alerts', params);
  }

  /**
   * Get a specific security alert
   */
  async getAlert(id: string): Promise<ApiResponse<SecurityAlert>> {
    return apiClient.get(`/security/alerts/${id}`);
  }

  /**
   * Create a security alert
   */
  async createAlert(data: Omit<SecurityAlert, 'id' | 'timestamp' | 'actions'>): Promise<ApiResponse<SecurityAlert>> {
    return apiClient.post('/security/alerts', data);
  }

  /**
   * Update a security alert
   */
  async updateAlert(id: string, data: UpdateSecurityAlertRequest): Promise<ApiResponse<SecurityAlert>> {
    return apiClient.put(`/security/alerts/${id}`, data);
  }

  /**
   * Delete a security alert
   */
  async deleteAlert(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/security/alerts/${id}`);
  }

  /**
   * Acknowledge security alert
   */
  async acknowledgeAlert(id: string, notes?: string): Promise<ApiResponse<SecurityAlert>> {
    return apiClient.post(`/security/alerts/${id}/acknowledge`, { notes });
  }

  /**
   * Resolve security alert
   */
  async resolveAlert(id: string, notes?: string): Promise<ApiResponse<SecurityAlert>> {
    return apiClient.post(`/security/alerts/${id}/resolve`, { notes });
  }

  /**
   * Escalate security alert
   */
  async escalateAlert(id: string, reason: string, assignee?: string): Promise<ApiResponse<SecurityAlert>> {
    return apiClient.post(`/security/alerts/${id}/escalate`, { reason, assignee });
  }

  /**
   * Get security policies
   */
  async getPolicies(params?: QueryParams): Promise<ApiResponse<SecurityPolicy[]>> {
    return apiClient.get('/security/policies', params);
  }

  /**
   * Get a specific security policy
   */
  async getPolicy(id: string): Promise<ApiResponse<SecurityPolicy>> {
    return apiClient.get(`/security/policies/${id}`);
  }

  /**
   * Create a security policy
   */
  async createPolicy(data: Omit<SecurityPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<SecurityPolicy>> {
    return apiClient.post('/security/policies', data);
  }

  /**
   * Update a security policy
   */
  async updatePolicy(id: string, data: Partial<SecurityPolicy>): Promise<ApiResponse<SecurityPolicy>> {
    return apiClient.put(`/security/policies/${id}`, data);
  }

  /**
   * Delete a security policy
   */
  async deletePolicy(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/security/policies/${id}`);
  }

  /**
   * Apply security policy
   */
  async applyPolicy(id: string, target: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/security/policies/${id}/apply`, { target });
  }

  /**
   * Get security reports
   */
  async getReports(params?: QueryParams): Promise<ApiResponse<SecurityReport[]>> {
    return apiClient.get('/security/reports', params);
  }

  /**
   * Get a specific security report
   */
  async getReport(id: string): Promise<ApiResponse<SecurityReport>> {
    return apiClient.get(`/security/reports/${id}`);
  }

  /**
   * Generate a security report
   */
  async generateReport(data: {
    type: SecurityReportType;
    period: { start: Date; end: Date };
    filters?: Record<string, any>;
  }): Promise<ApiResponse<SecurityReport>> {
    return apiClient.post('/security/reports/generate', data);
  }

  /**
   * Get security metrics
   */
  async getMetrics(params?: {
    timeRange?: { start: Date; end: Date };
    granularity?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<ApiResponse<SecurityMetrics[]>> {
    return apiClient.get('/security/metrics', params);
  }

  /**
   * Get security dashboard data
   */
  async getDashboardData(params?: {
    timeRange?: { start: Date; end: Date };
  }): Promise<ApiResponse<{
    summary: SecurityReportSummary;
    recentAlerts: SecurityAlert[];
    recentScans: SecurityScan[];
    trends: SecurityTrend[];
    topVulnerabilities: Array<{
      cve: string;
      severity: SecuritySeverity;
      occurrences: number;
    }>;
  }>> {
    return apiClient.get('/security/dashboard', params);
  }

  /**
   * Get vulnerability database information
   */
  async getVulnerabilityInfo(cve: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/security/vulnerabilities/${cve}`);
  }

  /**
   * Search vulnerabilities
   */
  async searchVulnerabilities(params?: {
    query?: string;
    severity?: SecuritySeverity[];
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<any[]>> {
    return apiClient.get('/security/vulnerabilities/search', params);
  }

  /**
   * Get security recommendations
   */
  async getRecommendations(params?: {
    target?: string;
    type?: SecurityScanType;
    severity?: SecuritySeverity[];
  }): Promise<ApiResponse<string[]>> {
    return apiClient.get('/security/recommendations', params);
  }

  /**
   * Export security data
   */
  async exportData(params: {
    type: 'scans' | 'alerts' | 'reports';
    format: 'json' | 'csv' | 'pdf';
    filters?: Record<string, any>;
  }): Promise<Blob> {
    const response = await apiClient.client.post('/security/export', params, {
      responseType: 'blob',
    });
    return response.data;
  }
}

export const securityService = new SecurityService();