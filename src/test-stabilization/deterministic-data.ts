/**
 * Deterministic Test Data Management System
 * Provides predictable and reproducible test data generation with comprehensive cleanup
 */

export interface DataGeneratorConfig {
  seed?: number;
  locale?: string;
  timezone?: string;
  predictableTimestamps?: boolean;
  consistentIds?: boolean;
  mockRandomness?: boolean;
  dataVersioning?: boolean;
  cleanupStrategy: 'auto' | 'manual' | 'none';
}

export interface DataCleanupConfig {
  cleanupInterval: number;
  maxRetention: number;
  cleanupStrategies: string[];
  forceCleanupOnError: boolean;
}

export interface TestData {
  id: string;
  type: string;
  data: any;
  metadata: {
    createdAt: Date;
    version: string;
    dependencies: string[];
    cleanupAfter: number;
  };
}

export interface DataDependency {
  name: string;
  type: 'table' | 'file' | 'collection' | 'object';
  required: boolean;
  cleanupOrder: number;
  cleanupCallback?: () => Promise<void> | void;
}

/**
 * Deterministic Random Number Generator
 */
export class DeterministicRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  /**
   * Generate next pseudo-random number
   */
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate integer between min and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate float between min and max
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Generate boolean with given probability
   */
  nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Select random element from array
   */
  nextElement<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot select element from empty array');
    }
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate random string
   */
  nextString(length: number, charset: string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(this.next() * charset.length));
    }
    return result;
  }

  /**
   * Generate random email
   */
  nextEmail(): string {
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'example.com'];
    const username = this.nextString(8).toLowerCase();
    const domain = this.nextElement(domains);
    return `${username}@${domain}`;
  }

  /**
   * Generate random phone number
   */
  nextPhone(): string {
    const areaCode = this.nextInt(200, 999);
    const prefix = this.nextInt(200, 999);
    const lineNumber = this.nextInt(1000, 9999);
    return `(${areaCode}) ${prefix}-${lineNumber}`;
  }

  /**
   * Generate random date within range
   */
  nextDate(startDate: Date, endDate: Date): Date {
    const start = startDate.getTime();
    const end = endDate.getTime();
    const randomTime = start + this.next() * (end - start);
    return new Date(randomTime);
  }

  /**
   * Generate random UUID v4
   */
  nextUUID(): string {
    const hex = '0123456789abcdef';
    let uuid = '';

    // Generate 8-4-4-4-12 format
    for (let i = 0; i < 32; i++) {
      if (i === 8 || i === 12 || i === 16 || i === 20) {
        uuid += '-';
      }
      uuid += hex.charAt(Math.floor(this.next() * 16));
    }

    return uuid;
  }
}

/**
 * Timestamp Generator for predictable time values
 */
export class PredictableTimestampGenerator {
  private baseTime: number;
  private currentTime: number;
  private increment: number;

  constructor(baseTime?: Date, increment: number = 1000) {
    this.baseTime = baseTime ? baseTime.getTime() : Date.now();
    this.currentTime = this.baseTime;
    this.increment = increment;
  }

  /**
   * Get current timestamp
   */
  now(): number {
    return this.currentTime;
  }

  /**
   * Get current Date object
   */
  date(): Date {
    return new Date(this.currentTime);
  }

  /**
   * Advance time by specified amount
   */
  advance(ms: number): void {
    this.currentTime += ms;
  }

  /**
   * Reset to base time
   */
  reset(): void {
    this.currentTime = this.baseTime;
  }

  /**
   * Set increment amount
   */
  setIncrement(ms: number): void {
    this.increment = ms;
  }

  /**
   * Get next timestamp (advances automatically)
   */
  next(): number {
    const timestamp = this.currentTime;
    this.advance(this.increment);
    return timestamp;
  }

  /**
   * Get next Date object (advances automatically)
   */
  nextDate(): Date {
    const timestamp = this.next();
    return new Date(timestamp);
  }
}

/**
 * ID Generator for consistent IDs
 */
export class ConsistentIDGenerator {
  private counters = new Map<string, number>();
  private prefix: string;

  constructor(prefix: string = 'test') {
    this.prefix = prefix;
  }

