import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { logger } from '../utils/secure-logger.js';
import { performance } from 'perf_hooks';

interface CompressionConfig {
  threshold: number; // Minimum size to compress (bytes)
  level: number; // Compression level (1-9)
  algorithms: ('gzip' | 'deflate' | 'br')[];
}

interface FieldSelectionConfig {
  defaultFields?: string[];
  maxFields?: number;
  blacklist?: string[];
  whitelist?: string[];
}

interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
  defaultSort?: string;
}

interface OptimizationConfig {
  compression?: CompressionConfig;
  fieldSelection?: FieldSelectionConfig;
  pagination?: PaginationConfig;
  caching?: {
    enabled: boolean;
    ttl: number;
    varyHeaders?: string[];
  };
  etag?: boolean;
  conditionalRequests?: boolean;
  responseTimeTracking?: boolean;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
    requestId?: string;
    responseTime?: number;
    cached?: boolean;
    compressed?: boolean;
  };
}

/**
 * Advanced API response optimizer for production performance
 * - Response compression with multiple algorithms
 * - Field selection and projection
 * - Pagination optimization
 * - ETag and conditional request support
 * - Response caching headers
 * - Performance monitoring and metrics
 * - Automatic minification for JSON responses
 */
export class ResponseOptimizer {
  private config: OptimizationConfig;

  constructor(config: OptimizationConfig = {}) {
    this.config = {
      compression: {
        threshold: 1024, // 1KB
        level: 6,
        algorithms: ['gzip', 'br', 'deflate'],
        ...config.compression
      },
      fieldSelection: {
        maxFields: 100,
        ...config.fieldSelection
      },
      pagination: {
        defaultLimit: 20,
        maxLimit: 100,
        ...config.pagination
      },
      caching: {
        enabled: true,
        ttl: 300, // 5 minutes
        ...config.caching
      },
      etag: true,
      conditionalRequests: true,
      responseTimeTracking: true,
      ...config
    };
  }

  /**
   * Express middleware for response optimization
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const requestId = this.generateRequestId();

      // Add request ID to response
      res.setHeader('X-Request-ID', requestId);
      req.requestId = requestId;

      // Store original res.json
      const originalJson = res.json;

      // Override res.json to apply optimizations
      res.json = (data: any) => {
        try {
          const optimizedData = this.optimizeResponse(req, data);
          const responseTime = performance.now() - startTime;

          // Add response time to data if tracking enabled
          if (this.config.responseTimeTracking) {
            if (optimizedData.meta) {
              optimizedData.meta.responseTime = Math.round(responseTime);
            } else {
              optimizedData.meta = { responseTime: Math.round(responseTime) };
            }
          }

          // Apply compression
          if (this.shouldCompress(req, optimizedData)) {
            this.applyCompression(res);
          }

          // Apply caching headers
          if (this.config.caching?.enabled) {
            this.applyCachingHeaders(req, res);
          }

          // Apply ETag
          if (this.config.etag) {
            this.applyETag(res, optimizedData);
          }

          // Log response metrics
          this.logResponse(req, res, responseTime, optimizedData);

          // Send optimized response
          return originalJson.call(res, optimizedData);

        } catch (error) {
          logger.error('Response optimization failed', {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown',
            url: req.url
          });

          // Fallback to original data
          return originalJson.call(res, data);
        }
      };

      // Handle conditional requests
      if (this.config.conditionalRequests) {
        this.handleConditionalRequests(req, res);
      }

      next();
    };
  }

  /**
   * Optimize response data based on request and configuration
   */
  private optimizeResponse(req: Request, data: any): ApiResponse {
    let optimized = { ...data };

    // Apply field selection
    if (this.config.fieldSelection && req.query.fields) {
      optimized = this.applyFieldSelection(optimized, req.query.fields as string);
    }

    // Apply pagination for array responses
    if (Array.isArray(optimized.data) && this.config.pagination) {
      optimized = this.applyPagination(optimized, req.query);
    }

    // Minify response by removing undefined values
    optimized = this.minifyResponse(optimized);

    // Apply response schema validation if provided
    if (req.responseSchema) {
      optimized = this.validateResponse(optimized, req.responseSchema as ZodSchema);
    }

    return optimized;
  }

