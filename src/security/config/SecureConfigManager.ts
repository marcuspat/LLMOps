/**
 * Secure Configuration Management
 * Encrypted configuration storage with versioning and audit trail
 */

import { createCipher, createDecipher, randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';
import { readFile, writeFile, existsSync } from 'fs/promises';
import { join } from 'path';
import { SecurityConfig } from '../core/SecurityConfig.js';

export class SecureConfigManager {
  private config: SecurityConfig;
  private encryptionKey: Buffer;
  private configStore: ConfigStore;
  private versionManager: VersionManager;
  private auditLogger: ConfigAuditLogger;
  private validator: ConfigValidator;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.configStore = new ConfigStore(config);
    this.versionManager = new VersionManager(config);
    this.auditLogger = new ConfigAuditLogger(config);
    this.validator = new ConfigValidator(config);
  }

  async initialize(): Promise<void> {
    this.encryptionKey = await this.loadOrGenerateEncryptionKey();
    await this.configStore.initialize();
    await this.versionManager.initialize();
    await this.auditLogger.initialize();
    await this.validator.initialize();
  }

  /**
   * Get configuration value with automatic decryption
   */
  async get(key: string, defaultValue?: any): Promise<any> {
    try {
      const encryptedConfig = await this.configStore.get(key);
      if (!encryptedConfig) {
        return defaultValue;
      }

      const decrypted = await this.decrypt(encryptedConfig);

      // Validate configuration value
      const validation = await this.validator.validate(key, decrypted.value);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed for ${key}: ${validation.reason}`);
      }

      // Log configuration access
      await this.auditLogger.logAccess(key, 'read');

      return decrypted.value;
    } catch (error) {
      await this.auditLogger.logError(key, 'read', error);
      throw new Error(`Failed to get configuration ${key}: ${error}`);
    }
  }

  /**
   * Set configuration value with automatic encryption
   */
  async set(key: string, value: any, metadata?: ConfigMetadata): Promise<void> {
    try {
      // Validate configuration value
      const validation = await this.validator.validate(key, value);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed for ${key}: ${validation.reason}`);
      }

      // Encrypt configuration
      const encrypted = await this.encrypt(value, metadata);

      // Store encrypted configuration
      await this.configStore.set(key, encrypted);

      // Create new version
      const version = await this.versionManager.createVersion(key, value, metadata);

      // Log configuration change
      await this.auditLogger.logChange(key, value, version.id);

    } catch (error) {
      await this.auditLogger.logError(key, 'write', error);
      throw new Error(`Failed to set configuration ${key}: ${error}`);
    }
  }

  /**
   * Delete configuration value
   */
  async delete(key: string): Promise<void> {
    try {
      const exists = await this.configStore.exists(key);
      if (!exists) {
        return;
      }

      // Get current value for audit
      const currentValue = await this.get(key);

      // Delete configuration
      await this.configStore.delete(key);

      // Log configuration deletion
      await this.auditLogger.logDeletion(key, currentValue);

    } catch (error) {
      await this.auditLogger.logError(key, 'delete', error);
      throw new Error(`Failed to delete configuration ${key}: ${error}`);
    }
  }

  /**
   * Get all configuration keys
   */
  async listKeys(): Promise<string[]> {
    try {
      return await this.configStore.listKeys();
    } catch (error) {
      throw new Error(`Failed to list configuration keys: ${error}`);
    }
  }

  /**
   * Bulk set multiple configuration values
   */
  async setBulk(configs: Record<string, any>): Promise<BulkConfigResult> {
    const results: BulkConfigResult = {
      successful: [],
      failed: [],
      total: Object.keys(configs).length
    };

    for (const [key, value] of Object.entries(configs)) {
      try {
        await this.set(key, value);
        results.successful.push(key);
      } catch (error) {
        results.failed.push({
          key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Export configuration (decrypted)
   */
  async export(includeSecrets: boolean = false, filter?: string[]): Promise<ConfigurationExport> {
    try {
      const keys = await this.listKeys();
      const configData: Record<string, any> = {};
      const filteredKeys = filter ? keys.filter(key => filter.includes(key)) : keys;

      for (const key of filteredKeys) {
        try {
          const value = await this.get(key);

          // Skip secrets unless explicitly requested
          if (!includeSecrets && this.isSecretKey(key)) {
            configData[key] = '[REDACTED]';
          } else {
            configData[key] = value;
          }
        } catch (error) {
          console.warn(`Failed to export ${key}:`, error);
        }
      }

      const exportData: ConfigurationExport = {
        configData,
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: 'secure-config-manager',
          version: await this.versionManager.getCurrentVersion(),
          includeSecrets,
          totalKeys: Object.keys(configData).length
        },
        integrity: {
          checksum: this.calculateChecksum(configData)
        }
      };

      // Log export operation
      await this.auditLogger.logExport(includeSecrets, filteredKeys.length);

      return exportData;
    } catch (error) {
      throw new Error(`Failed to export configuration: ${error}`);
    }
  }

  /**
   * Import configuration with encryption
   */
  async import(configData: Record<string, any>, overwrite: boolean = false): Promise<ImportResult> {
    const results: ImportResult = {
      successful: [],
      failed: [],
      overwritten: [],
      total: Object.keys(configData).length
    };

    for (const [key, value] of Object.entries(configData)) {
      try {
        const exists = await this.configStore.exists(key);

        if (exists && !overwrite) {
          results.failed.push({
            key,
            error: 'Key already exists and overwrite is false'
          });
          continue;
        }

        if (exists && overwrite) {
          results.overwritten.push(key);
        }

        await this.set(key, value);
        results.successful.push(key);
      } catch (error) {
        results.failed.push({
          key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log import operation
    await this.auditLogger.logImport(results.total, results.successful.length, results.overwritten.length);

    return results;
  }

  /**
   * Rotate encryption key
   */
  async rotateEncryptionKey(): Promise<string> {
    try {
      const oldKeyId = this.getKeyId();

      // Generate new encryption key
      const newKey = this.generateEncryptionKey();

      // Re-encrypt all configurations with new key
      await this.reencryptAllConfigs(this.encryptionKey, newKey);

      // Update encryption key
      this.encryptionKey = newKey;
      await this.storeEncryptionKey(newKey);

      // Archive old key
      await this.archiveEncryptionKey(oldKeyId);

      const newKeyId = this.getKeyId();

      // Log key rotation
      await this.auditLogger.logKeyRotation(oldKeyId, newKeyId);

      return newKeyId;
    } catch (error) {
      throw new Error(`Failed to rotate encryption key: ${error}`);
    }
  }

  /**
   * Get configuration version history
   */
  async getVersionHistory(key: string): Promise<ConfigVersion[]> {
    try {
      return await this.versionManager.getHistory(key);
    } catch (error) {
      throw new Error(`Failed to get version history for ${key}: ${error}`);
    }
  }

  /**
   * Restore configuration to previous version
   */
  async restoreVersion(key: string, versionId: string): Promise<void> {
    try {
      const version = await this.versionManager.getVersion(versionId);
      if (!version) {
        throw new Error(`Version ${versionId} not found for key ${key}`);
      }

      // Restore configuration value
      await this.set(key, version.value, {
        restoredFrom: versionId,
        restoredAt: new Date().toISOString(),
        previousVersionId: version.previousVersionId
      });

      // Log restoration
      await this.auditLogger.logRestore(key, versionId);

    } catch (error) {
      throw new Error(`Failed to restore version ${versionId} for ${key}: ${error}`);
    }
  }

  /**
   * Validate all configurations
   */
  async validateAll(): Promise<ValidationSummary> {
    const keys = await this.listKeys();
    const results: ValidationSummary = {
      total: keys.length,
      valid: 0,
      invalid: 0,
      errors: []
    };

    for (const key of keys) {
      try {
        const value = await this.get(key);
        results.valid++;
      } catch (error) {
        results.invalid++;
        results.errors.push({
          key,
          error: error instanceof Error ? error.message : 'Validation failed'
        });
      }
    }

    return results;
  }

  // Private helper methods
  private async encrypt(value: any, metadata?: ConfigMetadata): Promise<EncryptedConfig> {
    const iv = randomBytes(16);
    const algorithm = this.config.encryptionSettings.algorithm;

    const cipher = createCipher(algorithm, this.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      algorithm,
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex'),
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
      keyId: this.getKeyId()
    };
  }

  private async decrypt(encrypted: EncryptedConfig): Promise<DecryptedConfig> {
    const decipher = createDecipher(
      encrypted.algorithm,
      this.encryptionKey
    );

    decipher.setAAD(Buffer.from(encrypted.authTag, 'hex'));

    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return {
      value: JSON.parse(decrypted),
      metadata: encrypted.metadata,
      timestamp: encrypted.timestamp,
      keyId: encrypted.keyId
    };
  }

  private async loadOrGenerateEncryptionKey(): Promise<Buffer> {
    try {
      const keyPath = this.getEncryptionKeyPath();

      if (existsSync(keyPath)) {
        const keyData = await readFile(keyPath);
        return keyData;
      } else {
        const key = this.generateEncryptionKey();
        await this.storeEncryptionKey(key);
        return key;
      }
    } catch (error) {
      throw new Error(`Failed to load encryption key: ${error}`);
    }
  }

  private generateEncryptionKey(): Buffer {
    return randomBytes(32); // 256-bit key
  }

  private async storeEncryptionKey(key: Buffer): Promise<void> {
    const keyPath = this.getEncryptionKeyPath();
    await writeFile(keyPath, key);
  }

  private getEncryptionKeyPath(): string {
    return join(process.cwd(), '.secure-config', 'encryption.key');
  }

  private getKeyId(): string {
    // Generate key ID based on current key
    return createHash('sha256').update(this.encryptionKey).digest('hex').substring(0, 16);
  }

  private async archiveEncryptionKey(keyId: string): Promise<void> {
    // Implementation would archive old key securely
  }

  private async reencryptAllConfigs(oldKey: Buffer, newKey: Buffer): Promise<void> {
    const keys = await this.listKeys();

    for (const key of keys) {
      try {
        // Decrypt with old key
        const encrypted = await this.configStore.get(key);
        const decipher = createDecipher(encrypted.algorithm, oldKey);
        decipher.setAAD(Buffer.from(encrypted.authTag, 'hex'));

        let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const value = JSON.parse(decrypted);

        // Re-encrypt with new key
        const reencrypted = await this.encrypt(value, {
          reencryptedAt: new Date().toISOString(),
          previousKeyId: this.getKeyId()
        });

        await this.configStore.set(key, reencrypted);
      } catch (error) {
        console.error(`Failed to reencrypt config ${key}:`, error);
      }
    }
  }

  private isSecretKey(key: string): boolean {
    const secretPatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /credential/i,
      /auth/i,
      /api/i
    ];

    return secretPatterns.some(pattern => pattern.test(key));
  }

  private calculateChecksum(data: Record<string, any>): string {
    return createHash('sha256').update(JSON.stringify(data, Object.keys(data).sort())).digest('hex');
  }
}

// Supporting classes
class ConfigStore {
  private config: SecurityConfig;
  private store: Map<string, EncryptedConfig> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize configuration store
  }

  async get(key: string): Promise<EncryptedConfig | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: EncryptedConfig): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async listKeys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

class VersionManager {
  private config: SecurityConfig;
  private versions: Map<string, Map<string, ConfigVersion>> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize version management
  }

  async createVersion(key: string, value: any, metadata?: ConfigMetadata): Promise<ConfigVersion> {
    const versionId = this.generateVersionId();
    const timestamp = new Date().toISOString();

    // Get current history for this key
    const keyHistory = this.versions.get(key) || new Map();

    // Get current latest version
    const currentVersions = Array.from(keyHistory.values());
    const latestVersion = currentVersions.sort((a, b) => b.version > a.version)[0];

    const version: ConfigVersion = {
      id: versionId,
      key,
      version: this.getNextVersion(latestVersion?.version),
      value,
      metadata,
      timestamp,
      previousVersionId: latestVersion?.id,
      changes: this.detectChanges(latestVersion?.value, value)
    };

    keyHistory.set(versionId, version);
    this.versions.set(key, keyHistory);

    return version;
  }

  async getHistory(key: string): Promise<ConfigVersion[]> {
    const keyHistory = this.versions.get(key) || new Map();
    return Array.from(keyHistory.values()).sort((a, b) => b.version > a.version);
  }

  async getVersion(versionId: string): Promise<ConfigVersion | null> {
    for (const keyHistory of this.versions.values()) {
      const version = keyHistory.get(versionId);
      if (version) {
        return version;
      }
    }
    return null;
  }

  async getCurrentVersion(): Promise<string> {
    // Implementation would return current configuration version
    return '1.0.0';
  }

  private generateVersionId(): string {
    return `v${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private getNextVersion(currentVersion?: string): string {
    if (!currentVersion) {
      return '1.0.0';
    }

    const [major, minor, patch] = currentVersion.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  private detectChanges(oldValue: any, newValue: any): ConfigChange[] {
    // Implementation would detect changes between old and new values
    return [];
  }
}

class ConfigAuditLogger {
  private config: SecurityConfig;
  private logs: ConfigAuditLog[] = [];

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize audit logging
  }

  async logAccess(key: string, action: string): Promise<void> {
    const logEntry: ConfigAuditLog = {
      timestamp: new Date().toISOString(),
      action: 'access',
      key,
      details: { action },
      userId: 'system',
      ip: 'localhost'
    };

    this.logs.push(logEntry);
  }

  async logChange(key: string, value: any, versionId: string): Promise<void> {
    const logEntry: ConfigAuditLog = {
      timestamp: new Date().toISOString(),
      action: 'change',
      key,
      details: { versionId, type: typeof value },
      userId: 'system',
      ip: 'localhost'
    };

    this.logs.push(logEntry);
  }

  async logDeletion(key: string, oldValue: any): Promise<void> {
    const logEntry: ConfigAuditLog = {
      timestamp: new Date().toISOString(),
      action: 'delete',
      key,
      details: { oldValue },
      userId: 'system',
      ip: 'localhost'
    };

    this.logs.push(logEntry);
  }

  async logExport(includeSecrets: boolean, keyCount: number): Promise<void> {
    const logEntry: ConfigAuditLog = {
      timestamp: new Date().toISOString(),
      action: 'export',
      key: 'bulk',
      details: { includeSecrets, keyCount },
      userId: 'system',
      ip: 'localhost'
    };

    this.logs.push(logEntry);
  }

  async logImport(total: number, successful: number, overwritten: number): Promise<void> {
    const logEntry: ConfigAuditLog = {
      timestamp: new Date().toISOString(),
      action: 'import',
      key: 'bulk',
      details: { total, successful, overwritten },
      userId: 'system',
      ip: 'localhost'
    };

    this.logs.push(logEntry);
  }

  async logKeyRotation(oldKeyId: string, newKeyId: string): Promise<void> {
    const logEntry: ConfigAuditLog = {
      timestamp: new Date().toISOString(),
      action: 'key_rotation',
      key: 'encryption',
      details: { oldKeyId, newKeyId },
      userId: 'system',
      ip: 'localhost'
    };

    this.logs.push(logEntry);
  }

  async logRestore(key: string, versionId: string): Promise<void> {
    const logEntry: ConfigAuditLog = {
      timestamp: new Date().toISOString(),
      action: 'restore',
      key,
      details: { versionId },
      userId: 'system',
      ip: 'localhost'
    };

    this.logs.push(logEntry);
  }

  async logError(key: string, operation: string, error: any): Promise<void> {
    const logEntry: ConfigAuditLog = {
      timestamp: new Date().toISOString(),
      action: 'error',
      key,
      details: { operation, error: error instanceof Error ? error.message : String(error) },
      userId: 'system',
      ip: 'localhost'
    };

    this.logs.push(logEntry);
  }
}

class ConfigValidator {
  private config: SecurityConfig;
  private validators: Map<string, ConfigValidatorRule[]> = new Map();

  constructor(config: SecurityConfig) {
    this.config = config;
    this.initializeValidators();
  }

  async initialize(): Promise<void> {
    // Initialize validators
  }

  async validate(key: string, value: any): Promise<ValidationResult> {
    // Get validators for this key
    const keyValidators = this.validators.get('*') || [];
    const specificValidators = this.validators.get(key) || [];

    const allValidators = [...keyValidators, ...specificValidators];

    for (const validator of allValidators) {
      const result = await this.runValidator(validator, key, value);
      if (!result.valid) {
        return result;
      }
    }

    return {
      valid: true
    };
  }

  private initializeValidators(): void {
    // Add default validators
    this.validators.set('*', [
      {
        name: 'not_null',
        validate: (key: string, value: any) => ({
          valid: value !== null && value !== undefined,
          reason: 'Value cannot be null or undefined'
        })
      }
    ]);

    // Add password validators
    this.validators.set('password', [
      {
        name: 'password_complexity',
        validate: (key: string, value: string) => {
          if (typeof value !== 'string') {
            return { valid: false, reason: 'Password must be a string' };
          }
          if (value.length < 8) {
            return { valid: false, reason: 'Password must be at least 8 characters' };
          }
          if (!/[A-Z]/.test(value)) {
            return { valid: false, reason: 'Password must contain uppercase letters' };
          }
          if (!/[a-z]/.test(value)) {
            return { valid: false, reason: 'Password must contain lowercase letters' };
          }
          if (!/\d/.test(value)) {
            return { valid: false, reason: 'Password must contain numbers' };
          }
          return { valid: true };
        }
      }
    ]);

    // Add API key validators
    this.validators.set('api_key', [
      {
        name: 'api_key_format',
        validate: (key: string, value: string) => {
          if (typeof value !== 'string') {
            return { valid: false, reason: 'API key must be a string' };
          }
          if (value.length < 32) {
            return { valid: false, reason: 'API key must be at least 32 characters' };
          }
          return { valid: true };
        }
      }
    ]);

    // Add URL validators
    this.validators.set('url', [
      {
        name: 'url_format',
        validate: (key: string, value: string) => {
          if (typeof value !== 'string') {
            return { valid: false, reason: 'URL must be a string' };
          }
          try {
            new URL(value);
            return { valid: true };
          } catch {
            return { valid: false, reason: 'Invalid URL format' };
          }
        }
      }
    ]);

    // Add port validators
    this.validators.set('port', [
      {
        name: 'port_range',
        validate: (key: string, value: number) => {
          if (typeof value !== 'number') {
            return { valid: false, reason: 'Port must be a number' };
          }
          if (value < 1 || value > 65535) {
            return { valid: false, reason: 'Port must be between 1 and 65535' };
          }
          return { valid: true };
        }
      }
    ]);
  }

  private async runValidator(validator: ConfigValidatorRule, key: string, value: any): Promise<ValidationResult> {
    try {
      return await validator.validate(key, value);
    } catch (error) {
      return {
        valid: false,
        reason: `Validator ${validator.name} failed: ${error}`
      };
    }
  }
}

// Type definitions
export interface ConfigMetadata {
  description?: string;
  category?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  owner?: string;
  lastModified?: string;
  environment?: string;
  tags?: string[];
}

export interface EncryptedConfig {
  algorithm: string;
  iv: string;
  data: string;
  authTag: string;
  metadata: ConfigMetadata;
  timestamp: string;
  keyId: string;
}

export interface DecryptedConfig {
  value: any;
  metadata: ConfigMetadata;
  timestamp: string;
  keyId: string;
}

export interface ConfigurationExport {
  configData: Record<string, any>;
  metadata: {
    exportedAt: string;
    exportedBy: string;
    version: string;
    includeSecrets: boolean;
    totalKeys: number;
  };
  integrity: {
    checksum: string;
  };
}

export interface BulkConfigResult {
  successful: string[];
  failed: Array<{
    key: string;
    error: string;
  }>;
  total: number;
}

export interface ImportResult {
  successful: string[];
  failed: Array<{
    key: string;
    error: string;
  }>;
  overwritten: string[];
  total: number;
}

export interface ConfigVersion {
  id: string;
  key: string;
  version: string;
  value: any;
  metadata: ConfigMetadata;
  timestamp: string;
  previousVersionId?: string;
  changes: ConfigChange[];
}

export interface ConfigChange {
  type: 'added' | 'modified' | 'deleted';
  path?: string;
  oldValue?: any;
  newValue?: any;
}

export interface ConfigAuditLog {
  timestamp: string;
  action: string;
  key: string;
  details: any;
  userId: string;
  ip: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ConfigValidatorRule {
  name: string;
  validate: (key: string, value: any) => Promise<ValidationResult> | ValidationResult;
}

export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  errors: Array<{
    key: string;
    error: string;
  }>;
}