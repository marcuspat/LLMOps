/**
 * Forensic Logger - Tamper-evident security event logging
 * Implements blockchain-inspired integrity chains and comprehensive audit trails
 */

import * as crypto from 'crypto';
import { AttackEvent } from '../types/ConsensusSecurityTypes.js';

export interface ForensicEntry {
  id: string;
  timestamp: Date;
  sequence: number;
  type: ForensicEntryType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  data: any;
  signature: string;
  previousHash: string;
  currentHash: string;
  metadata: ForensicMetadata;
}

export type ForensicEntryType =
  | 'ATTACK_DETECTED'
  | 'ATTACK_MITIGATED'
  | 'KEY_ROTATION'
  | 'NODE_JOINED'
  | 'NODE_LEFT'
  | 'CONSENSUS_EVENT'
  | 'SYSTEM_EVENT'
  | 'SECURITY_SCAN'
  | 'POLICY_VIOLATION'
  | 'ANOMALY_DETECTED';

export interface ForensicMetadata {
  nodeId?: string;
  sessionId?: string;
  requestId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  networkLocation?: string;
  environment: string;
  version: string;
  tags: string[];
}

export interface ForensicChain {
  id: string;
  createdAt: Date;
  entries: ForensicEntry[];
  headHash: string;
  integrityVerified: boolean;
  lastVerified: Date;
}

export interface ForensicQuery {
  type?: ForensicEntryType;
  severity?: string;
  source?: string;
  nodeId?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
  tags?: string[];
}

export interface ForensicStatistics {
  totalEntries: number;
  entriesByType: Map<ForensicEntryType, number>;
  entriesBySeverity: Map<string, number>;
  averageEntriesPerDay: number;
  chainIntegrity: boolean;
  lastEntry: Date;
  storageSize: number;
}

export class ForensicLogger {
  private chains: Map<string, ForensicChain> = new Map();
  private currentChain: ForensicChain | null = null;
  private privateSigningKey: string;
  private publicKey: string;
  private sequenceCounter: number = 0;

  constructor() {
    this.generateKeys();
    this.initializeDefaultChain();
  }

  /**
   * Initialize the logger
   */
  async initialize(): Promise<void> {
    console.log('Initializing Forensic Logger');
    this.loadChains();
  }

  /**
   * Log an attack event
   */
  async logAttack(attack: AttackEvent): Promise<void> {
    const entry: ForensicEntry = {
      id: this.generateEntryId(),
      timestamp: attack.timestamp,
      sequence: this.sequenceCounter++,
      type: 'ATTACK_DETECTED',
      severity: attack.severity,
      source: 'security-monitor',
      data: {
        attackId: attack.id,
        attackType: attack.type,
        nodeId: attack.nodeId,
        details: attack.details,
        confidence: attack.confidence,
        mitigation: attack.mitigation
      },
      signature: '',
      previousHash: '',
      currentHash: '',
      metadata: {
        nodeId: attack.nodeId,
        environment: 'production',
        version: '1.0.0',
        tags: ['attack', attack.type.toLowerCase()]
      }
    };

    await this.addEntry(entry);
    console.log(`Logged attack event: ${attack.type} from ${attack.nodeId}`);
  }

  /**
   * Log a general security event
   */
  async logEvent(
    type: ForensicEntryType,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    source: string,
    data: any,
    metadata?: Partial<ForensicMetadata>
  ): Promise<void> {
    const entry: ForensicEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      sequence: this.sequenceCounter++,
      type,
      severity,
      source,
      data,
      signature: '',
      previousHash: '',
      currentHash: '',
      metadata: {
        environment: 'production',
        version: '1.0.0',
        tags: [type.toLowerCase()],
        ...metadata
      }
    };

