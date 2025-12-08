/**
 * Database Security Tests
 * Tests for SQL injection prevention and secure database operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  SecureQueryBuilder,
  SecureDatabaseManager,
  secureDB,
  validateIdentifier,
  sanitizeValue
} from '../../src/database/secure-query-builder.js';

describe('Database Security Tests', () => {
  let dbManager: SecureDatabaseManager;

  beforeAll(() => {
    dbManager = new SecureDatabaseManager();
  });

  beforeEach(() => {
    // Clear query history before each test
    (dbManager as any).queryHistory = [];
  });

  describe('Identifier Validation', () => {
    it('should allow valid identifiers', () => {
      expect(validateIdentifier('users')).toBe(true);
      expect(validateIdentifier('user_profile')).toBe(true);
      expect(validateIdentifier('users123')).toBe(true);
      expect(validateIdentifier('table.column')).toBe(true);
      expect(validateIdentifier('schema.table.column')).toBe(true);
    });

    it('should reject dangerous identifiers', () => {
      expect(validateIdentifier('users; DROP TABLE')).toBe(false);
      expect(validateIdentifier('users--')).toBe(false);
      expect(validateIdentifier('users/*')).toBe(false);
      expect(validateIdentifier('users DROP')).toBe(false);
      expect(validateIdentifier('1invalid')).toBe(false);
      expect(validateIdentifier('users with spaces')).toBe(false);
      expect(validateIdentifier('users;')).toBe(false);
    });

    it('should reject SQL keywords in identifiers', () => {
      expect(validateIdentifier('SELECT')).toBe(false);
      expect(validateIdentifier('DROP users')).toBe(false);
      expect(validateIdentifier('INSERT into')).toBe(false);
      expect(validateIdentifier('UPDATE users')).toBe(false);
      expect(validateIdentifier('DELETE FROM')).toBe(false);
    });
  });

  describe('Value Sanitization', () => {
    it('should sanitize strings properly', () => {
      expect(sanitizeValue("O'Reilly")).toBe("O''Reilly");
      expect(sanitizeValue("test; DROP TABLE")).toBe("test DROP TABLE");
      expect(sanitizeValue("test--comment")).toBe("testcomment");
      expect(sanitizeValue("test/*comment*/")).toBe("testcomment");
    });

    it('should handle null and undefined values', () => {
      expect(sanitizeValue(null)).toBe(null);
      expect(sanitizeValue(undefined)).toBe(undefined);
    });

    it('should handle numbers properly', () => {
      expect(sanitizeValue(42)).toBe(42);
      expect(sanitizeValue(3.14)).toBe(3.14);
      expect(sanitizeValue(Infinity)).toBe(0);
      expect(sanitizeValue(NaN)).toBe(0);
    });

    it('should handle boolean values', () => {
      expect(sanitizeValue(true)).toBe(1);
      expect(sanitizeValue(false)).toBe(0);
    });

    it('should handle arrays and objects', () => {
      expect(sanitizeValue([1, 2, 3])).toEqual([1, 2, 3]);
      expect(sanitizeValue({ name: 'test' })).toBe(JSON.stringify({ name: 'test' }));
    });
  });

  describe('Secure Query Builder', () => {
    it('should build safe SELECT queries', () => {
      const builder = new SecureQueryBuilder({
        table: 'users',
        select: ['id', 'name', 'email'],
        where: { status: 'active', id: 123 },
        limit: 10
      });

      const { query, params } = builder.buildSelect();

      expect(query).toContain('SELECT id, name, email FROM users');
      expect(query).toContain('WHERE status = $1 AND id = $2');
      expect(query).toContain('LIMIT 10');
      expect(params).toEqual(['active', 123]);
    });

    it('should handle IN clauses safely', () => {
      const builder = new SecureQueryBuilder({
        table: 'users',
        where: { id: [1, 2, 3] }
      });

      const { query, params } = builder.buildSelect();

      expect(query).toContain('WHERE id IN ($1, $2, $3)');
      expect(params).toEqual([1, 2, 3]);
    });

    it('should handle operators safely', () => {
      const builder = new SecureQueryBuilder({
        table: 'users',
        where: {
          age: { '>=': 18 },
          score: { '<=': 100 },
          name: 'LIKE John%'
        }
      });

      const { query, params } = builder.buildSelect();

      expect(query).toContain('WHERE age >= $1 AND score <= $2 AND name = $3');
      expect(params).toEqual([18, 100, 'LIKE John%']);
    });

    it('should build safe INSERT queries', () => {
      const builder = new SecureQueryBuilder({
        table: 'users'
      });

      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const { query, params } = builder.buildInsert(data);

      expect(query).toContain('INSERT INTO users (name, email, age) VALUES ($1, $2, $3)');
      expect(params).toEqual(['John', 'john@example.com', 30]);
    });

    it('should build safe UPDATE queries', () => {
      const builder = new SecureQueryBuilder({
        table: 'users',
        where: { id: 123 }
      });

      const data = { name: 'John', email: 'john@example.com' };
      const { query, params } = builder.buildUpdate(data);

      expect(query).toContain('UPDATE users SET name = $1, email = $2 WHERE id = $3');
      expect(params).toEqual(['John', 'john@example.com', 123]);
    });

    it('should build safe DELETE queries with WHERE clause', () => {
      const builder = new SecureQueryBuilder({
        table: 'users',
        where: { id: 123 }
      });

      const { query, params } = builder.buildDelete();

      expect(query).toContain('DELETE FROM users WHERE id = $1');
      expect(params).toEqual([123]);
    });

    it('should reject DELETE queries without WHERE clause', () => {
      const builder = new SecureQueryBuilder({
        table: 'users'
      });

      expect(() => builder.buildDelete()).toThrow('DELETE queries must include a WHERE clause');
    });

    it('should reject invalid table names', () => {
      expect(() => new SecureQueryBuilder({
        table: 'users; DROP TABLE'
      })).toThrow('Invalid table name');
    });

    it('should reject invalid column names', () => {
      expect(() => new SecureQueryBuilder({
        table: 'users',
        select: ['id; DROP TABLE']
      })).toThrow('Invalid column name: id; DROP TABLE');
    });
  });

  describe('Secure Database Manager', () => {
    it('should validate queries for dangerous patterns', async () => {
      const dangerousQueries = [
        'SELECT * FROM users; DROP TABLE users',
        "SELECT * FROM users WHERE 1=1 OR '1'='1",
        'SELECT * FROM users UNION SELECT * FROM passwords',
        "SELECT * FROM users; EXEC xp_cmdshell('dir')",
        'SELECT * FROM users INTO OUTFILE "/tmp/users.txt"'
      ];

      for (const query of dangerousQueries) {
        await expect(
          dbManager.executeQuery(query)
        ).rejects.toThrow('dangerous SQL pattern');
      }
    });

    it('should reject queries with unbalanced quotes', async () => {
      const unbalancedQueries = [
        "SELECT * FROM users WHERE name = 'John",
        'SELECT * FROM users WHERE name = "John',
        "SELECT * FROM users WHERE name = John'"
      ];

      for (const query of unbalancedQueries) {
        await expect(
          dbManager.executeQuery(query)
        ).rejects.toThrow('Unbalanced quotes');
      }
    });

    it('should allow safe queries', async () => {
      const safeQueries = [
        'SELECT id, name FROM users WHERE status = $1',
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        'UPDATE users SET name = $1 WHERE id = $2',
        'DELETE FROM users WHERE id = $1 AND status = $2'
      ];

      for (const query of safeQueries) {
        const result = await dbManager.executeQuery(query, ['test', 123]);
        expect(result).toBeDefined();
        expect(result.rows).toBeDefined();
        expect(result.command).toBeDefined();
      }
    });

    it('should log query executions', async () => {
      await dbManager.executeQuery('SELECT * FROM users', [], { userId: 'test-user' });

      const history = dbManager.getQueryHistory();
      expect(history).toHaveLength(1);
      expect(history[0].userId).toBe('test-user');
      expect(history[0].query).toContain('SELECT * FROM users');
      expect(history[0].timestamp).toBeDefined();
    });

    it('should limit query history size', async () => {
      // Mock a full history
      (dbManager as any).queryHistory = new Array(1500).fill(null).map((_, i) => ({
        query: `SELECT ${i}`,
        timestamp: Date.now() - i
      }));

      await dbManager.executeQuery('SELECT * FROM users');

      const history = dbManager.getQueryHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Secure Database Helper Functions', () => {
    it('should perform secure find operations', async () => {
      const results = await secureDB.find('users', { status: 'active' }, { limit: 5 });
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should perform secure create operations', async () => {
      const data = { name: 'Test User', email: 'test@example.com' };
      const result = await secureDB.create('users', data);
      expect(result).toBeDefined();
    });

    it('should perform secure update operations', async () => {
      const data = { name: 'Updated Name' };
      const where = { id: 123 };
      const affectedRows = await secureDB.update('users', data, where);
      expect(typeof affectedRows).toBe('number');
    });

    it('should perform secure delete operations', async () => {
      const where = { id: 123 };
      const affectedRows = await secureDB.delete('users', where);
      expect(typeof affectedRows).toBe('number');
    });
  });

  describe('Transaction Security', () => {
    it('should execute secure transactions', async () => {
      const queries = [
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['User1'] },
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['User2'] }
      ];

      const results = await dbManager.executeTransaction(queries, { userId: 'test-user' });
      expect(results).toHaveLength(2);
    });

    it('should validate all queries in transaction', async () => {
      const queries = [
        { query: 'INSERT INTO users (name) VALUES ($1)', params: ['User1'] },
        { query: 'DROP TABLE users' } // Dangerous query
      ];

      await expect(
        dbManager.executeTransaction(queries)
      ).rejects.toThrow('dangerous SQL pattern');
    });
  });

  describe('JOIN Security', () => {
    it('should build secure JOIN queries', () => {
      const builder = new SecureQueryBuilder({
        table: 'users',
        joins: [
          {
            type: 'INNER',
            table: 'profiles',
            on: 'users.id = profiles.user_id'
          }
        ],
        where: { 'users.status': 'active' }
      });

      const { query, params } = builder.buildSelect();

      expect(query).toContain('INNER JOIN profiles ON users.id = profiles.user_id');
      expect(query).toContain('WHERE users.status = $1');
      expect(params).toEqual(['active']);
    });

    it('should reject invalid JOIN configurations', () => {
      expect(() => new SecureQueryBuilder({
        table: 'users',
        joins: [
          {
            type: 'INNER',
            table: 'users; DROP TABLE',
            on: 'valid.condition'
          }
        ]
      })).toThrow('Invalid join configuration');
    });
  });
});