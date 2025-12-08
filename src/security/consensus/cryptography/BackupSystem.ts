/**
 * Backup System - Secure backup and recovery for key shares and configuration
 * Implements distributed backup with redundancy and integrity verification
 */

import * as crypto from 'crypto';
import { Buffer } from 'buffer';
import { EncryptionService } from './EncryptionService.js';

export interface BackupRecord {
  id: string;
  keyId: string;
  shareIndex: number;
  data: Buffer;
  encrypted: boolean;
  checksum: string;
  location: string;
  createdAt: Date;
  version: number;
  metadata?: any;
}

export interface BackupLocation {
  id: string;
  type: 'local' | 'remote' | 'cloud' | 'distributed';
  path: string;
  encrypted: boolean;
  accessible: boolean;
  lastAccess?: Date;
  size: number;
}

export interface BackupConfig {
  enabled: boolean;
  threshold: number;
  locations: string[];
  encryption: boolean;
  checksumVerification: boolean;
  automaticCleanup: boolean;
  retentionDays: number;
  compressionEnabled: boolean;
  deduplicationEnabled: boolean;
}

export interface BackupStatistics {
  totalBackups: number;
  totalSize: number;
  locations: BackupLocation[];
  oldestBackup?: Date;
  newestBackup?: Date;
  retentionCompliance: number;
  deduplicationRatio?: number;
}

export class BackupSystem {
  private backups: Map<string, BackupRecord> = new Map();
  private locations: Map<string, BackupLocation> = new Map();
  private config: BackupConfig;
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
    this.config = {
      enabled: true,
      threshold: 3,
      locations: ['local', 'remote1', 'remote2'],
      encryption: true,
      checksumVerification: true,
      automaticCleanup: true,
      retentionDays: 90,
      compressionEnabled: true,
      deduplicationEnabled: true
    };