  /**
   * Generate consistent ID
   */
  next(type?: string): string {
    const key = type || 'default';
    const count = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, count);
    return `${this.prefix}_${key}_${count}`;
  }

  /**
   * Generate UUID-style ID
   */
  nextUUID(): string {
    const count = (this.counters.get('uuid') || 0) + 1;
    this.counters.set('uuid', count);

    // Generate deterministic UUID using counter
    const hex = count.toString(16).padStart(8, '0').repeat(4);
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
  }

  /**
   * Reset counter for specific type
   */
  reset(type?: string): void {
    if (type) {
      this.counters.delete(type);
    } else {
      this.counters.clear();
    }
  }

  /**
   * Get current count for type
   */
  getCount(type?: string): number {
    return this.counters.get(type || 'default') || 0;
  }
}

/**
 * Test Data Manager
 */
export class TestDataManager {
  private static instance: TestDataManager;
  private testData = new Map<string, TestData>();
  private dependencies = new Map<string, DataDependency[]>();
  private random: DeterministicRandom;
  private timestampGenerator: PredictableTimestampGenerator;
  private idGenerator: ConsistentIDGenerator;
  private config: DataGeneratorConfig;
  private cleanupConfig: DataCleanupConfig;

  constructor(config: DataGeneratorConfig = {}) {
    this.config = {
      seed: Date.now(),
      locale: 'en-US',
      timezone: 'UTC',
      predictableTimestamps: true,
      consistentIds: true,
      mockRandomness: true,
      dataVersioning: true,
      cleanupStrategy: 'auto',
      ...config
    };

    this.cleanupConfig = {
      cleanupInterval: 30000, // 30 seconds
      maxRetention: 300000, // 5 minutes
      cleanupStrategies: ['expired', 'unused', 'orphaned'],
      forceCleanupOnError: false,
      ...config
    };

    // Initialize generators
    this.random = new DeterministicRandom(this.config.seed);
    this.timestampGenerator = new PredictableTimestampGenerator();
    this.idGenerator = new ConsistentIDGenerator();

    // Setup cleanup if auto cleanup is enabled
    if (this.config.cleanupStrategy === 'auto') {
      this.setupAutoCleanup();
    }
  }

  static getInstance(config?: DataGeneratorConfig): TestDataManager {
    if (!TestDataManager.instance) {
      TestDataManager.instance = new TestDataManager(config);
    }
    return TestDataManager.instance;
  }

  /**
   * Store test data with metadata
   */
  storeData(id: string, type: string, data: any, options: {
    dependencies?: string[];
    cleanupAfter?: number;
    version?: string;
  } = {}): void {
    const testData: TestData = {
      id,
      type,
      data,
      metadata: {
        createdAt: this.timestampGenerator.date(),
        version: options.version || '1.0.0',
        dependencies: options.dependencies || [],
        cleanupAfter: options.cleanupAfter || this.cleanupConfig.maxRetention
      }
    };

    this.testData.set(id, testData);
  }

  /**
   * Retrieve test data
   */
  getData<T = any>(id: string): T | undefined {
    const testData = this.testData.get(id);
    return testData ? testData.data as T : undefined;
  }

  /**
   * Remove test data
   */
  removeData(id: string): boolean {
    return this.testData.delete(id);
  }

  /**
   * Clear all test data
   */
  clearData(): void {
    this.testData.clear();
    this.dependencies.clear();
  }

  /**
   * Generate user data with consistent patterns
   */
  generateUser(overrides: Partial<any> = {}): any {
    const user = {
      id: this.idGenerator.next('user'),
      email: this.random.nextEmail(),
      firstName: this.random.nextString(8, 'abcdefghijklmnopqrstuvwxyz'),
      lastName: this.random.nextString(8, 'abcdefghijklmnopqrstuvwxyz'),
      phone: this.random.nextPhone(),
      createdAt: this.timestampGenerator.date(),
      updatedAt: this.timestampGenerator.date(),
      active: this.random.nextBoolean(0.8), // 80% active users
      roles: this.random.shuffle(['user', 'admin', 'moderator']).slice(0, this.random.nextInt(1, 2)),
      preferences: {
        theme: this.random.nextElement(['light', 'dark']),
        language: this.random.nextElement(['en', 'es', 'fr']),
        timezone: this.random.nextElement(['UTC', 'America/New_York', 'Europe/London'])
      },
      ...overrides
    };

    // Store generated user
    this.storeData(user.id, 'user', user);

    return user;
  }

