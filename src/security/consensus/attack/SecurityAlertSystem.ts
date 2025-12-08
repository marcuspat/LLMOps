/**
 * Security Alert System - Real-time security alert generation and management
 * Implements alert prioritization, escalation, and notification mechanisms
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { AttackEvent, AttackSeverity } from '../types/ConsensusSecurityTypes.js';

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: string;
  severity: AttackSeverity;
  title: string;
  description: string;
  source: string;
  affectedNodes: string[];
  details: any;
  recommendedActions: string[];
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
  priority: number; // 1-10
  escalationLevel: number; // 0-3
  autoResolved?: boolean;
  resolution?: string;
  acknowledgment?: {
    timestamp: Date;
    userId: string;
    comment: string;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  enabled: boolean;
  priority: number;
  escalation: EscalationPolicy;
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'matches';
  value: any;
  weight: number;
}

export interface AlertAction {
  type: 'NOTIFY' | 'ESCALATE' | 'AUTO_RESOLVE' | 'ISOLATE_NODE' | 'RATE_LIMIT' | 'LOG';
  parameters: any;
  delay: number; // seconds
  enabled: boolean;
}

export interface EscalationPolicy {
  enabled: boolean;
  levels: EscalationLevel[];
  autoEscalate: boolean;
  escalationDelay: number; // minutes
}

export interface EscalationLevel {
  level: number;
  severityThreshold: AttackSeverity;
  recipients: string[];
  methods: string[]; // 'email', 'slack', 'sms', 'webhook'
  template: string;
}

export interface AlertStatistics {
  total: number;
  active: number;
  resolved: number;
  escalated: number;
  averageResolutionTime: number;
  severityDistribution: Map<AttackSeverity, number>;
  typeDistribution: Map<string, number>;
  resolutionRate: number;
}

export class SecurityAlertSystem extends EventEmitter {
  private alerts: Map<string, SecurityAlert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: SecurityAlert[] = [];
  private subscribers: AlertSubscriber[] = [];
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    // Byzantine attack alert rule
    const byzantineRule: AlertRule = {
      id: 'byzantine-attack',
      name: 'Byzantine Attack Detected',
      description: 'Alert when Byzantine behavior is detected',
      conditions: [
        { field: 'type', operator: 'equals', value: 'BYZANTINE_ATTACK', weight: 1.0 },
        { field: 'severity', operator: 'greater_than', value: 'MEDIUM', weight: 0.8 }
      ],
      actions: [
        {
          type: 'NOTIFY',
          parameters: { recipients: ['security-team'], method: 'slack' },
          delay: 0,
          enabled: true
        },
        {
          type: 'ISOLATE_NODE',
          parameters: { duration: 300 }, // 5 minutes
          delay: 10,
          enabled: true
        }
      ],
      enabled: true,
      priority: 8,
      escalation: {
        enabled: true,
        levels: [
          {
            level: 1,
            severityThreshold: 'MEDIUM',
            recipients: ['security-lead'],
            methods: ['email'],
            template: 'security-alert-medium'
          },
          {
            level: 2,
            severityThreshold: 'HIGH',
            recipients: ['security-team', 'ops-team'],
            methods: ['slack', 'sms'],
            template: 'security-alert-high'
          },
          {
            level: 3,
            severityThreshold: 'CRITICAL',
            recipients: ['executives', 'security-team'],
            methods: ['slack', 'sms', 'webhook'],
            template: 'security-alert-critical'
          }
        ],
        autoEscalate: true,
        escalationDelay: 15 // minutes
      }
    };

    this.rules.set(byzantineRule.id, byzantineRule);

    // Sybil attack alert rule
    const sybilRule: AlertRule = {
      id: 'sybil-attack',
      name: 'Sybil Attack Detected',
      description: 'Alert when Sybil attack patterns are detected',
      conditions: [
        { field: 'type', operator: 'equals', value: 'SYBIL_ATTACK', weight: 1.0 },
        { field: 'confidence', operator: 'greater_than', value: 0.7, weight: 0.7 }
      ],
      actions: [
        {
          type: 'NOTIFY',
          parameters: { recipients: ['network-admin'], method: 'email' },
          delay: 0,
          enabled: true
        }
      ],
      enabled: true,
      priority: 7,
      escalation: {
        enabled: true,
        levels: [],
        autoEscalate: false,
        escalationDelay: 30
      }
    };

    this.rules.set(sybilRule.id, sybilRule);

    // DoS attack alert rule
    const dosRule: AlertRule = {
      id: 'dos-attack',
      name: 'DoS Attack Detected',
      description: 'Alert when DoS attack is detected',
      conditions: [
        { field: 'type', operator: 'equals', value: 'DOS_ATTACK', weight: 1.0 }
      ],
      actions: [
        {
          type: 'RATE_LIMIT',
          parameters: { maxRate: 100, windowMs: 60000 },
          delay: 5,
          enabled: true
        },
        {
          type: 'NOTIFY',
          parameters: { recipients: ['ops-team'], method: 'slack' },
          delay: 0,
          enabled: true
        }
      ],
      enabled: true,
      priority: 6,
      escalation: {
        enabled: true,
        levels: [],
        autoEscalate: false,
        escalationDelay: 10
      }
    };

    this.rules.set(dosRule.id, dosRule);

    console.log(`Initialized ${this.rules.size} default alert rules`);
  }

  /**
   * Process attack event and generate alerts
   */
  async processAttackEvent(event: AttackEvent): Promise<SecurityAlert[]> {
    const generatedAlerts: SecurityAlert[] = [];

    // Check against all enabled rules
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (this.evaluateRule(rule, event)) {
        const alert = await this.createAlert(rule, event);
        generatedAlerts.push(alert);
        await this.processAlert(alert);
      }
    }

    if (generatedAlerts.length > 0) {
      console.log(`Generated ${generatedAlerts.length} alerts for attack event ${event.id}`);
    }

    return generatedAlerts;
  }

  /**
   * Create alert from rule and event
   */
  private async createAlert(rule: AlertRule, event: AttackEvent): Promise<SecurityAlert> {
    const alertId = this.generateAlertId();
    const affectedNodes = event.nodeId ? [event.nodeId] : [];

    const alert: SecurityAlert = {
      id: alertId,
      timestamp: new Date(),
      type: rule.name,
      severity: event.severity,
      title: this.generateAlertTitle(rule, event),
      description: this.generateAlertDescription(rule, event),
      source: 'consensus-security-monitor',
      affectedNodes,
      details: {
        eventId: event.id,
        ruleId: rule.id,
        eventDetails: event.details,
        confidence: event.confidence
      },
      recommendedActions: this.generateRecommendedActions(rule, event),
      status: 'ACTIVE',
      priority: rule.priority,
      escalationLevel: 0
    };

    this.alerts.set(alertId, alert);
    this.alertHistory.push(alert);

    // Keep alert history manageable
    if (this.alertHistory.length > 10000) {
      this.alertHistory.shift();
    }

    return alert;
  }

  /**
   * Process alert through actions and escalation
   */
  private async processAlert(alert: SecurityAlert): Promise<void> {
    // Emit alert event
    this.emit('alert', alert);

    // Notify subscribers
    await this.notifySubscribers(alert);

    // Execute alert actions
    await this.executeAlertActions(alert);

    // Schedule escalation if needed
    this.scheduleEscalation(alert);

    console.log(`Processed alert ${alert.id}: ${alert.title}`);
  }

  /**
   * Evaluate rule against event
   */
  private evaluateRule(rule: AlertRule, event: AttackEvent): boolean {
    let totalScore = 0;
    let totalWeight = 0;

    for (const condition of rule.conditions) {
      const fieldValue = this.getFieldValue(event, condition.field);
      const conditionMet = this.evaluateCondition(fieldValue, condition);

      if (conditionMet) {
        totalScore += condition.weight;
      }
      totalWeight += condition.weight;
    }

    // Rule passes if average score >= 0.7
    const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    return averageScore >= 0.7;
  }

  /**
   * Get field value from event
   */
  private getFieldValue(event: AttackEvent, field: string): any {
    const fieldPath = field.split('.');
    let value: any = event;

    for (const part of fieldPath) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Evaluate individual condition
   */
  private evaluateCondition(value: any, condition: AlertCondition): boolean {
    if (value === undefined) return false;

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'matches':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }

  /**
   * Generate alert title
   */
  private generateAlertTitle(rule: AlertRule, event: AttackEvent): string {
    return `${rule.name}: ${event.severity} severity detected`;
  }

  /**
   * Generate alert description
   */
  private generateAlertDescription(rule: AlertRule, event: AttackEvent): string {
    let description = rule.description;

    if (event.nodeId) {
      description += ` Source: ${event.nodeId}`;
    }

    if (event.confidence !== undefined) {
      description += ` Confidence: ${(event.confidence * 100).toFixed(1)}%`;
    }

    return description;
  }

  /**
   * Generate recommended actions
   */
  private generateRecommendedActions(rule: AlertRule, event: AttackEvent): string[] {
    const actions: string[] = [];

    if (event.nodeId) {
      actions.push(`Monitor node ${event.nodeId} closely`);
    }

    if (event.severity === 'CRITICAL') {
      actions.push('Immediate investigation required');
    }

    // Add rule-specific actions
    rule.actions.forEach(action => {
      if (action.type === 'ISOLATE_NODE' && event.nodeId) {
        actions.push(`Consider isolating node ${event.nodeId}`);
      } else if (action.type === 'RATE_LIMIT') {
        actions.push('Apply rate limiting if applicable');
      }
    });

    return actions;
  }

  /**
   * Execute alert actions
   */
  private async executeAlertActions(alert: SecurityAlert): Promise<void> {
    const rule = Array.from(this.rules.values()).find(r => r.name === alert.type);
    if (!rule) return;

    for (const action of rule.actions) {
      if (!action.enabled) continue;

      // Schedule action with delay
      setTimeout(async () => {
        try {
          await this.executeAction(action, alert);
        } catch (error) {
          console.error(`Failed to execute action ${action.type} for alert ${alert.id}:`, error);
        }
      }, action.delay * 1000);
    }
  }

  /**
   * Execute individual action
   */
  private async executeAction(action: AlertAction, alert: SecurityAlert): Promise<void> {
    switch (action.type) {
      case 'NOTIFY':
        await this.sendNotification(action.parameters, alert);
        break;
      case 'ESCALATE':
        await this.escalateAlert(alert, action.parameters);
        break;
      case 'AUTO_RESOLVE':
        await this.autoResolveAlert(alert, action.parameters);
        break;
      case 'ISOLATE_NODE':
        await this.isolateNode(alert, action.parameters);
        break;
      case 'RATE_LIMIT':
        await this.applyRateLimit(alert, action.parameters);
        break;
      case 'LOG':
        await this.logAlert(alert, action.parameters);
        break;
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(parameters: any, alert: SecurityAlert): Promise<void> {
    const message = `Security Alert: ${alert.title}\n${alert.description}`;
    console.log(`NOTIFICATION: Sending ${parameters.method} to ${parameters.recipients}: ${message}`);
    // In real implementation, would send to Slack, email, SMS, etc.
  }

  /**
   * Escalate alert
   */
  private async escalateAlert(alert: SecurityAlert, parameters: any): Promise<void> {
    alert.escalationLevel = Math.min(alert.escalationLevel + 1, 3);
    alert.status = 'ACTIVE'; // Keep active but escalated
    alert.timestamp = new Date();

    console.log(`ESCALATED: Alert ${alert.id} escalated to level ${alert.escalationLevel}`);
  }

  /**
   * Auto-resolve alert
   */
  private async autoResolveAlert(alert: SecurityAlert, parameters: any): Promise<void> {
    alert.status = 'RESOLVED';
    alert.autoResolved = true;
    alert.resolution = parameters.reason || 'Auto-resolved by system';
    alert.timestamp = new Date();

    this.emit('alertResolved', alert);

    console.log(`AUTO-RESOLVED: Alert ${alert.id} - ${alert.resolution}`);
  }

  /**
   * Isolate node
   */
  private async isolateNode(alert: SecurityAlert, parameters: any): Promise<void> {
    const nodeId = alert.affectedNodes[0];
    if (!nodeId) return;

    console.log(`ISOLATE: Isolating node ${nodeId} for ${parameters.duration} seconds`);
    // In real implementation, would trigger node isolation mechanism
  }

  /**
   * Apply rate limit
   */
  private async applyRateLimit(alert: SecurityAlert, parameters: any): Promise<void> {
    console.log(`RATE_LIMIT: Applying rate limit ${parameters.maxRate} req/${parameters.windowMs}ms`);
    // In real implementation, would configure rate limiting
  }

  /**
   * Log alert
   */
  private async logAlert(alert: SecurityAlert, parameters: any): Promise<void> {
    const logLevel = this.getLogLevel(alert.severity);
    console.log(`[${logLevel}] Alert ${alert.id}: ${alert.title}`);
    // In real implementation, would write to structured logging system
  }

  /**
   * Get log level for severity
   */
  private getLogLevel(severity: AttackSeverity): string {
    switch (severity) {
      case 'CRITICAL': return 'CRITICAL';
      case 'HIGH': return 'ERROR';
      case 'MEDIUM': return 'WARN';
      case 'LOW': return 'INFO';
      default: return 'INFO';
    }
  }

  /**
   * Schedule escalation
   */
  private scheduleEscalation(alert: SecurityAlert): void {
    const rule = Array.from(this.rules.values()).find(r => r.name === alert.type);
    if (!rule || !rule.escalation.enabled || rule.escalation.autoEscalate) return;

    const delay = rule.escalation.escalationDelay * 60 * 1000; // Convert to milliseconds

    if (delay > 0) {
      const timer = setTimeout(async () => {
        if (alert.status === 'ACTIVE' && this.alerts.has(alert.id)) {
          await this.escalateAlert(alert, {});
        }
      }, delay);

      this.escalationTimers.set(alert.id, timer);
    }
  }

  /**
   * Add alert subscriber
   */
  addSubscriber(subscriber: AlertSubscriber): void {
    this.subscribers.push(subscriber);
  }

  /**
   * Remove alert subscriber
   */
  removeSubscriber(subscriberId: string): void {
    this.subscribers = this.subscribers.filter(s => s.id !== subscriberId);
  }

  /**
   * Notify subscribers
   */
  private async notifySubscribers(alert: SecurityAlert): Promise<void> {
    for (const subscriber of this.subscribers) {
      if (this.shouldNotifySubscriber(subscriber, alert)) {
        try {
          await subscriber.onAlert(alert);
        } catch (error) {
          console.error(`Subscriber ${subscriber.id} notification failed:`, error);
        }
      }
    }
  }

  /**
   * Check if subscriber should be notified
   */
  private shouldNotifySubscriber(subscriber: AlertSubscriber, alert: SecurityAlert): boolean {
    return subscriber.minSeverity === undefined ||
           this.compareSeverity(alert.severity, subscriber.minSeverity) >= 0;
  }

  /**
   * Compare severity levels
   */
  private compareSeverity(severity1: AttackSeverity, severity2: AttackSeverity): number {
    const severityOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    return severityOrder[severity1] - severityOrder[severity2];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.status === 'ACTIVE');
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): SecurityAlert | null {
    return this.alerts.get(alertId) || null;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string, comment: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgment = {
      timestamp: new Date(),
      userId,
      comment
    };

    this.emit('alertAcknowledged', alert);

    console.log(`ACKNOWLEDGED: Alert ${alertId} by ${userId}`);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolution: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    alert.status = 'RESOLVED';
    alert.resolution = resolution;

    // Cancel escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    this.emit('alertResolved', alert);

    console.log(`RESOLVED: Alert ${alertId} - ${resolution}`);
  }

  /**
   * Get alert statistics
   */
  getStatistics(): AlertStatistics {
    const alerts = Array.from(this.alerts.values());
    const active = alerts.filter(a => a.status === 'ACTIVE');
    const resolved = alerts.filter(a => a.status === 'RESOLVED');

    // Calculate severity distribution
    const severityDist = new Map<AttackSeverity, number>();
    alerts.forEach(alert => {
      const count = severityDist.get(alert.severity) || 0;
      severityDist.set(alert.severity, count + 1);
    });

    // Calculate type distribution
    const typeDist = new Map<string, number>();
    alerts.forEach(alert => {
      const count = typeDist.get(alert.type) || 0;
      typeDist.set(alert.type, count + 1);
    });

    // Calculate average resolution time
    const resolvedAlerts = alerts.filter(a => a.status === 'RESOLVED' && a.resolution);
    const avgResolutionTime = resolvedAlerts.length > 0 ?
      resolvedAlerts.reduce((sum, alert) => {
        const resolutionTime = alert.acknowledgment ?
          alert.timestamp.getTime() - alert.acknowledgment.timestamp.getTime() :
          0;
        return sum + resolutionTime;
      }, 0) / resolvedAlerts.length : 0;

    return {
      total: alerts.length,
      active: active.length,
      resolved: resolved.length,
      escalated: alerts.filter(a => a.escalationLevel > 0).length,
      averageResolutionTime,
      severityDistribution: severityDist,
      typeDistribution: typeDist,
      resolutionRate: alerts.length > 0 ? resolved.length / alerts.length : 0
    };
  }

  /**
   * Add custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`Added alert rule: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    console.log(`Removed alert rule: ${ruleId}`);
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Cleanup old alerts and resources
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [alertId, alert] of this.alerts) {
      const age = now - alert.timestamp.getTime();
      const isResolved = alert.status === 'RESOLVED' || alert.status === 'IGNORED';

      if (isResolved && age > maxAge) {
        toDelete.push(alertId);
      }
    }

    for (const alertId of toDelete) {
      this.alerts.delete(alertId);

      // Cancel escalation timer
      const timer = this.escalationTimers.get(alertId);
      if (timer) {
        clearTimeout(timer);
        this.escalationTimers.delete(alertId);
      }
    }

    console.log(`Cleaned up ${toDelete.length} old alerts`);
    return toDelete.length;
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Cancel all escalation timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();

    // Clear data
    this.alerts.clear();
    this.alertHistory = [];
    this.subscribers = [];

    console.log('Security Alert System cleanup completed');
  }
}

export interface AlertSubscriber {
  id: string;
  minSeverity?: AttackSeverity;
  onAlert(alert: SecurityAlert): Promise<void>;
}