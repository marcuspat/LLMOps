/**
 * Secure Database Query Builder
 * Prevents SQL injection and provides safe database access
 */

import { config } from '../config/index.js';

export interface QueryOptions {
  table: string;
  select?: string[];
  where?: Record<string, any>;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  joins?: JoinConfig[];
}

export interface JoinConfig {
  table: string;
  on: string;
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

/**
 * Validates table and column names to prevent SQL injection
 */
export const validateIdentifier = (identifier: string): boolean => {
  // Only allow alphanumeric characters, underscores, and periods
  const validPattern = /^[a-zA-Z0-9_.]+$/;
  return validPattern.test(identifier) && !identifier.includes('--') && !identifier.includes('/*');
};

/**
 * Validates and sanitizes values for SQL queries
 */
export const sanitizeValue = (value: any): any => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    // Escape single quotes and remove dangerous characters
    return value.replace(/'/g, "''").replace(/;/g, '').replace(/--/g, '').replace(/\/\*/g, '');
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (typeof value === 'object') {
    // Convert objects to JSON string and sanitize
    return sanitizeValue(JSON.stringify(value));
  }

  return value;
};

/**
 * Creates a parameterized WHERE clause
 */
export class SecureQueryBuilder {
  private params: any[] = [];
  private paramIndex = 0;

  constructor(private options: QueryOptions) {
    this.validateOptions();
  }

  /**
   * Validates query options
   */
  private validateOptions(): void {
    if (!this.options.table || !validateIdentifier(this.options.table)) {
      throw new Error('Invalid table name');
    }

    if (this.options.select) {
      for (const column of this.options.select) {
        if (!validateIdentifier(column)) {
          throw new Error(`Invalid column name: ${column}`);
        }
      }
    }

    if (this.options.orderBy && !validateIdentifier(this.options.orderBy)) {
      throw new Error('Invalid order by column');
    }
  }

  /**
   * Creates a parameter placeholder
   */
  private createParam(value: any): string {
    this.params.push(sanitizeValue(value));
    return `$${++this.paramIndex}`;
  }

  /**
   * Builds WHERE clause
   */
  private buildWhereClause(): { clause: string; params: any[] } {
    if (!this.options.where || Object.keys(this.options.where).length === 0) {
      return { clause: '', params: [] };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(this.options.where)) {
      if (!validateIdentifier(key)) {
        throw new Error(`Invalid column name in WHERE clause: ${key}`);
      }

      if (Array.isArray(value)) {
        // IN clause
        const placeholders = value.map(() => this.createParam(value)).join(', ');
        conditions.push(`${key} IN (${placeholders})`);
      } else if (typeof value === 'object' && value !== null) {
        // Handle operators like { '>=': 100, '<=': 200 }
        for (const [operator, operatorValue] of Object.entries(value)) {
          const cleanOperator = operator.replace(/[^\w>=<!]/g, '');
          if (['>', '<', '>=', '<=', '=', '!=', 'LIKE', 'ILIKE'].includes(cleanOperator)) {
            conditions.push(`${key} ${cleanOperator} ${this.createParam(operatorValue)}`);
          }
        }
      } else if (value === null) {
        conditions.push(`${key} IS NULL`);
      } else {
        conditions.push(`${key} = ${this.createParam(value)}`);
      }
    }

    const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { clause, params: this.params };
  }

  /**
   * Builds ORDER BY clause
   */
  private buildOrderByClause(): string {
    if (!this.options.orderBy) {
      return '';
    }

    const direction = this.options.order?.toUpperCase() || 'ASC';
    if (!['ASC', 'DESC'].includes(direction)) {
      throw new Error('Invalid order direction. Must be ASC or DESC');
    }

    return `ORDER BY ${this.options.orderBy} ${direction}`;
  }

