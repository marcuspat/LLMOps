/**
 * Reputation System - Node reputation scoring and management
 * Implements adaptive reputation scoring with decay and recovery mechanisms
 */

import * as crypto from 'crypto';
import { ReputationConfig, ReputationScore as ReputationScoreType } from '../types/ConsensusSecurityTypes.js';

export interface ReputationEntry {
  nodeId: string;
  score: number; // 0-1
  confidence: number; // 0-1
  lastUpdated: Date;
  history: ReputationEvent[];
  penalties: PenaltyRecord[];
  rewards: RewardRecord[];
  metadata: {
    totalInteractions: number;
    successfulInteractions: number;
    failedInteractions: number;
    averageResponseTime: number;
    uptime: number;
  };
}

export interface ReputationEvent {
  timestamp: Date;
  type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  score: number;
  reason: string;
  weight: number;
  context?: any;
}

export interface PenaltyRecord {
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  amount: number;
  reason: string;
  decayPeriod: number; // hours
  recovered?: boolean;
}

export interface RewardRecord {
  timestamp: Date;
  amount: number;
  reason: string;
  decayRate: number;
  context?: any;
}

export interface ReputationConfig {
  initialScore: number;
  maxScore: number;
  minScore: number;
  decayRate: number;
  recoveryRate: number;
  penaltyMultiplier: number;
  rewardMultiplier: number;
  confidenceDecayRate: number;
  maxHistoryLength: number;
  updateFrequency: number; // minutes
}

