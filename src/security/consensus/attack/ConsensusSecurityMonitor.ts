/**
 * Consensus Security Monitor - Advanced attack detection and threat analysis
 * Detects Byzantine, Sybil, Eclipse, and DoS attacks with behavioral analysis
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Buffer } from 'buffer';
import {
  AttackEvent,
  AttackType,
  AttackSeverity,
  MitigationAction,
  ReputationScore,
  MessageRate,
  SecurityMetrics
} from '../types/ConsensusSecurityTypes.js';
import { BehaviorAnalyzer } from './BehaviorAnalyzer.js';
import { ReputationSystem } from './ReputationSystem.js';
import { SecurityAlertSystem } from './SecurityAlertSystem.js';
import { ForensicLogger } from './ForensicLogger.js';

export interface SecurityConfig {
  byzantineThreshold: number;
  sybilThreshold: number;
  eclipseThreshold: number;
  dosThreshold: number;
  reputationDecayRate: number;
  suspicionThreshold: number;
  monitoringWindow: number;
}

export interface ConsensusRound {
  roundId: string;
  participants: Participant[];
  messages: ConsensusMessage[];
  startTime: Date;
  endTime?: Date;
  outcome: 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
}

export interface Participant {
  nodeId: string;
  publicKey: string;
  endpoint: string;
  reputation: number;
  contribution?: any;
}

export interface ConsensusMessage {
  messageId: string;
  senderId: string;
  type: 'PROPOSAL' | 'VOTE' | 'COMMIT' | 'ABORT';
  content: any;
  timestamp: Date;
  signature?: string;
}

export interface NetworkStatistics {
  totalMessages: number;
  averageLatency: number;
  messageRates: Map<string, MessageRate>;
  activeConnections: number;
  networkPartitions: string[];
}

export class ConsensusSecurityMonitor extends EventEmitter {
  private config: SecurityConfig;

  // Analysis components
  private behaviorAnalyzer: BehaviorAnalyzer;
  private reputationSystem: ReputationSystem;
  private alertSystem: SecurityAlertSystem;
  private forensicLogger: ForensicLogger;

  // Monitoring state
  private isActive: boolean = false;
  private knownParticipants: Map<string, Participant> = new Map();
  private recentRounds: ConsensusRound[] = [];
  private networkStats: NetworkStatistics;
  private securityEvents: AttackEvent[] = [];

  // Attack detection state
  private suspiciousPatterns: Map<string, any> = new Map();
  private rateLimiters: Map<string, any> = new Map();
  private behaviorBaselines: Map<string, any> = new Map();

  constructor() {
    super();

    // Initialize components
    this.behaviorAnalyzer = new BehaviorAnalyzer();
    this.reputationSystem = new ReputationSystem();
    this.alertSystem = new SecurityAlertSystem();
    this.forensicLogger = new ForensicLogger();

    // Initialize network statistics
    this.networkStats = {
      totalMessages: 0,
      averageLatency: 0,
      messageRates: new Map(),
      activeConnections: 0,
      networkPartitions: []
    };

    // Default configuration
    this.config = {
      byzantineThreshold: 0.3,
      sybilThreshold: 5,
      eclipseThreshold: 0.2,
      dosThreshold: 1000, // messages per second
      reputationDecayRate: 0.01,
      suspicionThreshold: 0.7,
      monitoringWindow: 300000 // 5 minutes
    };
  }

  /**
   * Configure security monitoring
   */
  async configure(config: Partial<SecurityConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    await this.behaviorAnalyzer.configure(config);
    await this.reputationSystem.configure(config);
    await this.alertSystem.configure(config);

    console.log('Security monitor configured', this.config);
  }

  /**
   * Start security monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.isActive = true;

    // Start continuous monitoring
    this.startContinuousMonitoring();

    // Initialize behavior baselines
    await this.initializeBehaviorBaselines();

    console.log('Security monitoring started');
  }

  /**
   * Stop security monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isActive = false;

    console.log('Security monitoring stopped');
  }

  /**
   * Start continuous monitoring loop
   */
  private startContinuousMonitoring(): void {
    setInterval(async () => {
      if (this.isActive) {
        await this.performSecurityAnalysis();
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Initialize behavior baselines
   */
  private async initializeBehaviorBaselines(): Promise<void> {
    for (const [nodeId, participant] of this.knownParticipants) {
      const baseline = await this.behaviorAnalyzer.establishBaseline(nodeId);
      this.behaviorBaselines.set(nodeId, baseline);
    }
  }

  /**
   * Perform comprehensive security analysis
   */
  private async performSecurityAnalysis(): Promise<void> {
    try {
      // Analyze network behavior
      await this.analyzeNetworkBehavior();

      // Check for attacks
      const attacks = await this.detectAllAttacks();

      // Process detected attacks
      for (const attack of attacks) {
        await this.handleDetectedAttack(attack);
      }

      // Update network statistics
      this.updateNetworkStatistics();

    } catch (error) {
      console.error('Security analysis failed:', error);
    }
  }

  /**
   * Analyze overall network behavior
   */
  private async analyzeNetworkBehavior(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;

    // Analyze message patterns
    for (const [nodeId, participant] of this.knownParticipants) {
      const messages = this.getRecentMessages(nodeId, windowStart);
      const behavior = await this.behaviorAnalyzer.analyzeBehavior(nodeId, messages);

      // Update reputation based on behavior
      await this.reputationSystem.updateReputation(nodeId, behavior);
    }
  }

  /**
   * Get recent messages for a node
   */
  private getRecentMessages(nodeId: string, since: number): ConsensusMessage[] {
    const messages: ConsensusMessage[] = [];

    for (const round of this.recentRounds) {
      for (const message of round.messages) {
        if (message.senderId === nodeId && message.timestamp.getTime() > since) {
          messages.push(message);
        }
      }
    }

    return messages;
  }

  /**
   * Detect all types of attacks
   */
  private async detectAllAttacks(): Promise<AttackEvent[]> {
    const attacks: AttackEvent[] = [];

    // Detect Byzantine attacks
    const byzantineAttacks = await this.detectByzantineAttacks();
    attacks.push(...byzantineAttacks);

    // Detect Sybil attacks
    const sybilAttacks = await this.detectSybilAttacks();
    attacks.push(...sybilAttacks);

    // Detect Eclipse attacks
    const eclipseAttacks = await this.detectEclipseAttacks();
    attacks.push(...eclipseAttacks);

    // Detect DoS attacks
    const dosAttacks = await this.detectDoSAttacks();
    attacks.push(...dosAttacks);

    return attacks;
  }

  /**
   * Detect Byzantine attacks
   */
  async detectByzantineAttacks(rounds?: ConsensusRound[]): Promise<AttackEvent[]> {
    const attacks: AttackEvent[] = [];
    const analysisRounds = rounds || this.recentRounds.slice(-10); // Analyze last 10 rounds

    for (const round of analysisRounds) {
      const contradictions = this.detectContradictoryMessages(round.messages);
      if (contradictions.length > 0) {
        attacks.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'BYZANTINE_ATTACK',
          severity: 'HIGH',
          nodeId: contradictions[0].nodeId,
          details: {
            roundId: round.roundId,
            contradictions: contradictions,
            participants: round.participants.map(p => p.nodeId)
          },
          confidence: this.calculateByzantineConfidence(contradictions)
        });
      }

      // Detect timing-based attacks
      const timingAnomalies = this.detectTimingAnomalies(round.messages);
      if (timingAnomalies.length > 0) {
        attacks.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'TIMING_ATTACK',
          severity: 'MEDIUM',
          nodeId: timingAnomalies[0].nodeId,
          details: {
            roundId: round.roundId,
            timingAnomalies: timingAnomalies
          },
          confidence: 0.8
        });
      }

      // Detect collusion patterns
      const collusionPatterns = await this.detectCollusion(round.participants, round.messages);
      if (collusionPatterns.length > 0) {
        attacks.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'COLLUSION_ATTACK',
          severity: 'HIGH',
          details: {
            roundId: round.roundId,
            collusionPatterns: collusionPatterns
          },
          confidence: 0.85
        });
      }
    }

    return attacks;
  }

  /**
   * Detect contradictory messages from same node
   */
  private detectContradictoryMessages(messages: ConsensusMessage[]): any[] {
    const contradictions: any[] = [];
    const nodeMessages: Map<string, ConsensusMessage[]> = new Map();

    // Group messages by node
    for (const message of messages) {
      if (!nodeMessages.has(message.senderId)) {
        nodeMessages.set(message.senderId, []);
      }
      nodeMessages.get(message.senderId)!.push(message);
    }

    // Check for contradictions
    for (const [nodeId, nodeMsgs] of nodeMessages) {
      if (this.hasContradictoryVotes(nodeMsgs)) {
        contradictions.push({
          nodeId: nodeId,
          messages: nodeMsgs,
          contradiction: this.identifyContradiction(nodeMsgs)
        });
      }
    }

    return contradictions;
  }

  /**
   * Check if messages contain contradictory votes
   */
  private hasContradictoryVotes(messages: ConsensusMessage[]): boolean {
    const votes = messages.filter(m => m.type === 'VOTE');
    const uniqueVotes = new Set(votes.map(m => JSON.stringify(m.content)));

    // Check if node voted for conflicting outcomes
    return uniqueVotes.size > 1;
  }

  /**
   * Identify specific contradiction
   */
  private identifyContradiction(messages: ConsensusMessage[]): string {
    const votes = messages.filter(m => m.type === 'VOTE');
    const outcomes = votes.map(m => m.content.outcome);

    return `Contradictory votes for: ${outcomes.join(', ')}`;
  }

  /**
   * Calculate confidence in Byzantine attack detection
   */
  private calculateByzantineConfidence(contradictions: any[]): number {
    // Base confidence on number and severity of contradictions
    const baseConfidence = Math.min(0.95, contradictions.length * 0.3);
    const severityBoost = contradictions.some(c => c.severity === 'HIGH') ? 0.1 : 0;
    return Math.min(1.0, baseConfidence + severityBoost);
  }

  /**
   * Detect timing anomalies in message patterns
   */
  private detectTimingAnomalies(messages: ConsensusMessage[]): any[] {
    const anomalies: any[] = [];
    const nodeTimestamps: Map<string, number[]> = new Map();

    // Collect message timestamps per node
    for (const message of messages) {
      if (!nodeTimestamps.has(message.senderId)) {
        nodeTimestamps.set(message.senderId, []);
      }
      nodeTimestamps.get(message.senderId)!.push(message.timestamp.getTime());
    }

    // Detect abnormal timing patterns
    for (const [nodeId, timestamps] of nodeTimestamps) {
      if (timestamps.length < 3) continue;

      // Calculate timing variance
      const intervals = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - mean, 2);
      }, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // Flag suspicious timing patterns
      if (stdDev < 10 || stdDev > 30000) { // Too regular or too erratic
        anomalies.push({
          nodeId: nodeId,
          pattern: stdDev < 10 ? 'TOO_REGULAR' : 'TOO_ERRATIC',
          stdDev: stdDev,
          timestamps: timestamps
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect collusion patterns between nodes
   */
  private async detectCollusion(
    participants: Participant[],
    messages: ConsensusMessage[]
  ): Promise<any[]> {
    const patterns: any[] = [];

    // Analyze voting patterns for coordinated behavior
    const voteGroups = this.groupVotesByOutcome(messages);
    const suspiciousGroups = this.identifySuspiciousVoteGroups(voteGroups);

    for (const group of suspiciousGroups) {
      if (group.voters.length >= 3) { // Require at least 3 colluding nodes
        patterns.push({
          type: 'COORDINATED_VOTING',
          voters: group.voters,
          outcome: group.outcome,
          confidence: this.calculateCollusionConfidence(group)
        });
      }
    }

    // Analyze message timing for coordination
    const timingGroups = this.analyzeMessageTiming(messages);
    patterns.push(...timingGroups);

    return patterns;
  }

  /**
   * Group votes by outcome
   */
  private groupVotesByOutcome(messages: ConsensusMessage[]): any[] {
    const votes = messages.filter(m => m.type === 'VOTE');
    const groups: Map<string, string[]> = new Map();

    for (const vote of votes) {
      const outcome = JSON.stringify(vote.content.outcome);
      if (!groups.has(outcome)) {
        groups.set(outcome, []);
      }
      groups.get(outcome)!.push(vote.senderId);
    }

    return Array.from(groups.entries()).map(([outcome, voters]) => ({
      outcome,
      voters
    }));
  }

  /**
   * Identify suspicious voting groups
   */
  private identifySuspiciousVoteGroups(voteGroups: any[]): any[] {
    const suspicious: any[] = [];

    for (const group of voteGroups) {
      // Check if this is a minority vote that coordinated
      if (group.voters.length < voteGroups.length / 2) {
        const voterReputations = group.voters.map((voterId: string) => {
          const participant = this.knownParticipants.get(voterId);
          return participant ? participant.reputation : 0.5;
        });

        const avgReputation = voterReputations.reduce((a: number, b: number) => a + b, 0) / voterReputations.length;

        // Flag if group has unusually high reputation for a minority vote
        if (avgReputation > 0.7) {
          suspicious.push({
            ...group,
            avgReputation,
            suspicionType: 'MINORITY_HIGH_REPUTATION'
          });
        }
      }
    }

    return suspicious;
  }

  /**
   * Calculate collusion confidence
   */
  private calculateCollusionConfidence(group: any): number {
    const baseConfidence = Math.min(0.9, group.voters.length * 0.2);
    const reputationBoost = group.avgReputation > 0.8 ? 0.1 : 0;
    return Math.min(1.0, baseConfidence + reputationBoost);
  }

  /**
   * Analyze message timing for coordination
   */
  private analyzeMessageTiming(messages: ConsensusMessage[]): any[] {
    const patterns: any[] = [];

    // Group messages by type and analyze timing
    const messagesByType = new Map<string, ConsensusMessage[]>();
    for (const message of messages) {
      if (!messagesByType.has(message.type)) {
        messagesByType.set(message.type, []);
      }
      messagesByType.get(message.type)!.push(message);
    }

    for (const [type, typeMessages] of messagesByType) {
      if (typeMessages.length < 3) continue;

      // Sort by timestamp
      typeMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Look for clusters of messages sent in quick succession
      for (let i = 0; i < typeMessages.length - 2; i++) {
        const cluster = typeMessages.slice(i, i + 3);
        const timeSpan = cluster[2].timestamp.getTime() - cluster[0].timestamp.getTime();

        if (timeSpan < 1000) { // Messages within 1 second
          patterns.push({
            type: 'TIMING_COORDINATION',
            messageType: type,
            senders: cluster.map(m => m.senderId),
            timeSpan: timeSpan,
            timestamps: cluster.map(m => m.timestamp.getTime())
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect Sybil attacks
   */
  async detectSybilAttacks(): Promise<AttackEvent[]> {
    const attacks: AttackEvent[] = [];

    // Analyze node characteristics for Sybil patterns
    const nodeGroups = this.groupNodesByCharacteristics();
    const suspiciousGroups = this.identifySuspiciousNodeGroups(nodeGroups);

    for (const group of suspiciousGroups) {
      if (group.nodes.length >= this.config.sybilThreshold) {
        attacks.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'SYBIL_ATTACK',
          severity: 'HIGH',
          details: {
            characteristics: group.characteristics,
            nodes: group.nodes,
            suspicionScore: group.suspicionScore,
            evidence: group.evidence
          },
          confidence: group.suspicionScore
        });
      }
    }

    // Check for behavior similarity between nodes
    const similarBehaviors = await this.detectSimilarBehaviors();
    for (const similarity of similarBehaviors) {
      if (similarity.score > 0.9) {
        attacks.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'SYBIL_ATTACK',
          severity: 'MEDIUM',
          nodeId: similarity.node1Id,
          details: {
            type: 'BEHAVIOR_SIMILARITY',
            node1Id: similarity.node1Id,
            node2Id: similarity.node2Id,
            similarityScore: similarity.score,
            sharedPatterns: similarity.patterns
          },
          confidence: similarity.score
        });
      }
    }

    return attacks;
  }

  /**
   * Group nodes by characteristics
   */
  private groupNodesByCharacteristics(): Map<string, Participant[]> {
    const groups = new Map<string, Participant[]>();

    for (const [nodeId, participant] of this.knownParticipants) {
      const characteristics = this.extractNodeCharacteristics(participant);

      if (!groups.has(characteristics)) {
        groups.set(characteristics, []);
      }

      groups.get(characteristics)!.push(participant);
    }

    return groups;
  }

  /**
   * Extract node characteristics for grouping
   */
  private extractNodeCharacteristics(participant: Participant): string {
    // Extract IP subnet, version, timing patterns, etc.
    const endpoint = participant.endpoint;
    const subnet = endpoint.split('.').slice(0, 3).join('.');
    const reputation = Math.floor(participant.reputation * 10) / 10; // Round to 1 decimal

    return `${subnet}:rep${reputation}:v${participant.publicKey.slice(0, 8)}`;
  }

  /**
   * Identify suspicious node groups
   */
  private identifySuspiciousNodeGroups(nodeGroups: Map<string, Participant[]>): any[] {
    const suspicious: any[] = [];

    for (const [characteristics, nodes] of nodeGroups) {
      if (nodes.length >= this.config.sybilThreshold) {
        const suspicionScore = this.calculateSybilSuspicion(nodes);
        const evidence = this.gatherSybilEvidence(nodes);

        suspicious.push({
          characteristics,
          nodes: nodes.map(n => ({ nodeId: this.getNodeId(n), endpoint: n.endpoint })),
          suspicionScore,
          evidence
        });
      }
    }

    return suspicious;
  }

  /**
   * Calculate Sybil attack suspicion score
   */
  private calculateSybilSuspicion(nodes: Participant[]): number {
    let suspicion = 0;

    // Base suspicion on group size
    suspicion += Math.min(0.5, nodes.length * 0.05);

    // Increase suspicion if nodes have similar behavior
    const avgReputation = nodes.reduce((sum, n) => sum + n.reputation, 0) / nodes.length;
    if (avgReputation < 0.3) { // Low reputation suggests fake nodes
      suspicion += 0.3;
    }

    // Check for coordinated join times (would need join timestamp data)
    // This is a simplified check
    if (nodes.length > 10) {
      suspicion += 0.2;
    }

    return Math.min(1.0, suspicion);
  }

  /**
   * Gather evidence for Sybil attack
   */
  private gatherSybilEvidence(nodes: Participant[]): any {
    return {
      groupSize: nodes.length,
      averageReputation: nodes.reduce((sum, n) => sum + n.reputation, 0) / nodes.length,
      endpointSimilarity: this.calculateEndpointSimilarity(nodes),
      publicKeySimilarity: this.calculatePublicKeySimilarity(nodes)
    };
  }

  /**
   * Calculate endpoint similarity
   */
  private calculateEndpointSimilarity(nodes: Participant[]): number {
    if (nodes.length < 2) return 0;

    const subnets = nodes.map(n => n.endpoint.split('.').slice(0, 3).join('.'));
    const uniqueSubnets = new Set(subnets);

    return 1 - (uniqueSubnets.size / subnets.length); // Higher if more share subnets
  }

  /**
   * Calculate public key similarity
   */
  private calculatePublicKeySimilarity(nodes: Participant[]): number {
    // This would analyze key patterns, prefix similarity, etc.
    // Simplified implementation
    return 0.5;
  }

  /**
   * Get node ID from participant
   */
  private getNodeId(participant: Participant): string {
    // In a real implementation, the participant would have a nodeId field
    // For now, hash the public key
    return crypto.createHash('sha256').update(participant.publicKey).digest('hex').slice(0, 16);
  }

  /**
   * Detect similar behaviors between nodes
   */
  private async detectSimilarBehaviors(): Promise<any[]> {
    const similarities: any[] = [];
    const nodeIds = Array.from(this.knownParticipants.keys());

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const node1Id = nodeIds[i];
        const node2Id = nodeIds[j];

        const behavior1 = await this.behaviorAnalyzer.getBehaviorProfile(node1Id);
        const behavior2 = await this.behaviorAnalyzer.getBehaviorProfile(node2Id);

        const similarity = this.compareBehaviors(behavior1, behavior2);

        if (similarity.score > 0.8) {
          similarities.push({
            node1Id,
            node2Id,
            score: similarity.score,
            patterns: similarity.commonPatterns
          });
        }
      }
    }

    return similarities;
  }

  /**
   * Compare two behavior profiles
   */
  private compareBehaviors(behavior1: any, behavior2: any): any {
    // Simplified behavior comparison
    const patterns = this.findCommonPatterns(behavior1, behavior2);
    const score = patterns.length > 0 ? 0.85 : 0.3;

    return {
      score,
      commonPatterns: patterns
    };
  }

  /**
   * Find common patterns between two behaviors
   */
  private findCommonPatterns(behavior1: any, behavior2: any): string[] {
    const common: string[] = [];

    // Compare message timing patterns
    if (Math.abs(behavior1.avgMessageInterval - behavior2.avgMessageInterval) < 1000) {
      common.push('SIMILAR_MESSAGE_TIMING');
    }

    // Compare vote patterns
    if (JSON.stringify(behavior1.votePatterns) === JSON.stringify(behavior2.votePatterns)) {
      common.push('IDENTICAL_VOTE_PATTERNS');
    }

    // Compare activity patterns
    if (behavior1.activeHours.length > 0 && behavior2.activeHours.length > 0) {
      const overlap = this.calculateHourOverlap(behavior1.activeHours, behavior2.activeHours);
      if (overlap > 0.8) {
        common.push('SIMILAR_ACTIVE_HOURS');
      }
    }

    return common;
  }

  /**
   * Calculate overlap between hour arrays
   */
  private calculateHourOverlap(hours1: number[], hours2: number[]): number {
    const set1 = new Set(hours1);
    const set2 = new Set(hours2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Detect Eclipse attacks
   */
  async detectEclipseAttacks(): Promise<AttackEvent[]> {
    const attacks: AttackEvent[] = [];

    // Check if we're isolated from honest peers
    const honestPeers = this.countHonestPeers();
    const totalPeers = this.knownParticipants.size;

    if (honestPeers < totalPeers * (1 - this.config.eclipseThreshold)) {
      attacks.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'ECLIPSE_ATTACK',
        severity: 'CRITICAL',
        details: {
          honestPeers,
          totalPeers,
          honestRatio: honestPeers / totalPeers,
          suspiciousPeers: totalPeers - honestPeers
        },
        confidence: 0.9
      });
    }

    // Check for network partition indicators
    const partitionEvidence = this.detectNetworkPartition();
    if (partitionEvidence.isPartitioned) {
      attacks.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'ECLIPSE_ATTACK',
        severity: 'HIGH',
        details: {
          type: 'NETWORK_PARTITION',
          evidence: partitionEvidence
        },
        confidence: 0.8
      });
    }

    return attacks;
  }

  /**
   * Count honest peers based on reputation
   */
  private countHonestPeers(): number {
    let honestCount = 0;

    for (const participant of this.knownParticipants.values()) {
      if (participant.reputation > 0.6) {
        honestCount++;
      }
    }

    return honestCount;
  }

  /**
   * Detect network partition
   */
  private detectNetworkPartition(): any {
    // Check message connectivity
    const connectivity = this.analyzeConnectivity();

    // Check for isolated clusters
    const clusters = this.identifyNetworkClusters();

    return {
      isPartitioned: connectivity < 0.7 || clusters.length > 1,
      connectivity,
      clusters,
      messageGaps: this.detectMessageGaps()
    };
  }

  /**
   * Analyze network connectivity
   */
  private analyzeConnectivity(): number {
    // Simplified connectivity analysis
    // In practice, this would analyze actual network topology
    const activeNodes = Array.from(this.knownParticipants.keys()).filter(nodeId =>
      this.isNodeActive(nodeId)
    );

    if (activeNodes.length === 0) return 0;

    // Calculate connectivity as ratio of active connections to possible connections
    const possibleConnections = activeNodes.length * (activeNodes.length - 1) / 2;
    const actualConnections = this.countActiveConnections(activeNodes);

    return actualConnections / possibleConnections;
  }

  /**
   * Check if node is active
   */
  private isNodeActive(nodeId: string): boolean {
    const recentMessages = this.getRecentMessages(nodeId, Date.now() - 60000); // Last minute
    return recentMessages.length > 0;
  }

  /**
   * Count active connections between nodes
   */
  private countActiveConnections(nodes: string[]): number {
    // Simplified connection counting
    // In practice, this would track actual network connections
    return nodes.length * 0.8; // Assume 80% connectivity
  }

  /**
   * Identify network clusters
   */
  private identifyNetworkClusters(): string[][] {
    // Simplified cluster detection
    // In practice, this would use graph clustering algorithms
    const nodes = Array.from(this.knownParticipants.keys());
    return [nodes]; // Assume single cluster for now
  }

  /**
   * Detect message gaps indicating partition
   */
  private detectMessageGaps(): any[] {
    const gaps: any[] = [];

    // Analyze recent rounds for missing participants
    for (const round of this.recentRounds.slice(-5)) {
      const expectedParticipants = round.participants.length;
      const actualParticipants = new Set(round.messages.map(m => m.senderId)).size;

      if (actualParticipants < expectedParticipants * 0.8) {
        gaps.push({
          roundId: round.roundId,
          expected: expectedParticipants,
          actual: actualParticipants,
          missing: expectedParticipants - actualParticipants
        });
      }
    }

    return gaps;
  }

  /**
   * Detect DoS attacks
   */
  async detectDoSAttacks(): Promise<AttackEvent[]> {
    const attacks: AttackEvent[] = [];

    // Check for unusually high message rates
    const messageRates = await this.calculateMessageRates();

    for (const [nodeId, rate] of messageRates) {
      if (rate.messagesPerSecond > this.config.dosThreshold) {
        attacks.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'DOS_ATTACK',
          severity: 'HIGH',
          nodeId: nodeId,
          details: {
            messageRate: rate.messagesPerSecond,
            averageSize: rate.averageSize,
            threshold: this.config.dosThreshold,
            timeWindow: rate.timeWindow
          },
          confidence: Math.min(1.0, rate.messagesPerSecond / this.config.dosThreshold)
        });
      }
    }

    // Check for resource exhaustion patterns
    const resourceAttacks = await this.detectResourceExhaustion();
    attacks.push(...resourceAttacks);

    return attacks;
  }

  /**
   * Calculate message rates for all nodes
   */
  private async calculateMessageRates(): Promise<Map<string, MessageRate>> {
    const rates = new Map<string, MessageRate>();
    const timeWindow = 60000; // 1 minute
    const now = Date.now();

    for (const [nodeId, participant] of this.knownParticipants) {
      const recentMessages = this.getRecentMessages(nodeId, now - timeWindow);

      if (recentMessages.length > 0) {
        const totalSize = recentMessages.reduce((sum, msg) => {
          return sum + JSON.stringify(msg.content).length;
        }, 0);

        rates.set(nodeId, {
          nodeId: nodeId,
          messagesPerSecond: recentMessages.length / (timeWindow / 1000),
          averageSize: totalSize / recentMessages.length,
          peakRate: this.calculatePeakRate(recentMessages),
          timeWindow: timeWindow
        });
      }
    }

    return rates;
  }

  /**
   * Calculate peak message rate
   */
  private calculatePeakRate(messages: ConsensusMessage[]): number {
    if (messages.length < 2) return 0;

    let maxRate = 0;
    for (let i = 1; i < messages.length; i++) {
      const interval = messages[i].timestamp.getTime() - messages[i - 1].timestamp.getTime();
      const rate = 1000 / interval; // messages per second
      maxRate = Math.max(maxRate, rate);
    }

    return maxRate;
  }

  /**
   * Detect resource exhaustion attacks
   */
  private async detectResourceExhaustion(): Promise<AttackEvent[]> {
    const attacks: AttackEvent[] = [];

    // Check for memory exhaustion patterns
    const memoryAttacks = await this.detectMemoryExhaustion();
    attacks.push(...memoryAttacks);

    // Check for CPU exhaustion patterns
    const cpuAttacks = await this.detectCPUExhaustion();
    attacks.push(...cpuAttacks);

    return attacks;
  }

  /**
   * Detect memory exhaustion attacks
   */
  private async detectMemoryExhaustion(): Promise<AttackEvent[]> {
    // This would monitor memory usage patterns
    // Simplified implementation for demonstration
    return [];
  }

  /**
   * Detect CPU exhaustion attacks
   */
  private async detectCPUExhaustion(): Promise<AttackEvent[]> {
    // This would monitor CPU usage patterns
    // Simplified implementation for demonstration
    return [];
  }

  /**
   * Handle detected attack
   */
  private async handleDetectedAttack(attack: AttackEvent): Promise<void> {
    // Log the attack
    await this.forensicLogger.logAttack(attack);

    // Update reputation scores
    if (attack.nodeId) {
      await this.reputationSystem.penalizeNode(attack.nodeId, attack.severity);
    }

    // Emit attack event
    this.emit('attackDetected', attack);

    // Trigger automated response
    await this.triggerAutomatedResponse(attack);

    console.log(`Attack detected: ${attack.type} from ${attack.nodeId || 'unknown'}`);
  }

  /**
   * Trigger automated response to attack
   */
  private async triggerAutomatedResponse(attack: AttackEvent): Promise<void> {
    const response = await this.determineResponse(attack);

    if (response) {
      await this.executeResponse(response);
      attack.mitigation = response;

      console.log(`Automated response executed: ${response.type} on ${response.target}`);
    }
  }

  /**
   * Determine appropriate response to attack
   */
  private async determineResponse(attack: AttackEvent): Promise<MitigationAction | null> {
    switch (attack.type) {
      case 'SYBIL_ATTACK':
        return {
          type: 'REPUTATION_PENALTY',
          target: attack.nodeId || 'multiple',
          parameters: { severity: attack.severity, penalty: 0.5 }
        };

      case 'ECLIPSE_ATTACK':
        return {
          type: 'CONNECTION_FILTER',
          target: 'network',
          parameters: { enforceDiversity: true, maxConnectionsPerSource: 2 }
        };

      case 'DOS_ATTACK':
        return {
          type: 'RATE_LIMIT',
          target: attack.nodeId || 'network',
          parameters: { maxRate: 100, windowMs: 60000 }
        };

      case 'BYZANTINE_ATTACK':
        return {
          type: 'NODE_ISOLATION',
          target: attack.nodeId || 'multiple',
          parameters: { duration: 300000 } // 5 minutes
        };

      default:
        return null;
    }
  }

  /**
   * Execute mitigation response
   */
  private async executeResponse(response: MitigationAction): Promise<void> {
    // This would execute the actual mitigation
    // For demonstration, we'll just log it
    console.log(`Executing mitigation: ${response.type} on ${response.target}`);
  }

  /**
   * Update network statistics
   */
  private updateNetworkStatistics(): void {
    // Calculate updated statistics
    const now = Date.now();
    const recentMessages = this.getAllRecentMessages(now - 60000); // Last minute

    this.networkStats.totalMessages += recentMessages.length;
    this.networkStats.averageLatency = this.calculateAverageLatency(recentMessages);

    // Update message rates
    for (const message of recentMessages) {
      const rate = this.networkStats.messageRates.get(message.senderId);
      if (rate) {
        rate.messagesPerSecond = Math.min(rate.messagesPerSecond + 1, rate.peakRate);
      } else {
        this.networkStats.messageRates.set(message.senderId, {
          nodeId: message.senderId,
          messagesPerSecond: 1,
          averageSize: JSON.stringify(message.content).length,
          peakRate: 10,
          timeWindow: 60000
        });
      }
    }
  }

  /**
   * Get all recent messages
   */
  private getAllRecentMessages(since: number): ConsensusMessage[] {
    const messages: ConsensusMessage[] = [];

    for (const round of this.recentRounds) {
      for (const message of round.messages) {
        if (message.timestamp.getTime() > since) {
          messages.push(message);
        }
      }
    }

    return messages;
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(messages: ConsensusMessage[]): number {
    if (messages.length < 2) return 0;

    let totalLatency = 0;
    let count = 0;

    // Group messages by round and calculate propagation delays
    const messagesByRound = new Map<string, ConsensusMessage[]>();
    for (const message of messages) {
      // Extract round ID (this would come from message content in practice)
      const roundId = 'current'; // Simplified
      if (!messagesByRound.has(roundId)) {
        messagesByRound.set(roundId, []);
      }
      messagesByRound.get(roundId)!.push(message);
    }

    for (const [roundId, roundMessages] of messagesByRound) {
      if (roundMessages.length > 1) {
        roundMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const firstMessage = roundMessages[0];
        const lastMessage = roundMessages[roundMessages.length - 1];
        totalLatency += lastMessage.timestamp.getTime() - firstMessage.timestamp.getTime();
        count++;
      }
    }

    return count > 0 ? totalLatency / count : 0;
  }

  /**
   * Add participant to monitoring
   */
  addParticipant(participant: Participant): void {
    this.knownParticipants.set(this.getNodeId(participant), participant);

    // Initialize behavior baseline for new participant
    this.behaviorAnalyzer.establishBaseline(this.getNodeId(participant));
  }

  /**
   * Remove participant from monitoring
   */
  removeParticipant(nodeId: string): void {
    this.knownParticipants.delete(nodeId);
    this.behaviorBaselines.delete(nodeId);
  }

  /**
   * Record consensus round
   */
  recordConsensusRound(round: ConsensusRound): void {
    this.recentRounds.push(round);

    // Keep only recent rounds (last 50)
    if (this.recentRounds.length > 50) {
      this.recentRounds.shift();
    }

    // Update participant reputations based on round outcome
    if (round.outcome === 'SUCCESS') {
      for (const participant of round.participants) {
        const currentReputation = participant.reputation || 0.5;
        participant.reputation = Math.min(1.0, currentReputation + 0.01);
      }
    } else if (round.outcome === 'FAILURE') {
      for (const participant of round.participants) {
        const currentReputation = participant.reputation || 0.5;
        participant.reputation = Math.max(0.0, currentReputation - 0.02);
      }
    }
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    const now = Date.now();
    const recentAttacks = this.securityEvents.filter(event =>
      now - event.timestamp.getTime() < 3600000 // Last hour
    );

    const honestNodes = Array.from(this.knownParticipants.values())
      .filter(p => p.reputation > 0.6).length;
    const maliciousNodes = Array.from(this.knownParticipants.values())
      .filter(p => p.reputation < 0.4).length;

    return {
      timestamp: new Date(),
      totalNodes: this.knownParticipants.size,
      honestNodes,
      maliciousNodes,
      consensusSuccessRate: this.calculateConsensusSuccessRate(),
      averageLatency: this.networkStats.averageLatency,
      signatureVerificationTime: 0, // Would come from signature system
      zkpGenerationTime: 0, // Would come from ZK system
      attackDetectionLatency: 0, // Would measure actual detection time
      keyRotationOverhead: 0, // Would come from key management
      threatsDetected: recentAttacks.length,
      threatsMitigated: recentAttacks.filter(a => a.mitigation).length
    };
  }

  /**
   * Calculate consensus success rate
   */
  private calculateConsensusSuccessRate(): number {
    if (this.recentRounds.length === 0) return 0;

    const successCount = this.recentRounds.filter(round => round.outcome === 'SUCCESS').length;
    return successCount / this.recentRounds.length;
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 50): AttackEvent[] {
    return this.securityEvents.slice(-limit);
  }

  /**
   * Get network statistics
   */
  getNetworkStatistics(): NetworkStatistics {
    return { ...this.networkStats };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stopMonitoring();

    await this.behaviorAnalyzer.cleanup();
    await this.reputationSystem.cleanup();
    await this.alertSystem.cleanup();
    await this.forensicLogger.cleanup();

    this.knownParticipants.clear();
    this.recentRounds = [];
    this.securityEvents = [];
    this.suspiciousPatterns.clear();
    this.rateLimiters.clear();
    this.behaviorBaselines.clear();
  }
}