  /**
   * Generate product data
   */
  generateProduct(overrides: Partial<any> = {}): any {
    const categories = ['electronics', 'clothing', 'books', 'home', 'sports', 'toys'];
    const product = {
      id: this.idGenerator.next('product'),
      name: `Test Product ${this.random.nextInt(1, 1000)}`,
      description: `Description for test product ${this.random.nextUUID()}`,
      price: parseFloat(this.random.nextFloat(1.99, 999.99).toFixed(2)),
      category: this.random.nextElement(categories),
      inStock: this.random.nextBoolean(0.7), // 70% in stock
      quantity: this.random.nextInt(0, 100),
      sku: `SKU-${this.random.nextString(8).toUpperCase()}`,
      createdAt: this.timestampGenerator.date(),
      updatedAt: this.timestampGenerator.date(),
      tags: this.random.shuffle(['new', 'popular', 'sale', 'featured']).slice(0, this.random.nextInt(0, 3)),
      ...overrides
    };

    // Store generated product
    this.storeData(product.id, 'product', product);

    return product;
  }

  /**
   * Generate order data
   */
  generateOrder(userId?: string, overrides: Partial<any> = {}): any {
    const order = {
      id: this.idGenerator.next('order'),
      userId: userId || this.generateUser().id,
      status: this.random.nextElement(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
      total: parseFloat(this.random.nextFloat(10.00, 1000.00).toFixed(2)),
      createdAt: this.timestampGenerator.date(),
      updatedAt: this.timestampGenerator.date(),
      items: this.generateOrderItems(this.random.nextInt(1, 5)),
      shippingAddress: this.generateAddress(),
      paymentMethod: this.random.nextElement(['credit_card', 'paypal', 'bank_transfer']),
      ...overrides
    };

    // Store generated order
    this.storeData(order.id, 'order', order, {
      dependencies: [`user_${order.userId}`],
      cleanupAfter: 600000 // 10 minutes
    });

    return order;
  }

  /**
   * Generate order items
   */
  private generateOrderItems(count: number): any[] {
    const items = [];
    for (let i = 0; i < count; i++) {
      const product = this.generateProduct();
      items.push({
        id: this.idGenerator.next('order_item'),
        productId: product.id,
        quantity: this.random.nextInt(1, 5),
        price: product.price,
        total: (product.price * this.random.nextInt(1, 5)).toFixed(2)
      });
    }
    return items;
  }

  /**
   * Generate address data
   */
  generateAddress(overrides: Partial<any> = {}): any {
    const streets = ['Main St', 'Oak Ave', 'Elm St', 'Pine Rd', 'Maple Dr'];
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
    const states = ['NY', 'CA', 'IL', 'TX', 'AZ'];

    const address = {
      id: this.idGenerator.next('address'),
      street: `${this.random.nextInt(1, 9999)} ${this.random.nextElement(streets)}`,
      city: this.random.nextElement(cities),
      state: this.random.nextElement(states),
      zipCode: this.random.nextInt(10000, 99999).toString(),
      country: 'USA',
      isPrimary: this.random.nextBoolean(),
      ...overrides
    };

    return address;
  }

  /**
   * Generate session data
   */
  generateSession(userId?: string, overrides: Partial<any> = {}): any {
    const session = {
      id: this.idGenerator.nextUUID(),
      userId: userId || this.generateUser().id,
      token: this.random.nextString(64),
      expiresAt: this.timestampGenerator.date(),
      createdAt: this.timestampGenerator.date(),
      lastAccessedAt: this.timestampGenerator.date(),
      userAgent: 'Test User Agent',
      ipAddress: '192.168.1.1',
      ...overrides
    };

    // Store generated session
    this.storeData(session.id, 'session', session, {
      dependencies: [`user_${session.userId}`],
      cleanupAfter: 3600000 // 1 hour
    });

    return session;
  }

  /**
   * Generate company data
   */
  generateCompany(overrides: Partial<any> = {}): any {
    const company = {
      id: this.idGenerator.next('company'),
      name: `Test Company ${this.random.nextInt(1, 100)}`,
      description: `Description for test company ${this.random.nextUUID()}`,
      domain: `${this.random.nextString(10).toLowerCase()}.com`,
      employees: this.random.nextInt(1, 1000),
      foundedAt: this.timestampGenerator.date(),
      createdAt: this.timestampGenerator.date(),
      updatedAt: this.timestampGenerator.date(),
      industry: this.random.nextElement(['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing']),
      ...overrides
    };

    // Store generated company
    this.storeData(company.id, 'company', company);

    return company;
  }

  /**
   * Generate random test data based on schema
   */
  generateFromSchema(schema: any): any {
    if (typeof schema === 'string') {
      return this.generateValueByType(schema);
    } else if (Array.isArray(schema)) {
      return this.generateArray(schema);
    } else if (typeof schema === 'object' && schema !== null) {
      return this.generateObject(schema);
    }

    return schema;
  }

  /**
   * Generate value by type
   */
  private generateValueByType(type: string): any {
    switch (type) {
      case 'string':
        return this.random.nextString(10);
      case 'number':
        return this.random.nextFloat(0, 1000);
      case 'integer':
        return this.random.nextInt(0, 1000);
      case 'boolean':
        return this.random.nextBoolean();
      case 'date':
        return this.timestampGenerator.date();
      case 'email':
        return this.random.nextEmail();
      case 'uuid':
        return this.random.nextUUID();
      case 'phone':
        return this.random.nextPhone();
      default:
        return null;
    }
  }

  /**
   * Generate array based on schema
   */
  private generateArray(schema: any[]): any[] {
    const length = this.random.nextInt(1, 5);
    const result = [];

    for (let i = 0; i < length; i++) {
      result.push(this.generateFromSchema(schema[0]));
    }

    return result;
  }

  /**
   * Generate object based on schema
   */
  private generateObject(schema: Record<string, any>): any {
    const result: any = {};

    for (const [key, value] of Object.entries(schema)) {
      result[key] = this.generateFromSchema(value);
    }

    return result;
  }

  /**
   * Add data dependency
   */
  addDependency(dataId: string, dependency: DataDependency): void {
    if (!this.dependencies.has(dataId)) {
      this.dependencies.set(dataId, []);
    }
    this.dependencies.get(dataId)!.push(dependency);
  }

  /**
   * Get data dependencies
   */
  getDependencies(dataId: string): DataDependency[] {
    return this.dependencies.get(dataId) || [];
  }

  /**
   * Cleanup expired data
   */
  cleanupExpiredData(): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [id, data] of this.testData.entries()) {
      const age = now - data.metadata.createdAt.getTime();

      if (age > data.metadata.cleanupAfter) {
        // Check dependencies
        const dependencies = this.getDependencies(id);
        const canCleanup = dependencies.every(dep => !dep.required);

        if (canCleanup) {
          // Cleanup dependency callbacks
          for (const dep of dependencies) {
            if (dep.cleanupCallback) {
              try {
                dep.cleanupCallback();
              } catch (error) {
                console.warn(`Cleanup callback failed for dependency ${dep.name}:`, error);
              }
            }
          }

          this.testData.delete(id);
          this.dependencies.delete(id);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Setup automatic cleanup
   */
  private setupAutoCleanup(): void {
    setInterval(() => {
      try {
        const cleanedCount = this.cleanupExpiredData();
        if (cleanedCount > 0) {
          console.log(`Cleaned up ${cleanedCount} expired test data entries`);
        }
      } catch (error) {
        console.warn('Auto cleanup failed:', error);
        if (this.cleanupConfig.forceCleanupOnError) {
          this.clearData();
        }
      }
    }, this.cleanupConfig.cleanupInterval);
  }

  /**
   * Get random generator
   */
  getRandom(): DeterministicRandom {
    return this.random;
  }

  /**
   * Get timestamp generator
   */
  getTimestampGenerator(): PredictableTimestampGenerator {
    return this.timestampGenerator;
  }

  /**
   * Get ID generator
   */
  getIDGenerator(): ConsistentIDGenerator {
    return this.idGenerator;
  }

  /**
   * Get data statistics
   */
  getDataStats(): {
    totalData: number;
    dataByType: Record<string, number>;
    oldestData: Date | null;
    newestData: Date | null;
  } {
    let oldestData: Date | null = null;
    let newestData: Date | null = null;
    const dataByType: Record<string, number> = {};

    for (const data of this.testData.values()) {
      if (!oldestData || data.metadata.createdAt < oldestData) {
        oldestData = data.metadata.createdAt;
      }
      if (!newestData || data.metadata.createdAt > newestData) {
        newestData = data.metadata.createdAt;
      }

      dataByType[data.type] = (dataByType[data.type] || 0) + 1;
    }

    return {
      totalData: this.testData.size,
      dataByType,
      oldestData,
      newestData
    };
  }

  /**
   * Export data for persistence
   */
  exportData(): string {
    const exportData = {
      testData: Array.from(this.testData.entries()),
      dependencies: Array.from(this.dependencies.entries()),
      stats: this.getDataStats(),
      config: this.config,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import data from persistence
   */
  importData(jsonData: string): void {
    try {
      const importData = JSON.parse(jsonData);

      this.testData = new Map(importData.testData);
      this.dependencies = new Map(importData.dependencies);

      // Restore generators if needed
      if (importData.config.seed) {
        this.random = new DeterministicRandom(importData.config.seed);
      }
    } catch (error) {
      throw new Error(`Failed to import test data: ${error}`);
    }
  }
}

/**
 * Factory functions for common data patterns
 */
export class TestDataFactory {
  private static dataManager: TestDataManager;

  static initialize(config?: DataGeneratorConfig): void {
    TestDataFactory.dataManager = TestDataManager.getInstance(config);
  }

  static getManager(): TestDataManager {
    if (!TestDataFactory.dataManager) {
      TestDataFactory.initialize();
    }
    return TestDataFactory.dataManager;
  }

  /**
   * Create test user
   */
  static createUser(overrides?: Partial<any>): any {
    return TestDataFactory.getManager().generateUser(overrides);
  }

  /**
   * Create test product
   */
  static createProduct(overrides?: Partial<any>): any {
    return TestDataFactory.getManager().generateProduct(overrides);
  }

  /**
   * Create test order
   */
  static createOrder(userId?: string, overrides?: Partial<any>): any {
    return TestDataFactory.getManager().generateOrder(userId, overrides);
  }

  /**
   * Create test session
   */
  static createSession(userId?: string, overrides?: Partial<any>): any {
    return TestDataFactory.getManager().generateSession(userId, overrides);
  }

  /**
   * Create test company
   */
  static createCompany(overrides?: Partial<any>): any {
    return TestDataFactory.getManager().generateCompany(overrides);
  }

  /**
   * Create random dataset
   */
  static createDataset<T>(type: string, count: number, overrides?: Partial<T>): T[] {
    const data: T[] = [];
    const manager = TestDataFactory.getManager();

    for (let i = 0; i < count; i++) {
      let item: T;

      switch (type) {
        case 'user':
          item = manager.generateUser(overrides) as T;
          break;
        case 'product':
          item = manager.generateProduct(overrides) as T;
          break;
        case 'company':
          item = manager.generateCompany(overrides) as T;
          break;
        default:
          throw new Error(`Unknown data type: ${type}`);
      }

      data.push(item);
    }

    return data;
  }
}

/**
 * Decorator for deterministic test data
 */
export function withDeterministicData(config: Partial<DataGeneratorConfig> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const dataManager = TestDataManager.getInstance(config);

      try {
        return await originalMethod.apply(this, args);
      } finally {
        // Cleanup data if configured
        if (config.cleanupStrategy === 'manual') {
          // Manual cleanup - data manager will handle it
        } else if (config.cleanupStrategy === 'none') {
          // No cleanup
          dataManager.clearData();
        }
      }
    };

    return descriptor;
  };
}

/**
 * Configuration presets
 */
export const DataConfig = {
  fast: {
    seed: 12345,
    predictableTimestamps: true,
    consistentIds: true,
    mockRandomness: true,
    cleanupStrategy: 'auto' as const,
    cleanupInterval: 5000,
    maxRetention: 30000
  } as DataGeneratorConfig,

  reproducible: {
    seed: 54321,
    predictableTimestamps: true,
    consistentIds: true,
    mockRandomness: true,
    dataVersioning: true,
    cleanupStrategy: 'manual' as const
  } as DataGeneratorConfig,

  persistent: {
    predictableTimestamps: false,
    consistentIds: false,
    mockRandomness: false,
    dataVersioning: true,
    cleanupStrategy: 'none' as const
  } as DataGeneratorConfig
};