    this.initializeLocations();
  }

  /**
   * Initialize backup system
   */
  async initialize(): Promise<void> {
    await this.encryptionService.initialize();
    console.log('Backup system initialized');
  }

  /**
   * Store backup record
   */
  async storeBackup(backup: BackupRecord): Promise<void> {
    // Verify checksum if enabled
    if (this.config.checksumVerification) {
      const computedChecksum = this.computeChecksum(backup.data);
      if (computedChecksum !== backup.checksum) {
        throw new Error(`Checksum verification failed for backup ${backup.id}`);
      }
    }

    // Store backup record
    this.backups.set(backup.id, backup);

    // Store to location
    const location = this.locations.get(backup.location);
    if (location) {
      await this.writeToLocation(location, backup);
    }

    console.log(`Stored backup ${backup.id} to location ${backup.location}`);
  }

  /**
   * Retrieve backup record
   */
  async retrieveBackup(backupId: string): Promise<BackupRecord> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Verify location accessibility
    const location = this.locations.get(backup.location);
    if (!location || !location.accessible) {
      throw new Error(`Backup location not accessible: ${backup.location}`);
    }

    return backup;
  }

  /**
   * Create distributed backup for key shares
   */
  async createDistributedBackup(
    keyId: string,
    shares: Map<string, Buffer>,
    threshold: number
  ): Promise<string[]> {
    const backupIds: string[] = [];
    const locations = this.getAvailableLocations();

    if (locations.length < threshold) {
      throw new Error(`Insufficient backup locations: ${locations.length} < ${threshold}`);
    }

    // Create backup shares using Shamir's Secret Sharing
    const backupShares = this.createBackupShares(shares, threshold);

    for (let i = 0; i < backupShares.length && i < locations.length; i++) {
      const location = locations[i];
      const backupData = backupShares[i];

      // Encrypt if enabled
      let encryptedData = backupData;
      let isEncrypted = false;

      if (this.config.encryption) {
        const encryptionResult = await this.encryptionService.encrypt(backupData);
        encryptedData = this.combineEncryptionResult(encryptionResult);
        isEncrypted = true;
      }

      // Create backup record
      const backup: BackupRecord = {
        id: this.generateBackupId(),
        keyId,
        shareIndex: i,
        data: encryptedData,
        encrypted: isEncrypted,
        checksum: this.computeChecksum(backupData),
        location: location.id,
        createdAt: new Date(),
        version: 1,
        metadata: {
          threshold,
          totalShares: backupShares.length,
          distributed: true
        }
      };

      await this.storeBackup(backup);
      backupIds.push(backup.id);
    }

    console.log(`Created distributed backup with ${backupIds.length} shares`);
    return backupIds;
  }

  /**
   * Recover key shares from distributed backup
   */
  async recoverFromDistributedBackup(
    backupIds: string[],
    passwords?: string[]
  ): Promise<Map<string, Buffer>> {
    if (backupIds.length < this.config.threshold) {
      throw new Error(`Insufficient backup shares: ${backupIds.length} < ${this.config.threshold}`);
    }

    const backupShares: Buffer[] = [];
    const recoveredShares: Map<string, Buffer> = new Map();

    // Retrieve and decrypt backup shares
    for (let i = 0; i < backupIds.length; i++) {
      const backup = await this.retrieveBackup(backupIds[i]);
      let backupData = backup.data;

      // Decrypt if encrypted
      if (backup.encrypted) {
        const encryptionData = this.parseEncryptionResult(backupData);
        const password = passwords && passwords[i] ? passwords[i] : undefined;
        backupData = await this.encryptionService.decrypt(encryptionData, password);
      }

      // Verify integrity
      const checksum = this.computeChecksum(backupData);
      if (checksum !== backup.checksum) {
        throw new Error(`Backup integrity check failed for ${backupIds[i]}`);
      }

      backupShares.push(backupData);
    }

    // Reconstruct original shares
    if (backupShares.length >= this.config.threshold) {
      const originalShares = this.reconstructShares(backupShares, backupIds[0]);

      for (let i = 0; i < originalShares.length; i++) {
        recoveredShares.set(`share_${i}`, originalShares[i]);
      }
    }

    console.log(`Recovered ${recoveredShares.size} key shares from backup`);
    return recoveredShares;
  }

  /**
   * List backups for key
   */
  listBackupsForKey(keyId: string): BackupRecord[] {
    return Array.from(this.backups.values()).filter(backup => backup.keyId === keyId);
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Remove from storage location
    const location = this.locations.get(backup.location);
    if (location) {
      await this.deleteFromLocation(location, backupId);
    }

    // Remove from memory
    this.backups.delete(backupId);

    console.log(`Deleted backup ${backupId}`);
  }

  /**
   * Cleanup expired backups
   */
  async cleanupExpiredBackups(): Promise<number> {
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const expiredBackups: string[] = [];

    for (const [backupId, backup] of this.backups) {
      const age = now - backup.createdAt.getTime();
      if (age > retentionMs) {
        expiredBackups.push(backupId);
      }
    }

    for (const backupId of expiredBackups) {
      await this.deleteBackup(backupId);
    }

    console.log(`Cleaned up ${expiredBackups.length} expired backups`);
    return expiredBackups.length;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const backup = await this.retrieveBackup(backupId);
      let data = backup.data;

      // Decrypt if encrypted
      if (backup.encrypted) {
        const encryptionData = this.parseEncryptionResult(data);
        data = await this.encryptionService.decrypt(encryptionData);
      }

      // Verify checksum
      const computedChecksum = this.computeChecksum(data);
      return computedChecksum === backup.checksum;
    } catch {
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  getStatistics(): BackupStatistics {
    const backups = Array.from(this.backups.values());
    const locations = Array.from(this.locations.values());
    const totalSize = backups.reduce((sum, backup) => sum + backup.data.length, 0);

    let oldestBackup: Date | undefined;
    let newestBackup: Date | undefined;

    if (backups.length > 0) {
      oldestBackup = backups.reduce((oldest, backup) =>
        backup.createdAt < oldest ? backup.createdAt : oldest
      );
      newestBackup = backups.reduce((newest, backup) =>
        backup.createdAt > newest ? backup.createdAt : newest
      );
    }

    // Calculate retention compliance
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const expiredCount = backups.filter(backup =>
      now - backup.createdAt.getTime() > retentionMs
    ).length;
    const retentionCompliance = backups.length > 0 ?
      (backups.length - expiredCount) / backups.length : 1;

    return {
      totalBackups: backups.length,
      totalSize,
      locations,
      oldestBackup,
      newestBackup,
      retentionCompliance
    };
  }

  /**
   * Add backup location
   */
  addLocation(location: BackupLocation): void {
    this.locations.set(location.id, location);
    console.log(`Added backup location: ${location.id} (${location.type})`);
  }

  /**
   * Remove backup location
   */
  removeLocation(locationId: string): void {
    this.locations.delete(locationId);
    console.log(`Removed backup location: ${locationId}`);
  }

  /**
   * Get available backup locations
   */
  getAvailableLocations(): BackupLocation[] {
    return Array.from(this.locations.values()).filter(location => location.accessible);
  }

  /**
   * Test backup locations
   */
  async testBackupLocations(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [locationId, location] of this.locations) {
      try {
        // Test write/read operation
        const testData = Buffer.from(`test_${Date.now()}`);
        const testPath = `test_${locationId}`;

        await this.writeToLocation(location, {
          id: testPath,
          keyId: 'test',
          shareIndex: 0,
          data: testData,
          encrypted: false,
          checksum: this.computeChecksum(testData),
          location: locationId,
          createdAt: new Date(),
          version: 1
        });

        const retrieved = await this.readFromLocation(location, testPath);
        await this.deleteFromLocation(location, testPath);

        const isValid = testData.equals(retrieved);
        results.set(locationId, isValid);

        // Update location accessibility
        location.accessible = isValid;
        location.lastAccess = new Date();

      } catch (error) {
        results.set(locationId, false);
        location.accessible = false;
        console.error(`Backup location test failed for ${locationId}:`, error);
      }
    }

    return results;
  }

  /**
   * Private helper methods
   */

  private initializeLocations(): void {
    // Initialize default backup locations
    const defaultLocations: BackupLocation[] = [
      {
        id: 'local',
        type: 'local',
        path: './backups',
        encrypted: true,
        accessible: true,
        size: 0
      },
      {
        id: 'remote1',
        type: 'remote',
        path: '/remote/backup1',
        encrypted: true,
        accessible: true,
        size: 0
      },
      {
        id: 'remote2',
        type: 'remote',
        path: '/remote/backup2',
        encrypted: true,
        accessible: true,
        size: 0
      }
    ];

    for (const location of defaultLocations) {
      this.locations.set(location.id, location);
    }
  }

  private createBackupShares(shares: Map<string, Buffer>, threshold: number): Buffer[] {
    // Simplified Shamir's Secret Sharing for demonstration
    // In practice, would use proper Shamir's Secret Sharing implementation
    const backupShares: Buffer[] = [];
    const maxShares = this.locations.size;

    for (let i = 0; i < maxShares; i++) {
      // Create a backup share (simplified)
      const shareData = Buffer.concat([
        Buffer.from([i]), // Share index
        shares.get('share0') || Buffer.alloc(0) // Simplified: use first share
      ]);
      backupShares.push(shareData);
    }

    return backupShares;
  }

  private reconstructShares(backupShares: Buffer[], referenceBackupId: string): Buffer[] {
    // Simplified reconstruction
    // In practice, would use proper Shamir's Secret Sharing reconstruction
    const originalShares: Buffer[] = [];

    for (const backupShare of backupShares) {
      // Extract original share data (simplified)
      const shareData = backupShare.slice(1); // Skip index byte
      originalShares.push(shareData);
    }

    return originalShares;
  }

  private computeChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private combineEncryptionResult(result: any): Buffer {
    // Combine encrypted data, IV, and tag for storage
    return Buffer.concat([
      result.iv,
      result.tag,
      result.data
    ]);
  }

  private parseEncryptionResult(combined: Buffer): any {
    // Parse combined encrypted data into IV, tag, and data
    const iv = combined.slice(0, 16);
    const tag = combined.slice(16, 32);
    const data = combined.slice(32);

    return {
      iv,
      tag,
      data
    };
  }

  private async writeToLocation(location: BackupLocation, backup: BackupRecord): Promise<void> {
    // In a real implementation, this would write to actual storage
    // For demonstration, just simulate the operation
    location.size += backup.data.length;
    location.lastAccess = new Date();

    console.log(`Writing backup ${backup.id} to ${location.path}`);
  }

  private async readFromLocation(location: BackupLocation, backupPath: string): Promise<Buffer> {
    // In a real implementation, this would read from actual storage
    // For demonstration, return test data
    location.lastAccess = new Date();

    console.log(`Reading backup from ${location.path}/${backupPath}`);
    return Buffer.from('test_data');
  }

  private async deleteFromLocation(location: BackupLocation, backupPath: string): Promise<void> {
    // In a real implementation, this would delete from actual storage
    console.log(`Deleting backup from ${location.path}/${backupPath}`);
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.encryptionService.cleanup();
    this.backups.clear();
    this.locations.clear();

    console.log('Backup system cleanup completed');
  }
}