  /**
   * Builds JOIN clauses
   */
  private buildJoinClauses(): string {
    if (!this.options.joins || this.options.joins.length === 0) {
      return '';
    }

    const joins: string[] = [];

    for (const join of this.options.joins) {
      if (!validateIdentifier(join.table) || !validateIdentifier(join.on)) {
        throw new Error(`Invalid join configuration for table: ${join.table}`);
      }

      joins.push(`${join.type} JOIN ${join.table} ON ${join.on}`);
    }

    return joins.join(' ');
  }

  /**
   * Builds SELECT query
   */
  buildSelect(): { query: string; params: any[] } {
    const selectColumns = this.options.select && this.options.select.length > 0
      ? this.options.select.join(', ')
      : '*';

    const { clause: whereClause, params } = this.buildWhereClause();
    const orderByClause = this.buildOrderByClause();
    const joinClauses = this.buildJoinClauses();

    let query = `SELECT ${selectColumns} FROM ${this.options.table}`;

    if (joinClauses) {
      query += ` ${joinClauses}`;
    }

    if (whereClause) {
      query += ` ${whereClause}`;
    }

    if (orderByClause) {
      query += ` ${orderByClause}`;
    }

    if (this.options.limit) {
      query += ` LIMIT ${this.options.limit}`;
    }

    if (this.options.offset) {
      query += ` OFFSET ${this.options.offset}`;
    }

    return { query, params };
  }

  /**
   * Builds INSERT query
   */
  buildInsert(data: Record<string, any>): { query: string; params: any[] } {
    const columns: string[] = [];
    const values: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (!validateIdentifier(key)) {
        throw new Error(`Invalid column name: ${key}`);
      }

      columns.push(key);
      values.push(this.createParam(value));
    }

    const query = `INSERT INTO ${this.options.table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;

    return { query, params };
  }

  /**
   * Builds UPDATE query
   */
  buildUpdate(data: Record<string, any>): { query: string; params: any[] } {
    const setClause: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (!validateIdentifier(key)) {
        throw new Error(`Invalid column name: ${key}`);
      }

      setClause.push(`${key} = ${this.createParam(value)}`);
    }

    const { clause: whereClause, params } = this.buildWhereClause();
    const allParams = [...this.params];

    let query = `UPDATE ${this.options.table} SET ${setClause.join(', ')}`;

    if (whereClause) {
      query += ` ${whereClause}`;
    }

    return { query, params: allParams };
  }

  /**
   * Builds DELETE query
   */
  buildDelete(): { query: string; params: any[] } {
    const { clause: whereClause, params } = this.buildWhereClause();

    let query = `DELETE FROM ${this.options.table}`;

    if (whereClause) {
      query += ` ${whereClause}`;
    } else {
      throw new Error('DELETE queries must include a WHERE clause');
    }

    return { query, params };
  }
}

/**
 * Database connection manager with security features
 */
export class SecureDatabaseManager {
  private connectionPool: any[] = [];
  private maxConnections: number;
  private queryHistory: Array<{ query: string; timestamp: number; userId?: string }> = [];
  private maxHistorySize: number = 1000;

  constructor() {
    this.maxConnections = 10; // Configure based on your database
  }

  /**
   * Executes a secure query with parameterization
   */
  async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    context?: { userId?: string; operation?: string }
  ): Promise<QueryResult<T>> {
    // Validate query for dangerous patterns
    this.validateQuery(query);

    // Log query execution (without parameters for security)
    this.logQuery(query, context);

    try {
      // This would be replaced with actual database driver code
      // For now, we'll simulate the execution
      const result = await this.simulateQueryExecution<T>(query, params);

      return result;
    } catch (error) {
      console.error('Database query execution error:', error);
      throw new Error('Query execution failed');
    }
  }

  /**
   * Validates query for SQL injection attempts
   */
  private validateQuery(query: string): void {
    const dangerousPatterns = [
      /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
      /(--|\*\/|\/\*)/g,  // Comments
      /(\bOR\b\s*1\s*=\s*1|\bAND\b\s*1\s*=\s*1)/gi,  // Always true conditions
      /(\bxp_cmdshell\b|\bsp_exec\b)/gi,  // SQL Server command execution
      /(\bLOAD_FILE\b|\bINTO\s+OUTFILE\b|\bINTO\s+DUMPFILE\b)/gi,  // File operations
      /;\s*DROP\s+/gi,  // Chained destructive queries
      /\b(?:xp_|sp_)/gi  // Extended stored procedures (SQL Server)
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query.toUpperCase())) {
        throw new Error('Potentially dangerous SQL pattern detected');
      }
    }

    // Check for unbalanced quotes
    const singleQuoteCount = (query.match(/'/g) || []).length;
    const doubleQuoteCount = (query.match(/"/g) || []).length;

    if (singleQuoteCount % 2 !== 0 || doubleQuoteCount % 2 !== 0) {
      throw new Error('Unbalanced quotes in query');
    }
  }

  /**
   * Logs query execution for audit purposes
   */
  private logQuery(query: string, context?: { userId?: string; operation?: string }): void {
    const logEntry = {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''), // Truncate long queries
      timestamp: Date.now(),
      userId: context?.userId,
      operation: context?.operation
    };

    this.queryHistory.push(logEntry);

    // Maintain history size
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory = this.queryHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Simulates query execution (replace with actual database driver)
   */
  private async simulateQueryExecution<T>(query: string, params: any[]): Promise<QueryResult<T>> {
    // This is a placeholder for actual database execution
    // In a real implementation, this would use your database driver

    console.log(`Executing query: ${query}`);
    console.log(`Parameters: ${JSON.stringify(params)}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 10));

    // Return mock result
    return {
      rows: [] as T[],
      rowCount: 0,
      command: query.trim().split(' ')[0].toUpperCase()
    };
  }

  /**
   * Gets query execution history
   */
  getQueryHistory(limit?: number): Array<{ query: string; timestamp: number; userId?: string }> {
    const history = this.queryHistory.sort((a, b) => b.timestamp - a.timestamp);
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Creates a new query builder
   */
  createQueryBuilder(options: QueryOptions): SecureQueryBuilder {
    return new SecureQueryBuilder(options);
  }

  /**
   * Executes a transaction securely
   */
  async executeTransaction<T>(
    queries: Array<{ query: string; params?: any[] }>,
    context?: { userId?: string }
  ): Promise<T[]> {
    const results: T[] = [];

    // In a real implementation, this would use database transactions
    for (const { query, params = [] } of queries) {
      const result = await this.executeQuery<T>(query, params, context);
      results.push(result.rows as T);
    }

    return results;
  }
}

