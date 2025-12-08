/**
 * Behavior Analyzer - Analyzes node behavior patterns for threat detection
 * Implements baseline establishment, anomaly detection, and behavioral profiling
 */

import * as crypto from 'crypto';
import { ConsensusMessage } from '../types/ConsensusSecurityTypes.js';

export interface BehaviorProfile {
  nodeId: string;
  baseline: BehaviorBaseline;
  currentMetrics: BehaviorMetrics;
  anomalies: BehaviorAnomaly[];
  riskScore: number;
  lastUpdated: Date;
}

export interface BehaviorBaseline {
  messageFrequency: number; // messages per minute
  averageMessageSize: number; // bytes
  votingPatterns: VotingPattern[];
  timingPatterns: TimingPattern[];
  activitySchedule: ActivitySchedule;
  networkBehavior: NetworkBehavior;
}

export interface BehaviorMetrics {
  messageFrequency: number;
  averageMessageSize: number;
  messageTypes: Map<string, number>;
  votingConsistency: number;
  responseTimes: number[];
  activityHours: number[];
  networkConnections: number;
  bandwidthUsage: {
    upload: number;
    download: number;
  };
}

export interface VotingPattern {
  proposalType: string;
  typicalVote: string; // APPROVE, REJECT, ABSTAIN
  consistency: number; // 0-1
  variance: number;
}

export interface TimingPattern {
  messageType: string;
  typicalDelay: number; // milliseconds
  variance: number;
  peakHours: number[];
}

export interface ActivitySchedule {
  activeHours: number[];
  typicalOnlineDuration: number; // minutes
  maintenanceWindows: number[]; // hours
}

export interface NetworkBehavior {
  preferredPeers: string[];
  connectionStability: number;
  geographicDistribution: string[];
  networkPathConsistency: number;
}

export interface BehaviorAnomaly {
  id: string;
  timestamp: Date;
  type: AnomalyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metrics: any;
  confidence: number;
}

export type AnomalyType =
  | 'UNUSUAL_MESSAGE_FREQUENCY'
  | 'VOTING_PATTERN_CHANGE'
  | 'TIMING_ANOMALY'
  | 'NETWORK_BEHAVIOR_CHANGE'
  | 'RESOURCE_EXHAUSTION'
  | 'COORDINATION_SUSPICION';

export interface BehaviorAnalysisConfig {
  learningRate: number;
  anomalyThreshold: number;
  baselineWindow: number; // hours
  updateFrequency: number; // minutes
  minDataPoints: number;
  confidenceThreshold: number;
}

export class BehaviorAnalyzer {
  private profiles: Map<string, BehaviorProfile> = new Map();
  private config: BehaviorAnalysisConfig;
  private messageHistory: Map<string, ConsensusMessage[]> = new Map();
  private analysisHistory: Map<string, Date[]> = new Map();

  constructor() {
    this.config = {
      learningRate: 0.1,
      anomalyThreshold: 2.0, // Standard deviations
      baselineWindow: 24 * 60 * 60 * 1000, // 24 hours
      updateFrequency: 5 * 60 * 1000, // 5 minutes
      minDataPoints: 50,
      confidenceThreshold: 0.7
    };
  }

  /**
   * Configure behavior analyzer
   */
  async configure(config: Partial<BehaviorAnalysisConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    console.log('Behavior analyzer configured', this.config);
  }

  /**
   * Establish behavior baseline for a node
   */
  async establishBaseline(nodeId: string): Promise<BehaviorBaseline> {
    console.log(`Establishing baseline for node ${nodeId}`);

    // Get historical messages for the node
    const historicalMessages = this.getHistoricalMessages(nodeId, this.config.baselineWindow);

    if (historicalMessages.length < this.config.minDataPoints) {
      // Not enough data, use default baseline
      const defaultBaseline = this.createDefaultBaseline();
      this.saveBaseline(nodeId, defaultBaseline);
      return defaultBaseline;
    }

    // Analyze historical messages to create baseline
    const baseline = this.analyzeMessagesForBaseline(historicalMessages);
    this.saveBaseline(nodeId, baseline);

    console.log(`Baseline established for node ${nodeId}`);
    return baseline;
  }

