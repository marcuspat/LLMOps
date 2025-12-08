/**
 * Encryption Service - Secure encryption and decryption services
 * Implements AES-256-GCM encryption for data protection
 */

import * as crypto from 'crypto';
import { Buffer } from 'buffer';

export interface EncryptionResult {
  data: Buffer;
  iv: Buffer;
  tag: Buffer;
  algorithm: string;
  keyId?: string;
}

export interface DecryptionResult {
  data: Buffer;
  authenticated: boolean;
}

export interface EncryptionKey {
  id: string;
  key: Buffer;
  algorithm: string;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: any;
}

export class EncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private defaultKeyId: string;
  private algorithm: string = 'aes-256-gcm';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize encryption service
   */
  async initialize(): Promise<void> {
    // Generate default encryption key
    const defaultKey = this.generateKey();
    this.defaultKeyId = defaultKey.id;
    this.keys.set(defaultKey.id, defaultKey);

    console.log('Encryption service initialized with AES-256-GCM');
  }

  /**
   * Encrypt data
   */
  async encrypt(data: Buffer | string, keyId?: string): Promise<EncryptionResult> {
    const encryptionKey = this.getEncryptionKey(keyId);
    const key = encryptionKey.key;

    // Generate random IV
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from(encryptionKey.id)); // Associate with key ID

    // Encrypt data
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    const result: EncryptionResult = {
      data: encrypted,
      iv,
      tag,
      algorithm: this.algorithm,
      keyId: encryptionKey.id
    };

    return result;
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptionResult, password?: string): Promise<Buffer> {
    const encryptionKey = this.getEncryptionKey(encryptedData.keyId);
    const key = password ? this.deriveKey(password) : encryptionKey.key;

    try {
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from(encryptionKey.id));
      decipher.setAuthTag(encryptedData.tag);

      // Decrypt data
      let decrypted = decipher.update(encryptedData.data);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: invalid data or authentication');
    }
  }

  /**
   * Encrypt with password
   */
  async encryptWithPassword(data: Buffer | string, password: string): Promise<EncryptionResult> {
    const key = this.deriveKey(password);

    // Generate random IV
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipher(this.algorithm, key);

    // Encrypt data
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    const result: EncryptionResult = {
      data: encrypted,
      iv,
      tag,
      algorithm: this.algorithm
    };

    return result;
  }

  /**
   * Decrypt with password
   */
  async decryptWithPassword(encryptedData: EncryptionResult, password: string): Promise<Buffer> {
    const key = this.deriveKey(password);

    try {
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAuthTag(encryptedData.tag);

      // Decrypt data
      let decrypted = decipher.update(encryptedData.data);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      throw new Error('Password decryption failed: invalid password or data');
    }
  }

  /**
   * Generate new encryption key
   */
  generateKey(algorithm: string = this.algorithm): EncryptionKey {
    const key: EncryptionKey = {
      id: this.generateKeyId(),
      key: crypto.randomBytes(32), // 256 bits for AES-256
      algorithm,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    };

    this.keys.set(key.id, key);

    console.log(`Generated new encryption key: ${key.id}`);
    return key;
  }

  /**
   * Add encryption key
   */
  addKey(key: EncryptionKey): void {
    this.keys.set(key.id, key);

    // Set as default if no default exists
    if (!this.defaultKeyId) {
      this.defaultKeyId = key.id;
    }

    console.log(`Added encryption key: ${key.id}`);
  }

  /**
   * Remove encryption key
   */
  removeKey(keyId: string): void {
    this.keys.delete(keyId);

    // Update default if necessary
    if (this.defaultKeyId === keyId) {
      this.defaultKeyId = this.keys.keys().next().value?.id || '';
    }

    console.log(`Removed encryption key: ${keyId}`);
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(oldKeyId: string): Promise<string> {
    console.log(`Rotating encryption key: ${oldKeyId}`);

    // Generate new key
    const newKey = this.generateKey();

    // Remove old key (in practice, would keep old key for decrypting old data)
    // this.removeKey(oldKeyId);

    // Update default if needed
    if (this.defaultKeyId === oldKeyId) {
      this.defaultKeyId = newKey.id;
    }

    return newKey.id;
  }

  /**
   * Get encryption key
   */
  getEncryptionKey(keyId?: string): EncryptionKey {
    const targetKeyId = keyId || this.defaultKeyId;
    const key = this.keys.get(targetKeyId);

    if (!key) {
      throw new Error(`Encryption key not found: ${targetKeyId}`);
    }

    return key;
  }

  /**
   * List all encryption keys
   */
  listKeys(): EncryptionKey[] {
    return Array.from(this.keys.values());
  }

  /**
   * Derive key from password
   */
  private deriveKey(password: string): Buffer {
    return crypto.pbkdf2Sync(password, 'salt', 10000, 32, 'sha256');
  }

  /**
   * Generate key ID
   */
  private generateKeyId(): string {
    return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Check if key is expired
   */
  isKeyExpired(key: EncryptionKey): boolean {
    if (!key.expiresAt) return false;
    return Date.now() > key.expiresAt.getTime();
  }

  /**
   * Cleanup expired keys
   */
  cleanupExpiredKeys(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [keyId, key] of this.keys) {
      if (key.expiresAt && now > key.expiresAt.getTime()) {
        expiredKeys.push(keyId);
      }
    }

    for (const keyId of expiredKeys) {
      this.removeKey(keyId);
    }

    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired encryption keys`);
    }

    return expiredKeys.length;
  }

  /**
   * Get key statistics
   */
  getKeyStatistics(): {
    total: number;
    expired: number;
    defaultKeyId: string;
    algorithm: string;
  } {
    const keys = Array.from(this.keys.values());
    const now = Date.now();
    const expired = keys.filter(key => key.expiresAt && now > key.expiresAt.getTime()).length;

    return {
      total: keys.length,
      expired,
      defaultKeyId: this.defaultKeyId,
      algorithm: this.algorithm
    };
  }

  /**
   * Update key metadata
   */
  updateKeyMetadata(keyId: string, metadata: any): void {
    const key = this.keys.get(keyId);
    if (key) {
      key.metadata = { ...key.metadata, ...metadata };
    }
  }

  /**
   * Export keys (for backup)
   */
  exportKeys(includePrivateKeys: boolean = false): any {
    const exportedKeys: any[] = [];

    for (const [keyId, key] of this.keys) {
      const exportData: any = {
        id: key.id,
        algorithm: key.algorithm,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        metadata: key.metadata
      };

      if (includePrivateKeys) {
        exportData.key = key.key.toString('base64');
      }

      exportedKeys.push(exportData);
    }

    return {
      keys: exportedKeys,
      defaultKeyId: this.defaultKeyId,
      exportedAt: new Date()
    };
  }

  /**
   * Import keys (from backup)
   */
  importKeys(data: any): void {
    if (!data.keys || !Array.isArray(data.keys)) {
      throw new Error('Invalid key data format');
    }

    for (const keyData of data.keys) {
      const key: EncryptionKey = {
        id: keyData.id,
        algorithm: keyData.algorithm,
        createdAt: new Date(keyData.createdAt),
        expiresAt: keyData.expiresAt ? new Date(keyData.expiresAt) : undefined,
        metadata: keyData.metadata,
        key: keyData.key ? Buffer.from(keyData.key, 'base64') : crypto.randomBytes(32)
      };

      this.keys.set(key.id, key);
    }

    if (data.defaultKeyId) {
      this.defaultKeyId = data.defaultKeyId;
    }

    console.log(`Imported ${data.keys.length} encryption keys`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.keys.clear();
    this.defaultKeyId = '';

    console.log('Encryption service cleanup completed');
  }
}