// Export singleton instance
export const secureDatabase = new SecureDatabaseManager();

/**
 * Helper functions for common database operations
 */
export const secureDB = {
  /**
   * Find records with security
   */
  find: async <T>(table: string, where?: Record<string, any>, options?: Partial<QueryOptions>): Promise<T[]> => {
    const builder = secureDatabase.createQueryBuilder({
      table,
      where,
      limit: options?.limit || 100,
      ...options
    });

    const { query, params } = builder.buildSelect();
    const result = await secureDatabase.executeQuery<T>(query, params);

    return result.rows;
  },

  /**
   * Insert record with security
   */
  create: async <T>(table: string, data: Record<string, any>): Promise<T> => {
    const builder = secureDatabase.createQueryBuilder({ table });
    const { query, params } = builder.buildInsert(data);

    const result = await secureDatabase.executeQuery<T>(query, params);
    return result.rows[0];
  },

  /**
   * Update record with security
   */
  update: async <T>(table: string, data: Record<string, any>, where: Record<string, any>): Promise<number> => {
    const builder = secureDatabase.createQueryBuilder({ table, where });
    const { query, params } = builder.buildUpdate(data);

    const result = await secureDatabase.executeQuery<T>(query, params);
    return result.rowCount;
  },

  /**
   * Delete record with security
   */
  delete: async (table: string, where: Record<string, any>): Promise<number> => {
    const builder = secureDatabase.createQueryBuilder({ table, where });
    const { query, params } = builder.buildDelete();

    const result = await secureDatabase.executeQuery(query, params);
    return result.rowCount;
  }
};