  /**
   * Analyze current behavior of a node
   */
  async analyzeBehavior(nodeId: string, recentMessages: ConsensusMessage[]): Promise<BehaviorProfile> {
    // Update message history
    this.updateMessageHistory(nodeId, recentMessages);

    // Get or create profile
    let profile = this.profiles.get(nodeId);
    if (!profile) {
      const baseline = await this.establishBaseline(nodeId);
      profile = {
        nodeId,
        baseline,
        currentMetrics: this.calculateMetrics(recentMessages),
        anomalies: [],
        riskScore: 0.5, // Neutral risk
        lastUpdated: new Date()
      };
    } else {
      profile.currentMetrics = this.calculateMetrics(recentMessages);
    }

    // Detect anomalies
    const anomalies = this.detectAnomalies(profile);
    profile.anomalies = anomalies;

    // Update risk score
    profile.riskScore = this.calculateRiskScore(profile);

    // Update baseline if needed
    if (this.shouldUpdateBaseline(profile)) {
      profile.baseline = this.updateBaseline(profile);
    }

    profile.lastUpdated = new Date();
    this.profiles.set(nodeId, profile);

    return profile;
  }

  /**
   * Get behavior profile for a node
   */
  getBehaviorProfile(nodeId: string): BehaviorProfile | null {
    return this.profiles.get(nodeId) || null;
  }