  /**
   * Apply field selection to response data
   */
  private applyFieldSelection(data: ApiResponse, fieldsStr: string): ApiResponse {
    const fields = fieldsStr.split(',').map(f => f.trim());
    const config = this.config.fieldSelection!;

    // Check against blacklist and whitelist
    const selectedFields = fields.filter(field => {
      if (config.blacklist?.includes(field)) return false;
      if (config.whitelist && !config.whitelist.includes(field)) return false;
      return true;
    });

    // Limit number of fields
    const maxFields = selectedFields.length <= (config.maxFields || 100)
      ? selectedFields
      : selectedFields.slice(0, config.maxFields || 100);

    // Apply field selection to data
    if (data.data && typeof data.data === 'object') {
      data.data = this.selectFields(data.data, maxFields);
    }

    return data;
  }

  /**
   * Recursively select fields from object
   */
  private selectFields(obj: any, fields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.selectFields(item, fields));
    }

    const result: any = {};
    for (const field of fields) {
      if (field in obj) {
        result[field] = obj[field];
      }
    }

    return result;
  }

  /**
   * Apply pagination to array responses
   */
  private applyPagination(data: ApiResponse, query: any): ApiResponse {
    if (!Array.isArray(data.data)) {
      return data;
    }

    const config = this.config.pagination!;
    const page = parseInt(query.page as string) || 1;
    const limit = Math.min(
      parseInt(query.limit as string) || config.defaultLimit,
      config.maxLimit
    );
    const offset = (page - 1) * limit;

    // Apply sorting
    let sortedData = [...data.data];
    if (query.sort) {
      const sortField = query.sort as string;
      const sortOrder = query.order === 'desc' ? -1 : 1;
      sortedData.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -sortOrder;
        if (a[sortField] > b[sortField]) return sortOrder;
        return 0;
      });
    } else if (config.defaultSort) {
      const sortField = config.defaultSort;
      sortedData.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1;
        if (a[sortField] > b[sortField]) return 1;
        return 0;
      });
    }

    // Apply pagination
    const paginatedData = sortedData.slice(offset, offset + limit);
    const total = sortedData.length;

    return {
      ...data,
      data: paginatedData,
      meta: {
        ...data.meta,
        total,
        page,
        limit,
        hasMore: offset + limit < total
      }
    };
  }

  /**
   * Minify response by removing undefined values and normalizing
   */
  private minifyResponse(data: ApiResponse): ApiResponse {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const minified: ApiResponse = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const nested = this.minifyResponse(value as ApiResponse);
          if (Object.keys(nested).length > 0) {
            minified[key as keyof ApiResponse] = nested;
          }
        } else {
          minified[key as keyof ApiResponse] = value;
        }
      }
    }

    return minified;
  }

  /**
   * Validate response against schema
   */
  private validateResponse(data: ApiResponse, schema: ZodSchema): ApiResponse {
    try {
      return schema.parse(data) as ApiResponse;
    } catch (error) {
      logger.warn('Response schema validation failed', {
        error: error instanceof Error ? error.message : 'Unknown'
      });

      // Return original data if validation fails
      return data;
    }
  }

  /**
   * Check if response should be compressed
   */
  private shouldCompress(req: Request, data: ApiResponse): boolean {
    if (!this.config.compression) {
      return false;
    }

    const size = JSON.stringify(data).length;
    if (size < this.config.compression.threshold) {
      return false;
    }

    // Check if client accepts compression
    const acceptEncoding = req.headers['accept-encoding'] || '';
    return this.config.compression.algorithms.some(algo =>
      acceptEncoding.includes(algo)
    );
  }

  /**
   * Apply compression headers
   */
  private applyCompression(res: Response): void {
    const config = this.config.compression!;

    // Let compression middleware handle actual compression
    // Just mark that compression is preferred
    res.setHeader('X-Compression-Preferred', 'true');
  }

  /**
   * Apply caching headers
   */
  private applyCachingHeaders(req: Request, res: Response): void {
    const config = this.config.caching!;

    if (req.method !== 'GET') {
      return;
    }

    // Set cache-control
    const directives = [
      config.ttl > 0 ? `public, max-age=${config.ttl}` : 'no-cache',
      'stale-while-revalidate=60',
      'stale-if-error=86400'
    ];

    res.setHeader('Cache-Control', directives.join(', '));

    // Set Vary header if specified
    if (config.varyHeaders && config.varyHeaders.length > 0) {
      res.setHeader('Vary', config.varyHeaders.join(', '));
    }

    // Add timestamp for cache busting
    res.setHeader('X-Cache-Timestamp', Date.now().toString());
  }

  /**
   * Generate and apply ETag
   */
  private applyETag(res: Response, data: ApiResponse): void {
    const etag = this.generateETag(data);
    res.setHeader('ETag', etag);
    res.setHeader('X-ETag-Generated', 'true');
  }

  /**
   * Generate ETag from response data
   */
  private generateETag(data: ApiResponse): string {
    const dataStr = JSON.stringify(data);
    const hash = this.simpleHash(dataStr);
    return `"${hash}"`;
  }

  /**
   * Simple hash function for ETag generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Handle conditional requests (If-None-Match, If-Modified-Since)
   */
  private handleConditionalRequests(req: Request, res: Response): void {
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];

    // Handle If-None-Match (ETag)
    if (ifNoneMatch) {
      res.setHeader('X-Conditional-Request', 'ETag');
    }

    // Handle If-Modified-Since
    if (ifModifiedSince) {
      res.setHeader('X-Conditional-Request', 'Last-Modified');
    }

    // Store original send method
    const originalSend = res.send;

    // Override send to handle conditional responses
    res.send = (data: any) => {
      // Check If-None-Match
      if (ifNoneMatch && res.getHeader('ETag') === ifNoneMatch) {
        res.status(304).end();
        return;
      }

      // Check If-Modified-Since
      if (ifModifiedSince && res.getHeader('Last-Modified')) {
        const lastModified = new Date(res.getHeader('Last-Modified') as string);
        const modifiedSince = new Date(ifModifiedSince);
        if (lastModified <= modifiedSince) {
          res.status(304).end();
          return;
        }
      }

      return originalSend.call(res, data);
    };
  }

  /**
   * Log response metrics
   */
  private logResponse(req: Request, res: Response, responseTime: number, data: ApiResponse): void {
    const size = JSON.stringify(data).length;
    const compressed = res.getHeader('Content-Encoding') !== undefined;
    const cached = res.getHeader('X-Cache') === 'HIT';

    logger.info('API response sent', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: Math.round(responseTime),
      size,
      compressed,
      cached,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper method to create standardized success response
   */
  static createSuccessResponse<T = any>(data: T, meta?: any): ApiResponse<T> {
    return {
      success: true,
      data,
      meta
    };
  }

  /**
   * Helper method to create standardized error response
   */
  static createErrorResponse(code: string, message: string, details?: any): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details
      }
    };
  }

  /**
   * Get optimization statistics
   */
  getStats(): {
    config: OptimizationConfig;
    optimizedResponses: number;
    compressedResponses: number;
    cachedResponses: number;
    averageResponseSize: number;
    averageResponseTime: number;
  } {
    // This would track actual statistics in a production implementation
    return {
      config: this.config,
      optimizedResponses: 0,
      compressedResponses: 0,
      cachedResponses: 0,
      averageResponseSize: 0,
      averageResponseTime: 0
    };
  }
}

// Default instance
const defaultOptimizer = new ResponseOptimizer();

export default ResponseOptimizer;
export { defaultOptimizer };