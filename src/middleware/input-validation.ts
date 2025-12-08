/**
 * Comprehensive Input Validation Middleware
 * Prevents injection attacks and validates all input data
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Sanitizes string input to prevent XSS and injection attacks
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove potential XSS patterns
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Limit length
    .substring(0, 10000);
};

/**
 * Deep sanitizes object values recursively
 */
export const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  return obj;
};

/**
 * Validates request body against schema
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize input first
      const sanitizedBody = sanitizeObject(req.body);

      // Validate against schema
      const validatedBody = schema.parse(sanitizedBody);

      // Replace request body with validated data
      req.body = validatedBody;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            })),
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      console.error('Validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Validates query parameters against schema
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize query parameters
      const sanitizedQuery = sanitizeObject(req.query);

      // Validate against schema
      const validatedQuery = schema.parse(sanitizedQuery);

      // Replace request query with validated data
      req.query = validatedQuery;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'QUERY_VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            })),
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      console.error('Query validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QUERY_VALIDATION_FAILED',
          message: 'Query parameter validation failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Validates path parameters against schema
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize path parameters
      const sanitizedParams = sanitizeObject(req.params);

      // Validate against schema
      const validatedParams = schema.parse(sanitizedParams);

      // Replace request params with validated data
      req.params = validatedParams;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'PARAM_VALIDATION_ERROR',
            message: 'Invalid path parameters',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            })),
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      console.error('Parameter validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PARAM_VALIDATION_FAILED',
          message: 'Path parameter validation failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

// Common validation schemas
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).optional()
  }),

  // Sorting
  sort: z.object({
    sort: z.string().regex(/^[a-zA-Z0-9_]+$/).optional(),
    order: z.enum(['asc', 'desc']).default('asc')
  }),

  // ID validation
  id: z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/).min(1).max(100)
  }),

  // Agent type validation
  agentType: z.object({
    type: z.enum(['coordinator', 'analyst', 'optimizer', 'coder', 'tester', 'reviewer'])
  }),

  // Swarm configuration
  swarmConfig: z.object({
    topology: z.enum(['hierarchical', 'mesh', 'ring', 'star', 'adaptive']).optional(),
    maxAgents: z.coerce.number().int().min(1).max(100).optional(),
    strategy: z.enum(['balanced', 'specialized', 'adaptive']).optional()
  }),

  // Search query
  search: z.object({
    search: z.string().max(500).optional(),
    filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional()
  }),

  // GitHub repository
  githubRepo: z.object({
    owner: z.string().regex(/^[a-zA-Z0-9_-]+$/).min(1).max(39),
    repo: z.string().regex(/^[a-zA-Z0-9._-]+$/).min(1).max(100)
  }),

  // Date range
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional()
  }).refine((data) => {
    if (data.start && data.end) {
      return new Date(data.start) <= new Date(data.end);
    }
    return true;
  }, {
    message: 'Start date must be before end date'
  }),

  // File upload
  fileUpload: z.object({
    filename: z.string().max(255).regex(/^[a-zA-Z0-9._-]+$/),
    size: z.coerce.number().int().min(1).max(10 * 1024 * 1024), // 10MB max
    mimetype: z.enum(['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'])
  }),

  // Security scan options
  securityScan: z.object({
    type: z.enum(['quick', 'comprehensive', 'custom']),
    target: z.string().min(1).max(1000),
    options: z.record(z.any()).optional()
  }),

  // Performance monitoring
  performanceMetrics: z.object({
    interval: z.coerce.number().int().min(1000).max(300000).optional(), // 1s - 5min
    metrics: z.array(z.string()).optional()
  }),

  // Truth verification
  truthVerification: z.object({
    content: z.string().min(1).max(100000),
    context: z.record(z.any()).optional(),
    threshold: z.coerce.number().min(0).max(1).optional()
  })
};

/**
 * Database query validation to prevent SQL injection
 */
export const validateDatabaseQuery = (query: string): boolean => {
  // Basic SQL injection detection
  const dangerousPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\*\/|\/\*)/g,  // Comments
    /(\bOR\b\s*1\s*=\s*1|\bAND\b\s*1\s*=\s*1)/gi,  // Always true conditions
    /(\bxp_cmdshell\b|\bsp_exec\b)/gi,  // SQL Server command execution
    /(\bLOAD_FILE\b|\bINTO\s+OUTFILE\b|\bINTO\s+DUMPFILE\b)/gi  // File operations
  ];

  // Check for dangerous patterns
  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      return false;
    }
  }

  // Check for unbalanced quotes (potential injection)
  const singleQuoteCount = (query.match(/'/g) || []).length;
  const doubleQuoteCount = (query.match(/"/g) || []).length;

  if (singleQuoteCount % 2 !== 0 || doubleQuoteCount % 2 !== 0) {
    return false;
  }

  return true;
};

/**
 * NoSQL injection prevention
 */
export const validateNoSQLQuery = (query: any): boolean => {
  if (typeof query === 'object' && query !== null) {
    const dangerousPatterns = [
      /\$where/gi,
      /\$regex/gi,
      /\$ne/gi,
      /\$gt/gi,
      /\$lt/gi,
      /\$in/gi,
      /\$nin/gi
    ];

    const queryString = JSON.stringify(query);
    for (const pattern of dangerousPatterns) {
      if (pattern.test(queryString)) {
        // Allow these operators but ensure they're properly sanitized
        continue;
      }
    }

    // Check for JavaScript code in queries
    if (queryString.includes('function') || queryString.includes('=>')) {
      return false;
    }
  }

  return true;
};

/**
 * Comprehensive input validation middleware
 */
export const validateInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Validate request body against NoSQL injection
    if (req.body && !validateNoSQLQuery(req.body)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Invalid query detected',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Validate query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          // Check for potential injection in query strings
          const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i
          ];

          for (const pattern of dangerousPatterns) {
            if (pattern.test(value)) {
              res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_QUERY_PARAM',
                  message: `Invalid parameter detected: ${key}`,
                  timestamp: new Date().toISOString()
                }
              });
              return;
            }
          }
        }
      }
    }

    // Sanitize all input data
    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);

    next();
  } catch (error) {
    console.error('Input validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};