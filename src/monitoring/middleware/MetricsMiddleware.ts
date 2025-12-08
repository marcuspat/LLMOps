import { Request, Response, NextFunction } from 'express';
import ApplicationMetrics from './ApplicationMetrics';

class MetricsMiddleware {
  private metrics: ApplicationMetrics;

  constructor(metrics: ApplicationMetrics) {
    this.metrics = metrics;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();

      // Get request size
      let requestSize = 0;
      if (req.headers['content-length']) {
        requestSize = parseInt(req.headers['content-length'], 10);
      }

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      let responseSize = 0;

      res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
        // Calculate response size
        if (chunk) {
          responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
        }

        // Record metrics
        const duration = Date.now() - startTime;
        const route = req.route ? req.route.path : req.path || 'unknown';

        this.metrics.recordHttpRequest(
          req.method,
          route,
          res.statusCode,
          duration,
          requestSize,
          responseSize,
          process.env.HOSTNAME || 'unknown'
        );

        // Call original end
        return originalEnd.call(this, chunk, encoding, cb);
      }.bind(res);

      next();
    };
  }
}

export default MetricsMiddleware;