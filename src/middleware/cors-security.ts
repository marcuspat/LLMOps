/**
 * Secure CORS Configuration Middleware
 * Implements proper Cross-Origin Resource Sharing policies
 */

import { Request, Response, NextFunction } from 'express';
import { cors, CorsOptions } from 'cors';
import { config } from '../config/index.js';

/**
 * Validates origin URL to prevent malicious origins
 */
export const validateOrigin = (origin: string | undefined): boolean => {
  if (!origin) {
    return false; // Require explicit origin
  }

  try {
    const originUrl = new URL(origin);

    // In production, only allow specific origins
    if (config.environment === 'production') {
      const allowedOrigins = config.cors.origins;
      return allowedOrigins.includes(origin);
    }

    // In development, allow localhost with port restrictions
    if (config.environment === 'development') {
      return originUrl.hostname === 'localhost' ||
             originUrl.hostname === '127.0.0.1' ||
             originUrl.hostname === '0.0.0.0';
    }

    // In staging, allow specific test domains
    if (config.environment === 'staging') {
      const stagingDomains = [
        'staging.turboflow.com',
        'test.turboflow.com',
        'preview.turboflow.com'
      ];
      return stagingDomains.some(domain => originUrl.hostname === domain);
    }

    return false;
  } catch (error) {
    console.error('Origin validation error:', error);
    return false;
  }
};

/**
 * Dynamic CORS options based on environment
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Handle preflight requests without origin
    if (!origin) {
      return callback(null, false);
    }

    // Validate origin
    if (validateOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked origin ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Client-Version',
    'X-Request-ID',
    'Cache-Control',
    'Pragma'
  ],

  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Request-ID',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],

  credentials: true, // Only for same-origin or explicitly allowed origins

  maxAge: 86400, // 24 hours for preflight cache

  preflightContinue: false,

  optionsSuccessStatus: 204
};

/**
 * Enhanced CORS middleware with additional security checks
 */
export const secureCors = (req: Request, res: Response, next: NextFunction): void => {
  // Apply CORS with security options
  cors(corsOptions)(req, res, (error) => {
    if (error) {
      console.error('CORS error:', error);
      return res.status(403).json({
        success: false,
        error: {
          code: 'CORS_ERROR',
          message: 'Cross-origin request blocked',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Additional security headers for CORS
    const origin = req.headers.origin;

    if (origin) {
      // Set Vary header for proper caching
      res.setHeader('Vary', 'Origin');

      // Additional security for cross-origin requests
      if (config.environment === 'production') {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      }
    }

    // Validate Referer header for additional security
    const referer = req.headers.referer;
    if (referer && origin) {
      try {
        const refererUrl = new URL(referer);
        const originUrl = new URL(origin);

        if (refererUrl.hostname !== originUrl.hostname) {
          console.warn(`CORS: Referer mismatch - Origin: ${origin}, Referer: ${referer}`);
          res.status(403).json({
            success: false,
            error: {
              code: 'REFERER_MISMATCH',
              message: 'Referer header does not match origin',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }
      } catch (error) {
        console.error('Referer validation error:', error);
        // Don't block request on invalid referer, but log it
      }
    }

    // Validate User-Agent for known malicious patterns
    const userAgent = req.headers['user-agent'];
    if (userAgent) {
      const maliciousPatterns = [
        /bot/i,
        /crawler/i,
        /scanner/i,
        /sqlmap/i,
        /nmap/i,
        /curl/i,
        /wget/i,
        /python/i,
        /java/i
      ];

      // Allow known bots for health checks but monitor them
      if (maliciousPatterns.some(pattern => pattern.test(userAgent)) &&
          !userAgent.includes('health-check')) {
        console.warn(`Suspicious User-Agent: ${userAgent} from ${req.ip}`);

        // In production, block suspicious user agents
        if (config.environment === 'production') {
          res.status(403).json({
            success: false,
            error: {
              code: 'SUSPICIOUS_USER_AGENT',
              message: 'Request blocked due to suspicious user agent',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }
      }
    }

    next();
  });
};

/**
 * Strict CORS configuration for API routes
 */
export const strictCorsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Only allow specific origins for API routes
    const allowedAPIOrigins = [
      'https://turboflow.com',
      'https://app.turboflow.com',
      'https://dashboard.turboflow.com'
    ];

    if (config.environment === 'development') {
      // Allow localhost in development with specific ports
      if (origin && origin.match(/^https?:\/\/localhost:(3000|3001|8080)$/)) {
        return callback(null, true);
      }
    }

    if (origin && allowedAPIOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by API CORS policy'), false);
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],

  credentials: true,

  maxAge: 3600, // Shorter cache for API routes

  preflightContinue: false
};

/**
 * CORS middleware specifically for API routes
 */
export const apiCors = cors(strictCorsOptions);

/**
 * CORS middleware for WebSocket connections
 */
export const webSocketCors = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;

  // Validate WebSocket origin more strictly
  if (!origin) {
    res.status(403).json({
      success: false,
      error: {
        code: 'WEBSOCKET_ORIGIN_REQUIRED',
        message: 'WebSocket connections require explicit origin',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  if (!validateOrigin(origin)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'WEBSOCKET_ORIGIN_BLOCKED',
        message: 'WebSocket connection from this origin is not allowed',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Set WebSocket-specific headers
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  next();
};

/**
 * CORS middleware for public endpoints (less restrictive)
 */
export const publicCorsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow more origins for public endpoints but still validate
    if (!origin) {
      return callback(null, false);
    }

    try {
      const originUrl = new URL(origin);

      // Block private networks and internal IPs
      const privateNetworks = [
        '127.0.0.1',
        'localhost',
        '10.0.0.0',
        '172.16.0.0',
        '192.168.0.0'
      ];

      const isPrivateNetwork = privateNetworks.some(network =>
        originUrl.hostname.startsWith(network)
      );

      if (isPrivateNetwork && config.environment === 'production') {
        return callback(new Error('Private network access not allowed'), false);
      }

      // Allow requests from public domains with validation
      if (originUrl.protocol === 'https:' ||
          (config.environment !== 'production' && originUrl.protocol === 'http:')) {
        return callback(null, true);
      }

      return callback(new Error('Invalid protocol or network'), false);
    } catch (error) {
      callback(error, false);
    }
  },

  methods: ['GET', 'HEAD', 'OPTIONS'], // Only safe methods for public endpoints

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept'
  ],

  credentials: false, // No credentials for public endpoints

  maxAge: 3600
};

/**
 * CORS middleware for public routes
 */
export const publicCors = cors(publicCorsOptions);