  /**
   * Get all behavior profiles
   */
  getAllProfiles(): BehaviorProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get nodes with high risk scores
   */
  getHighRiskNodes(threshold: number = 0.7): BehaviorProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.riskScore >= threshold);
  }

  /**
   * Compare two nodes for behavioral similarity
   */
  compareBehaviors(node1Id: string, node2Id: string): BehaviorSimilarity {
    const profile1 = this.profiles.get(node1Id);
    const profile2 = this.profiles.get(node2Id);

    if (!profile1 || !profile2) {
      return { similarity: 0, commonPatterns: [] };
    }

    const commonPatterns: string[] = [];
    let similarity = 0;

    // Compare message frequency
    const freqDiff = Math.abs(profile1.currentMetrics.messageFrequency - profile2.currentMetrics.messageFrequency);
    const avgFreq = (profile1.currentMetrics.messageFrequency + profile2.currentMetrics.messageFrequency) / 2;
    const freqSimilarity = avgFreq > 0 ? 1 - (freqDiff / avgFreq) : 1;
    similarity += freqSimilarity * 0.3;

    // Compare voting patterns
    const votingSimilarity = this.compareVotingPatterns(profile1, profile2);
    similarity += votingSimilarity * 0.4;

    // Compare timing patterns
    const timingSimilarity = this.compareTimingPatterns(profile1, profile2);
    similarity += timingSimilarity * 0.3;

    // Identify common patterns
    if (freqSimilarity > 0.9) commonPatterns.push('SIMILAR_MESSAGE_FREQUENCY');
    if (votingSimilarity > 0.9) commonPatterns.push('SIMILAR_VOTING_PATTERNS');
    if (timingSimilarity > 0.9) commonPatterns.push('SIMILAR_TIMING_PATTERNS');

    return { similarity, commonPatterns };
  }

  /**
   * Private helper methods
   */

  private getHistoricalMessages(nodeId: string, timeWindow: number): ConsensusMessage[] {
    const history = this.messageHistory.get(nodeId) || [];
    const cutoff = Date.now() - timeWindow;

    return history.filter(msg => msg.timestamp.getTime() > cutoff);
  }

  private createDefaultBaseline(): BehaviorBaseline {
    return {
      messageFrequency: 10, // 10 messages per minute
      averageMessageSize: 1024, // 1KB
      votingPatterns: [
        { proposalType: 'STANDARD', typicalVote: 'APPROVE', consistency: 0.8, variance: 0.2 }
      ],
      timingPatterns: [
        { messageType: 'VOTE', typicalDelay: 1000, variance: 500, peakHours: [9, 10, 14, 15] }
      ],
      activitySchedule: {
        activeHours: Array.from({ length: 24 }, (_, i) => i),
        typicalOnlineDuration: 480, // 8 hours
        maintenanceWindows: [2, 3, 4] // 2-4 AM
      },
      networkBehavior: {
        preferredPeers: [],
        connectionStability: 0.9,
        geographicDistribution: ['US', 'EU'],
        networkPathConsistency: 0.8
      }
    };
  }

  private analyzeMessagesForBaseline(messages: ConsensusMessage[]): BehaviorBaseline {
    const messageCounts = new Map<string, number>();
    const votePatterns = new Map<string, any>();
    const timingData = new Map<string, number[]>();
    const hourlyActivity = new Array(24).fill(0);
    let totalSize = 0;

    // Analyze messages
    for (const message of messages) {
      // Count message types
      const type = message.type;
      messageCounts.set(type, (messageCounts.get(type) || 0) + 1);

      // Analyze voting patterns
      if (message.type === 'VOTE') {
        const vote = message.content.vote || 'UNKNOWN';
        if (!votePatterns.has(vote)) {
          votePatterns.set(vote, { count: 0, proposals: new Set() });
        }
        const pattern = votePatterns.get(vote)!;
        pattern.count++;
        pattern.proposals.add(message.content.proposalId);
      }

      // Collect timing data
      if (!timingData.has(type)) {
        timingData.set(type, []);
      }
      timingData.get(type)!.push(this.extractTimingMetric(message));

      // Track hourly activity
      const hour = message.timestamp.getHours();
      hourlyActivity[hour]++;

      // Track message size
      totalSize += JSON.stringify(message.content).length;
    }

    // Create baseline from analysis
    const baseline: BehaviorBaseline = {
      messageFrequency: this.calculateMessageFrequency(messages),
      averageMessageSize: totalSize / messages.length,
      votingPatterns: this.createVotingPatterns(votePatterns),
      timingPatterns: this.createTimingPatterns(timingData),
      activitySchedule: this.createActivitySchedule(hourlyActivity),
      networkBehavior: this.createNetworkBehavior()
    };

    return baseline;
  }

  private calculateMessageFrequency(messages: ConsensusMessage[]): number {
    if (messages.length === 0) return 0;

    const timeSpan = messages[messages.length - 1].timestamp.getTime() - messages[0].timestamp.getTime();
    const timeSpanMinutes = timeSpan / (1000 * 60);

    return timeSpanMinutes > 0 ? messages.length / timeSpanMinutes : 0;
  }

  private createVotingPatterns(voteData: Map<string, any>): VotingPattern[] {
    const patterns: VotingPattern[] = [];

    for (const [vote, data] of voteData) {
      patterns.push({
        proposalType: 'STANDARD', // Simplified
        typicalVote: vote,
        consistency: data.count / data.proposals.size,
        variance: this.calculateVariance(Array.from(data.proposals))
      });
    }

    return patterns;
  }

  private createTimingPatterns(timingData: Map<string, number[]>): TimingPattern[] {
    const patterns: TimingPattern[] = [];

    for (const [type, times] of timingData) {
      if (times.length > 0) {
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = this.calculateVariance(times);

        patterns.push({
          messageType: type,
          typicalDelay: mean,
          variance: variance,
          peakHours: this.findPeakHours(times)
        });
      }
    }

    return patterns;
  }

  private createActivitySchedule(hourlyActivity: number[]): ActivitySchedule {
    const activeHours: number[] = [];
    const threshold = Math.max(...hourlyActivity) * 0.1; // 10% of peak activity

    for (let i = 0; i < hourlyActivity.length; i++) {
      if (hourlyActivity[i] > threshold) {
        activeHours.push(i);
      }
    }

    return {
      activeHours,
      typicalOnlineDuration: this.calculateOnlineDuration(hourlyActivity),
      maintenanceWindows: [2, 3, 4] // Default maintenance hours
    };
  }

  private createNetworkBehavior(): NetworkBehavior {
    // Simplified network behavior analysis
    return {
      preferredPeers: [],
      connectionStability: 0.9,
      geographicDistribution: ['US', 'EU'],
      networkPathConsistency: 0.8
    };
  }

  private extractTimingMetric(message: ConsensusMessage): number {
    // Extract relevant timing metric from message
    // This would depend on actual message structure
    return crypto.randomInt(100, 2000); // Mock timing data
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(x => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private findPeakHours(times: number[]): number[] {
    // Simplified peak hour detection
    return [9, 14, 16]; // Default peak hours
  }

  private calculateOnlineDuration(hourlyActivity: number[]): number {
    // Calculate typical online duration based on activity patterns
    const activeHours = hourlyActivity.filter(h => h > 0).length;
    return activeHours * 60; // Convert hours to minutes
  }

  private saveBaseline(nodeId: string, baseline: BehaviorBaseline): void {
    let profile = this.profiles.get(nodeId);
    if (!profile) {
      profile = {
        nodeId,
        baseline,
        currentMetrics: this.createEmptyMetrics(),
        anomalies: [],
        riskScore: 0.5,
        lastUpdated: new Date()
      };
      this.profiles.set(nodeId, profile);
    } else {
      profile.baseline = baseline;
    }
  }

  private createEmptyMetrics(): BehaviorMetrics {
    return {
      messageFrequency: 0,
      averageMessageSize: 0,
      messageTypes: new Map(),
      votingConsistency: 0,
      responseTimes: [],
      activityHours: [],
      networkConnections: 0,
      bandwidthUsage: { upload: 0, download: 0 }
    };
  }

  private updateMessageHistory(nodeId: string, messages: ConsensusMessage[]): void {
    const history = this.messageHistory.get(nodeId) || [];
    history.push(...messages);

    // Keep only recent messages (last 24 hours)
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    const filtered = history.filter(msg => msg.timestamp.getTime() > cutoff);

    this.messageHistory.set(nodeId, filtered);
  }

  private calculateMetrics(messages: ConsensusMessage[]): BehaviorMetrics {
    if (messages.length === 0) {
      return this.createEmptyMetrics();
    }

    const messageTypes = new Map<string, number>();
    const responseTimes: number[] = [];
    const hourlyActivity = new Array(24).fill(0);
    let totalSize = 0;
    let voteConsistency = 0;

    // Analyze messages
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const type = message.type;
      messageTypes.set(type, (messageTypes.get(type) || 0) + 1);

      // Calculate response times
      if (i > 0) {
        const responseTime = message.timestamp.getTime() - messages[i - 1].timestamp.getTime();
        responseTimes.push(responseTime);
      }

      // Track hourly activity
      hourlyActivity[message.timestamp.getHours()]++;

      // Track message size
      totalSize += JSON.stringify(message.content).length;

      // Analyze voting consistency (simplified)
      if (message.type === 'VOTE') {
        voteConsistency = this.calculateVotingConsistency(messages);
      }
    }

    return {
      messageFrequency: this.calculateMessageFrequency(messages),
      averageMessageSize: totalSize / messages.length,
      messageTypes,
      votingConsistency,
      responseTimes,
      activityHours: hourlyActivity.map((count, hour) => count > 0 ? hour : -1).filter(h => h >= 0),
      networkConnections: messageTypes.size,
      bandwidthUsage: {
        upload: totalSize,
        download: totalSize // Simplified: assume equal upload/download
      }
    };
  }

  private calculateVotingConsistency(messages: ConsensusMessage[]): number {
    // Simplified voting consistency calculation
    const votes = messages.filter(m => m.type === 'VOTE');
    if (votes.length < 2) return 1;

    const voteTypes = votes.map(v => v.content.vote);
    const uniqueVotes = new Set(voteTypes);
    return 1 - (uniqueVotes.size / votes.length);
  }

  private detectAnomalies(profile: BehaviorProfile): BehaviorAnomaly[] {
    const anomalies: BehaviorAnomaly[] = [];
    const { currentMetrics, baseline } = profile;

    // Check message frequency anomaly
    const freqRatio = currentMetrics.messageFrequency / baseline.messageFrequency;
    if (freqRatio > this.config.anomalyThreshold || freqRatio < 1 / this.config.anomalyThreshold) {
      anomalies.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'UNUSUAL_MESSAGE_FREQUENCY',
        severity: freqRatio > 3 ? 'HIGH' : 'MEDIUM',
        description: `Message frequency ${freqRatio.toFixed(2)}x baseline`,
        metrics: { current: currentMetrics.messageFrequency, baseline: baseline.messageFrequency },
        confidence: Math.min(0.95, Math.abs(Math.log(freqRatio)) / 2)
      });
    }

    // Check voting pattern anomaly
    const votingDiff = Math.abs(currentMetrics.votingConsistency - this.getTypicalVotingConsistency(baseline));
    if (votingDiff > 0.3) {
      anomalies.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'VOTING_PATTERN_CHANGE',
        severity: votingDiff > 0.6 ? 'HIGH' : 'MEDIUM',
        description: `Voting consistency changed by ${(votingDiff * 100).toFixed(1)}%`,
        metrics: { current: currentMetrics.votingConsistency, baseline: this.getTypicalVotingConsistency(baseline) },
        confidence: votingDiff
      });
    }

    // Check timing anomalies
    if (currentMetrics.responseTimes.length > 0) {
      const avgResponseTime = currentMetrics.responseTimes.reduce((a, b) => a + b, 0) / currentMetrics.responseTimes.length;
      const baselineTiming = this.getTypicalResponseTime(baseline);
      const timingRatio = avgResponseTime / baselineTiming;

      if (timingRatio > 2 || timingRatio < 0.5) {
        anomalies.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'TIMING_ANOMALY',
          severity: timingRatio > 3 ? 'HIGH' : 'MEDIUM',
          description: `Response time ${timingRatio.toFixed(2)}x baseline`,
          metrics: { current: avgResponseTime, baseline: baselineTiming },
          confidence: Math.min(0.9, Math.abs(Math.log(timingRatio)))
        });
      }
    }

    return anomalies;
  }

  private getTypicalVotingConsistency(baseline: BehaviorBaseline): number {
    // Calculate typical voting consistency from baseline
    if (baseline.votingPatterns.length === 0) return 0.8;
    return baseline.votingPatterns.reduce((sum, p) => sum + p.consistency, 0) / baseline.votingPatterns.length;
  }

  private getTypicalResponseTime(baseline: BehaviorBaseline): number {
    // Calculate typical response time from baseline
    if (baseline.timingPatterns.length === 0) return 1000;
    return baseline.timingPatterns.reduce((sum, p) => sum + p.typicalDelay, 0) / baseline.timingPatterns.length;
  }

  private calculateRiskScore(profile: BehaviorProfile): number {
    let riskScore = 0.5; // Base risk

    // Add risk for recent anomalies
    const recentAnomalies = profile.anomalies.filter(a =>
      Date.now() - a.timestamp.getTime() < 60 * 60 * 1000 // Last hour
    );

    for (const anomaly of recentAnomalies) {
      let anomalyRisk = 0;

      switch (anomaly.severity) {
        case 'CRITICAL': anomalyRisk = 0.3; break;
        case 'HIGH': anomalyRisk = 0.2; break;
        case 'MEDIUM': anomalyRisk = 0.1; break;
        case 'LOW': anomalyRisk = 0.05; break;
      }

      riskScore += anomalyRisk * anomaly.confidence;
    }

    // Cap risk score between 0 and 1
    return Math.min(1, Math.max(0, riskScore));
  }

  private shouldUpdateBaseline(profile: BehaviorProfile): boolean {
    // Update baseline if we have enough recent data and risk is low
    const recentAnomalies = profile.anomalies.filter(a =>
      Date.now() - a.timestamp.getTime() < 60 * 60 * 1000 // Last hour
    );

    return profile.riskScore < 0.6 && recentAnomalies.length < 2;
  }

  private updateBaseline(profile: BehaviorProfile): BehaviorBaseline {
    // Blend baseline with current metrics
    const newBaseline = { ...profile.baseline };

    // Update message frequency
    newBaseline.messageFrequency = this.blendValue(
      newBaseline.messageFrequency,
      profile.currentMetrics.messageFrequency,
      this.config.learningRate
    );

    // Update average message size
    newBaseline.averageMessageSize = this.blendValue(
      newBaseline.averageMessageSize,
      profile.currentMetrics.averageMessageSize,
      this.config.learningRate
    );

    return newBaseline;
  }

  private blendValue(oldValue: number, newValue: number, learningRate: number): number {
    return oldValue * (1 - learningRate) + newValue * learningRate;
  }

  private compareVotingPatterns(profile1: BehaviorProfile, profile2: BehaviorProfile): number {
    const consistency1 = profile1.currentMetrics.votingConsistency;
    const consistency2 = profile2.currentMetrics.votingConsistency;
    const diff = Math.abs(consistency1 - consistency2);
    return 1 - diff;
  }

  private compareTimingPatterns(profile1: BehaviorProfile, profile2: BehaviorProfile): number {
    const times1 = profile1.currentMetrics.responseTimes;
    const times2 = profile2.currentMetrics.responseTimes;

    if (times1.length === 0 || times2.length === 0) return 0;

    const avg1 = times1.reduce((a, b) => a + b, 0) / times1.length;
    const avg2 = times2.reduce((a, b) => a + b, 0) / times2.length;
    const diff = Math.abs(avg1 - avg2);
    const maxAvg = Math.max(avg1, avg2);

    return maxAvg > 0 ? 1 - (diff / maxAvg) : 1;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.profiles.clear();
    this.messageHistory.clear();
    this.analysisHistory.clear();

    console.log('Behavior Analyzer cleanup completed');
  }
}

export interface BehaviorSimilarity {
  similarity: number; // 0-1
  commonPatterns: string[];
}