export class ReputationSystem {
  private reputations: Map<string, ReputationEntry> = new Map();
  private config: ReputationConfig;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      initialScore: 0.5,
      maxScore: 1.0,
      minScore: 0.0,
      decayRate: 0.01,
      recoveryRate: 0.05,
      penaltyMultiplier: 1.5,
      rewardMultiplier: 1.2,
      confidenceDecayRate: 0.02,
      maxHistoryLength: 1000,
      updateFrequency: 5 // minutes
    };
  }

  /**
   * Configure reputation system
   */
  async configure(config: Partial<ReputationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    // Restart update timer if needed
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.startUpdateTimer();

    console.log('Reputation system configured', this.config);
  }

  /**
   * Initialize reputation system
   */
  async initialize(): Promise<void> {
    console.log('Initializing Reputation System');
    this.startUpdateTimer();
  }

  /**
   * Add or update node reputation
   */
  addOrUpdateReputation(nodeId: string, initialScore?: number): void {
    if (!this.reputations.has(nodeId)) {
      const entry: ReputationEntry = {
        nodeId,
        score: initialScore || this.config.initialScore,
        confidence: 0.5,
        lastUpdated: new Date(),
        history: [],
        penalties: [],
        rewards: [],
        metadata: {
          totalInteractions: 0,
          successfulInteractions: 0,
          failedInteractions: 0,
          averageResponseTime: 0,
          uptime: 0
        }
      };

      this.reputations.set(nodeId, entry);
      console.log(`Added reputation entry for node ${nodeId} with score ${entry.score}`);
    }
  }

  /**
   * Get reputation score for a node
   */
  getReputation(nodeId: string): ReputationEntry | null {
    return this.reputations.get(nodeId) || null;
  }

  /**
   * Update reputation based on event
   */
  async updateReputation(nodeId: string, event: ReputationEvent): Promise<void> {
    let entry = this.reputations.get(nodeId);
    if (!entry) {
      this.addOrUpdateReputation(nodeId);
      entry = this.reputations.get(nodeId)!;
    }

    // Add event to history
    entry.history.push(event);
    if (entry.history.length > this.config.maxHistoryLength) {
      entry.history.shift();
    }

    // Update score based on event
    const oldScore = entry.score;
    const scoreChange = this.calculateScoreChange(event, entry);
    entry.score = Math.max(this.config.minScore, Math.min(this.config.maxScore, oldScore + scoreChange));

    // Update confidence
    entry.confidence = this.updateConfidence(entry.confidence, event);

    // Update metadata
    this.updateMetadata(entry, event);

    entry.lastUpdated = new Date();

    console.log(`Updated reputation for ${nodeId}: ${oldScore.toFixed(3)} -> ${entry.score.toFixed(3)}`);
  }

  /**
   * Penalize node for misbehavior
   */
  async penalizeNode(nodeId: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', reason?: string): Promise<void> {
    const entry = this.reputations.get(nodeId);
    if (!entry) {
      this.addOrUpdateReputation(nodeId);
    }

    const penaltyAmount = this.getPenaltyAmount(severity);
    const penalty: PenaltyRecord = {
      timestamp: new Date(),
      severity,
      amount: penaltyAmount,
      reason: reason || `${severity} severity penalty`,
      decayPeriod: this.getPenaltyDecayPeriod(severity),
      recovered: false
    };

    await this.updateReputation(nodeId, {
      timestamp: new Date(),
      type: 'NEGATIVE',
      score: -penaltyAmount,
      reason: penalty.reason,
      weight: this.getSeverityWeight(severity)
    });

    const updatedEntry = this.reputations.get(nodeId)!;
    updatedEntry.penalties.push(penalty);

    console.log(`Penalized node ${nodeId}: ${severity} penalty of ${penaltyAmount.toFixed(3)}`);
  }

  /**
   * Reward node for good behavior
   */
  async rewardNode(nodeId: string, amount: number, reason: string): Promise<void> {
    const entry = this.reputations.get(nodeId);
    if (!entry) {
      this.addOrUpdateReputation(nodeId);
    }

    const rewardAmount = amount * this.config.rewardMultiplier;
    const reward: RewardRecord = {
      timestamp: new Date(),
      amount: rewardAmount,
      reason,
      decayRate: this.config.decayRate,
      context: { originalAmount: amount }
    };

    await this.updateReputation(nodeId, {
      timestamp: new Date(),
      type: 'POSITIVE',
      score: rewardAmount,
      reason: reward.reason,
      weight: 1.0
    });

    const updatedEntry = this.reputations.get(nodeId)!;
    updatedEntry.rewards.push(reward);

    console.log(`Rewarded node ${nodeId}: ${rewardAmount.toFixed(3)} for ${reason}`);
  }

  /**
   * Apply periodic decay to all reputations
   */
  async applyDecay(): Promise<void> {
    const now = Date.now();

    for (const [nodeId, entry] of this.reputations) {
      let scoreChange = 0;

      // Apply natural decay
      scoreChange -= this.config.decayRate * entry.score;

      // Apply confidence decay
      entry.confidence = Math.max(0.1, entry.confidence - this.config.confayDecayRate);

      // Process penalties with decay
      for (const penalty of entry.penalties) {
        if (!penalty.recovered) {
          const ageHours = (now - penalty.timestamp.getTime()) / (1000 * 60 * 60);

          if (ageHours >= penalty.decayPeriod) {
            // Penalty has expired, start recovery
            penalty.recovered = true;
            scoreChange += this.config.recoveryRate * penalty.amount;
          } else if (ageHours >= penalty.decayPeriod / 2) {
            // Start partial recovery
            const recoveryFactor = (ageHours - penalty.decayPeriod / 2) / (penalty.decayPeriod / 2);
            scoreChange += this.config.recoveryRate * penalty.amount * recoveryFactor * 0.5;
          }
        }
      }

      // Apply rewards with decay
      for (const reward of entry.rewards) {
        const ageHours = (now - reward.timestamp.getTime()) / (1000 * 60 * 60);
        const decayedAmount = reward.amount * Math.exp(-reward.decayRate * ageHours / 24);
        scoreChange += decayedAmount * 0.01; // Small continuous benefit
      }

      // Update score
      entry.score = Math.max(this.config.minScore, Math.min(this.config.maxScore, entry.score + scoreChange));
      entry.lastUpdated = new Date();
    }

    console.log(`Applied decay to ${this.reputations.size} reputations`);
  }

  /**
   * Get nodes by reputation score range
   */
  getNodesByReputation(minScore: number, maxScore: number): ReputationEntry[] {
    return Array.from(this.reputations.values()).filter(entry =>
      entry.score >= minScore && entry.score <= maxScore
    );
  }

  /**
   * Get high reputation nodes
   */
  getHighReputationNodes(threshold: number = 0.8): ReputationEntry[] {
    return this.getNodesByReputation(threshold, 1.0);
  }

  /**
   * Get low reputation nodes
   */
  getLowReputationNodes(threshold: number = 0.3): ReputationEntry[] {
    return this.getNodesByReputation(0.0, threshold);
  }

  /**
   * Get reputation statistics
   */
  getStatistics(): ReputationStatistics {
    const scores = Array.from(this.reputations.values()).map(r => r.score);

    if (scores.length === 0) {
      return {
        totalNodes: 0,
        averageScore: 0,
        medianScore: 0,
        highReputationNodes: 0,
        lowReputationNodes: 0,
        standardDeviation: 0,
        scoreDistribution: new Map()
      };
    }

    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sortedScores = scores.sort((a, b) => a - b);
    const median = sortedScores[Math.floor(sortedScores.length / 2)];
    const highRep = scores.filter(s => s >= 0.8).length;
    const lowRep = scores.filter(s => s <= 0.3).length;

    // Calculate standard deviation
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);

    // Create score distribution
    const distribution = new Map<string, number>();
    const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    for (let i = 0; i < bins.length - 1; i++) {
      const binLabel = `${bins[i]}-${bins[i + 1]}`;
      const count = scores.filter(s => s >= bins[i] && s < bins[i + 1]).length;
      distribution.set(binLabel, count);
    }

    return {
      totalNodes: scores.length,
      averageScore: average,
      medianScore: median,
      highReputationNodes: highRep,
      lowReputationNodes: lowRep,
      standardDeviation: standardDeviation,
      scoreDistribution: distribution
    };
  }

  /**
   * Get reputation history for a node
   */
  getReputationHistory(nodeId: string, limit?: number): ReputationEvent[] {
    const entry = this.reputations.get(nodeId);
    if (!entry) return [];

    const history = entry.history.slice();
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Compare two node reputations
   */
  compareReputations(nodeId1: string, nodeId2: string): ReputationComparison {
    const entry1 = this.reputations.get(nodeId1);
    const entry2 = this.reputations.get(nodeId2);

    if (!entry1 || !entry2) {
      return {
        nodeId1,
        nodeId2,
        scoreDifference: 0,
        confidenceDifference: 0,
        summary: 'One or both nodes not found'
      };
    }

    const scoreDiff = entry1.score - entry2.score;
    const confidenceDiff = entry1.confidence - entry2.confidence;

    let summary = 'Equal reputation';
    if (Math.abs(scoreDiff) > 0.1) {
      summary = scoreDiff > 0 ? `${nodeId1} has significantly higher reputation` : `${nodeId2} has significantly higher reputation`;
    }

    return {
      nodeId1,
      nodeId2,
      scoreDifference: scoreDiff,
      confidenceDifference: confidenceDiff,
      summary
    };
  }

  /**
   * Reset reputation for a node
   */
  resetReputation(nodeId: string): void {
    const entry = this.reputations.get(nodeId);
    if (entry) {
      entry.score = this.config.initialScore;
      entry.confidence = 0.5;
      entry.history = [];
      entry.penalties = [];
      entry.rewards = [];
      entry.metadata = {
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        averageResponseTime: 0,
        uptime: 0
      };
      entry.lastUpdated = new Date();

      console.log(`Reset reputation for node ${nodeId}`);
    }
  }

  /**
   * Remove reputation entry
   */
  removeReputation(nodeId: string): void {
    this.reputations.delete(nodeId);
    console.log(`Removed reputation entry for node ${nodeId}`);
  }

  /**
   * Export reputation data
   */
  exportReputations(): Map<string, any> {
    const exportData = new Map<string, any>();

    for (const [nodeId, entry] of this.reputations) {
      exportData.set(nodeId, {
        score: entry.score,
        confidence: entry.confidence,
        lastUpdated: entry.lastUpdated,
        metadata: entry.metadata,
        // Don't export full history to save space
        recentEvents: entry.history.slice(-10),
        activePenalties: entry.penalties.filter(p => !p.recovered),
        totalPenalties: entry.penalties.length,
        totalRewards: entry.rewards.length
      });
    }

    return exportData;
  }

  /**
   * Import reputation data
   */
  importReputations(data: Map<string, any>): void {
    for (const [nodeId, nodeData] of data) {
      const entry: ReputationEntry = {
        nodeId,
        score: nodeData.score || this.config.initialScore,
        confidence: nodeData.confidence || 0.5,
        lastUpdated: new Date(nodeData.lastUpdated || Date.now()),
        history: nodeData.recentEvents || [],
        penalties: nodeData.activePenalties || [],
        rewards: [],
        metadata: nodeData.metadata || {
          totalInteractions: 0,
          successfulInteractions: 0,
          failedInteractions: 0,
          averageResponseTime: 0,
          uptime: 0
        }
      };

      this.reputations.set(nodeId, entry);
    }

    console.log(`Imported ${data.size} reputation entries`);
  }

  /**
   * Private helper methods
   */

  private startUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(async () => {
      await this.applyDecay();
    }, this.config.updateFrequency * 60 * 1000);
  }

  private calculateScoreChange(event: ReputationEvent, entry: ReputationEntry): number {
    let change = event.score;

    // Apply weight based on event type
    if (event.type === 'NEGATIVE') {
      change *= this.config.penaltyMultiplier;
    } else if (event.type === 'POSITIVE') {
      change *= this.config.rewardMultiplier;
    }

    // Apply confidence factor
    change *= entry.confidence;

    return change;
  }

  private updateConfidence(currentConfidence: number, event: ReputationEvent): number {
    let newConfidence = currentConfidence;

    // Increase confidence with more data
    if (event.type !== 'NEUTRAL') {
      newConfidence += 0.01;
    }

    // Decrease confidence for conflicting events
    if (event.type === 'NEGATIVE' && currentConfidence > 0.8) {
      newConfidence -= 0.05;
    }

    return Math.min(1.0, Math.max(0.1, newConfidence));
  }

  private updateMetadata(entry: ReputationEntry, event: ReputationEvent): void {
    entry.metadata.totalInteractions++;

    if (event.type === 'POSITIVE') {
      entry.metadata.successfulInteractions++;
    } else if (event.type === 'NEGATIVE') {
      entry.metadata.failedInteractions++;
    }

    // Update response time if provided
    if (event.context?.responseTime) {
      const currentAvg = entry.metadata.averageResponseTime;
      const newTime = event.context.responseTime;
      const totalInteractions = entry.metadata.totalInteractions;

      entry.metadata.averageResponseTime =
        (currentAvg * (totalInteractions - 1) + newTime) / totalInteractions;
    }
  }

  private getPenaltyAmount(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): number {
    switch (severity) {
      case 'LOW': return 0.05;
      case 'MEDIUM': return 0.1;
      case 'HIGH': return 0.2;
      case 'CRITICAL': return 0.4;
      default: return 0.1;
    }
  }

  private getPenaltyDecayPeriod(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): number {
    switch (severity) {
      case 'LOW': return 1; // 1 hour
      case 'MEDIUM': return 6; // 6 hours
      case 'HIGH': return 24; // 1 day
      case 'CRITICAL': return 168; // 1 week
      default: return 6;
    }
  }

  private getSeverityWeight(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): number {
    switch (severity) {
      case 'LOW': return 0.5;
      case 'MEDIUM': return 1.0;
      case 'HIGH': return 1.5;
      case 'CRITICAL': return 2.0;
      default: return 1.0;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.reputations.clear();

    console.log('Reputation System cleanup completed');
  }
}

export interface ReputationStatistics {
  totalNodes: number;
  averageScore: number;
  medianScore: number;
  highReputationNodes: number;
  lowReputationNodes: number;
  standardDeviation: number;
  scoreDistribution: Map<string, number>;
}

export interface ReputationComparison {
  nodeId1: string;
  nodeId2: string;
  scoreDifference: number;
  confidenceDifference: number;
  summary: string;
}