    await this.addEntry(entry);
  }

  /**
   * Query forensic entries
   */
  queryEntries(query: ForensicQuery): ForensicEntry[] {
    const allEntries: ForensicEntry[] = [];

    // Collect entries from all chains
    for (const chain of this.chains.values()) {
      allEntries.push(...chain.entries);
    }

    // Apply filters
    let filtered = allEntries.filter(entry => {
      // Type filter
      if (query.type && entry.type !== query.type) return false;

      // Severity filter
      if (query.severity && entry.severity !== query.severity) return false;

      // Source filter
      if (query.source && entry.source !== query.source) return false;

      // Node ID filter
      if (query.nodeId && entry.metadata.nodeId !== query.nodeId) return false;

      // Time range filter
      if (query.startTime && entry.timestamp < query.startTime) return false;
      if (query.endTime && entry.timestamp > query.endTime) return false;

      // Tags filter
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every(tag =>
          entry.metadata.tags.includes(tag)
        );
        if (!hasAllTags) return false;
      }

      return true;
    });

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    if (query.offset || query.limit) {
      const start = query.offset || 0;
      const end = start + (query.limit || 50);
      filtered = filtered.slice(start, end);
    }

    return filtered;
  }

  /**
   * Get entry by ID
   */
  getEntry(entryId: string): ForensicEntry | null {
    for (const chain of this.chains.values()) {
      const entry = chain.entries.find(e => e.id === entryId);
      if (entry) return entry;
    }
    return null;
  }

  /**
   * Verify chain integrity
   */
  async verifyChainIntegrity(chainId?: string): Promise<boolean> {
    if (chainId) {
      const chain = this.chains.get(chainId);
      if (!chain) return false;
      return this.verifySingleChain(chain);
    }

    // Verify all chains
    for (const chain of this.chains.values()) {
      if (!await this.verifySingleChain(chain)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create new chain (for chain rotation)
   */
  async createChain(description?: string): Promise<string> {
    const chainId = this.generateChainId();
    const newChain: ForensicChain = {
      id: chainId,
      createdAt: new Date(),
      entries: [],
      headHash: '',
      integrityVerified: true,
      lastVerified: new Date()
    };

    // Add chain creation entry
    const creationEntry: ForensicEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      sequence: this.sequenceCounter++,
      type: 'SYSTEM_EVENT',
      severity: 'LOW',
      source: 'forensic-logger',
      data: {
        event: 'CHAIN_CREATED',
        description: description || 'New forensic chain created',
        chainId
      },
      signature: '',
      previousHash: '',
      currentHash: '',
      metadata: {
        environment: 'production',
        version: '1.0.0',
        tags: ['system', 'chain-creation']
      }
    };

    newChain.entries.push(creationEntry);
    await this.updateChainHashes(newChain);

    this.chains.set(chainId, newChain);
    this.currentChain = newChain;

    await this.saveChains();

    console.log(`Created new forensic chain: ${chainId}`);
    return chainId;
  }

  /**
   * Get chain statistics
   */
  getStatistics(): ForensicStatistics {
    const allEntries: ForensicEntry[] = [];

    for (const chain of this.chains.values()) {
      allEntries.push(...chain.entries);
    }

    const entriesByType = new Map<ForensicEntryType, number>();
    const entriesBySeverity = new Map<string, number>();

    for (const entry of allEntries) {
      const typeCount = entriesByType.get(entry.type) || 0;
      entriesByType.set(entry.type, typeCount + 1);

      const severityCount = entriesBySeverity.get(entry.severity) || 0;
      entriesBySeverity.set(entry.severity, severityCount + 1);
    }

    // Calculate average entries per day
    const now = Date.now();
    const timeSpan = now - (this.chains.values().next().value?.createdAt.getTime() || now);
    const daysSpanned = Math.max(1, timeSpan / (24 * 60 * 60 * 1000));
    const averageEntriesPerDay = allEntries.length / daysSpanned;

    // Check chain integrity
    const chainIntegrity = this.verifyChainIntegrity();

    // Calculate storage size (simplified)
    const storageSize = JSON.stringify(allEntries).length;

    return {
      totalEntries: allEntries.length,
      entriesByType,
      entriesBySeverity,
      averageEntriesPerDay,
      chainIntegrity,
      lastEntry: allEntries.length > 0 ? allEntries[allEntries.length - 1].timestamp : new Date(),
      storageSize
    };
  }

  /**
   * Export forensic data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    const allEntries: ForensicEntry[] = [];

    for (const chain of this.chains.values()) {
      allEntries.push(...chain.entries);
    }

    if (format === 'json') {
      return JSON.stringify({
        chains: Array.from(this.chains.entries()),
        exportedAt: new Date(),
        integrity: this.verifyChainIntegrity()
      }, null, 2);
    } else if (format === 'csv') {
      // Simplified CSV export
      const headers = [
        'id', 'timestamp', 'sequence', 'type', 'severity', 'source',
        'nodeId', 'tags', 'data'
      ];
      const rows = [headers.join(',')];

      for (const entry of allEntries) {
        const row = [
          entry.id,
          entry.timestamp.toISOString(),
          entry.sequence.toString(),
          entry.type,
          entry.severity,
          entry.source,
          entry.metadata.nodeId || '',
          entry.metadata.tags.join(';'),
          JSON.stringify(entry.data).replace(/"/g, '""')
        ];
        rows.push(row.join(','));
      }

      return rows.join('\n');
    }

    return '';
  }

  /**
   * Import forensic data
   */
  async importData(data: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    if (format === 'json') {
      const parsed = JSON.parse(data);
      const importedChains = new Map(parsed.chains);

      for (const [chainId, chainData] of importedChains) {
        const chain = chainData as ForensicChain;
        if (await this.verifySingleChain(chain)) {
          this.chains.set(chainId, chain);
        } else {
          console.warn(`Skipping chain ${chainId} due to integrity verification failure`);
        }
      }
    } else if (format === 'csv') {
      // CSV import would require more complex parsing
      throw new Error('CSV import not yet implemented');
    }

    // Update current chain reference
    if (this.chains.size > 0) {
      const latestChain = Array.from(this.chains.values()).reduce((latest, chain) =>
        chain.createdAt > latest.createdAt ? chain : latest
      );
      this.currentChain = latestChain;
    }

    await this.saveChains();
    console.log('Forensic data imported successfully');
  }

  /**
   * Rotate current chain
   */
  async rotateChain(reason?: string): Promise<string> {
    console.log('Rotating forensic chain');

    const newChainId = await this.createChain(
      reason || 'Chain rotation for maintenance'
    );

    return newChainId;
  }

  /**
   * Private helper methods
   */

  private generateKeys(): void {
    // Generate RSA key pair for signing
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    this.publicKey = publicKey;
    this.privateSigningKey = privateKey;
  }

  private initializeDefaultChain(): void {
    const defaultChainId = 'default';
    const now = new Date();

    this.currentChain = {
      id: defaultChainId,
      createdAt: now,
      entries: [],
      headHash: '',
      integrityVerified: true,
      lastVerified: now
    };

    this.chains.set(defaultChainId, this.currentChain);
  }

  private async addEntry(entry: ForensicEntry): Promise<void> {
    if (!this.currentChain) {
      await this.createChain('No current chain available');
    }

    // Set previous hash
    const currentChain = this.currentChain!;
    if (currentChain.entries.length > 0) {
      entry.previousHash = currentChain.entries[currentChain.entries.length - 1].currentHash;
    }

    // Create hash for current entry
    const entryHash = this.createEntryHash(entry);
    entry.currentHash = entryHash;

    // Sign the entry
    entry.signature = this.signEntry(entry);

    // Add to chain
    currentChain.entries.push(entry);
    await this.updateChainHashes(currentChain);

    // Save chains periodically
    if (currentChain.entries.length % 10 === 0) {
      await this.saveChains();
    }
  }

  private createEntryHash(entry: ForensicEntry): string {
    const hashData = {
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      sequence: entry.sequence,
      type: entry.type,
      severity: entry.severity,
      source: entry.source,
      data: entry.data,
      previousHash: entry.previousHash
    };

    return crypto.createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
  }

  private signEntry(entry: ForensicEntry): string {
    const signData = entry.currentHash;
    const signature = crypto.sign('rsa-sha256', Buffer.from(signData), this.privateSigningKey);
    return signature.toString('base64');
  }

  private async updateChainHashes(chain: ForensicChain): Promise<void> {
    if (chain.entries.length === 0) {
      chain.headHash = '';
      return;
    }

    // Update head hash to the last entry's hash
    chain.headHash = chain.entries[chain.entries.length - 1].currentHash;

    // Verify chain integrity
    chain.integrityVerified = await this.verifySingleChain(chain);
    chain.lastVerified = new Date();
  }

  private async verifySingleChain(chain: ForensicChain): Promise<boolean> {
    try {
      for (let i = 0; i < chain.entries.length; i++) {
        const entry = chain.entries[i];

        // Verify entry hash
        const computedHash = this.createEntryHash({
          ...entry,
          currentHash: '', // Exclude current hash from computation
          signature: '' // Exclude signature from computation
        });

        if (computedHash !== entry.currentHash) {
          console.error(`Hash verification failed for entry ${entry.id}`);
          return false;
        }

        // Verify previous hash link
        if (i > 0) {
          const previousEntry = chain.entries[i - 1];
          if (entry.previousHash !== previousEntry.currentHash) {
            console.error(`Previous hash link broken for entry ${entry.id}`);
            return false;
          }
        }

        // Verify signature (simplified verification)
        const isValidSignature = this.verifySignature(entry);
        if (!isValidSignature) {
          console.error(`Signature verification failed for entry ${entry.id}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Chain verification error:', error);
      return false;
    }
  }

  private verifySignature(entry: ForensicEntry): boolean {
    try {
      const isVerified = crypto.verify(
        'rsa-sha256',
        Buffer.from(entry.currentHash),
        this.publicKey,
        Buffer.from(entry.signature, 'base64')
      );
      return isVerified;
    } catch {
      return false;
    }
  }

  private generateEntryId(): string {
    return `entry_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateChainId(): string {
    return `chain_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private async saveChains(): Promise<void> {
    // In a real implementation, this would save to persistent storage
    // For now, just log that chains would be saved
    console.log(`Saving ${this.chains.size} forensic chains`);
  }

  private loadChains(): void {
    // In a real implementation, this would load from persistent storage
    // For now, just initialize with the default chain
    console.log(`Loading ${this.chains.size} forensic chains`);
  }

  /**
   * Cleanup old entries and chains
   */
  async cleanup(maxAge: number = 90 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let totalDeleted = 0;

    for (const [chainId, chain] of this.chains) {
      const initialLength = chain.entries.length;
      chain.entries = chain.entries.filter(entry => {
        const age = now - entry.timestamp.getTime();
        return age < maxAge;
      });

      const deleted = initialLength - chain.entries.length;
      totalDeleted += deleted;

      if (deleted > 0) {
        // Recalculate hashes after cleanup
        await this.updateChainHashes(chain);

        // Remove empty chains (except default)
        if (chain.entries.length === 0 && chainId !== 'default') {
          this.chains.delete(chainId);
        }
      }
    }

    console.log(`Cleaned up ${totalDeleted} old forensic entries`);
    return totalDeleted;
  }

  /**
   * Get chain information
   */
  getChainInfo(): Array<{ id: string; entryCount: number; createdAt: Date; integrity: boolean }> {
    const chainInfo: Array<{ id: string; entryCount: number; createdAt: Date; integrity: boolean }> = [];

    for (const [chainId, chain] of this.chains) {
      chainInfo.push({
        id: chainId,
        entryCount: chain.entries.length,
        createdAt: chain.createdAt,
        integrity: chain.integrityVerified
      });
    }

    return chainInfo;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.saveChains();
    this.chains.clear();
    this.currentChain = null;
    this.sequenceCounter = 0;

    console.log('Forensic Logger cleanup completed');
  }
}