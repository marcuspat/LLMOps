import { initTracer, JaegerTracer, Span, SpanContext, Tags, FORMAT_HTTP_HEADERS, opentracing } from 'jaeger-client';

class DistributedTracer {
  private tracer: JaegerTracer;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.tracer = this.initializeTracer();
  }

  private initializeTracer(): JaegerTracer {
    const config = {
      serviceName: this.serviceName,
      sampler: {
        type: 'const',
        param: 1, // Sample all traces in production
      },
      reporter: {
        logSpans: true,
        agentHost: process.env.JAEGER_AGENT_HOST || 'jaeger',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6831'),
        collectorEndpoint: process.env.JAEGER_COLLECTOR_ENDPOINT || 'http://jaeger:14268/api/traces',
      },
    };

    const options = {
      logger: {
        info: (msg: string) => console.log(`INFO ${msg}`),
        error: (msg: string) => console.error(`ERROR ${msg}`),
      },
    };

    return initTracer(config, options);
  }

  // Start a new span
  startSpan(operationName: string, childOf?: Span | SpanContext | string): Span {
    const spanOptions: any = {
      tags: {
        [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_SERVER,
        [Tags.COMPONENT]: this.serviceName,
      },
    };

    if (childOf) {
      spanOptions.childOf = childOf;
    }

    return this.tracer.startSpan(operationName, spanOptions);
  }

  // Extract context from HTTP headers
  extractSpanContext(headers: any): SpanContext | null {
    try {
      return this.tracer.extract(FORMAT_HTTP_HEADERS, headers);
    } catch (error) {
      console.error('Error extracting span context:', error);
      return null;
    }
  }

  // Inject span context into HTTP headers
  injectSpanContext(span: Span, headers: any): void {
    this.tracer.inject(span, FORMAT_HTTP_HEADERS, headers);
  }

  // Create a span for HTTP requests
  startHttpSpan(req: any, operationName?: string): Span {
    const headers = req.headers || {};
    const parentContext = this.extractSpanContext(headers);

    const span = this.startSpan(
      operationName || `${req.method} ${req.path}`,
      parentContext
    );

    // Add standard HTTP tags
    span.setTag(Tags.HTTP_METHOD, req.method);
    span.setTag(Tags.HTTP_URL, req.url);
    span.setTag(Tags.SPAN_KIND, Tags.SPAN_KIND_RPC_SERVER);

    // Add user info if available
    if (req.user) {
      span.setTag('user.id', req.user.id);
      span.setTag('user.role', req.user.role);
    }

    return span;
  }

  // Finish HTTP span with response
  finishHttpSpan(span: Span, res: any, error?: Error): void {
    // Add response tags
    span.setTag(Tags.HTTP_STATUS_CODE, res.statusCode);

    if (error) {
      span.setTag(Tags.ERROR, true);
      span.log({
        event: 'error',
        message: error.message,
        stack: error.stack,
      });
    } else if (res.statusCode >= 500) {
      span.setTag(Tags.ERROR, true);
    }

    span.finish();
  }

  // Middleware for Express
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const span = this.startHttpSpan(req);

      // Add span to request for later use
      req.span = span;

      // Override res.end to finish the span
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        finishHttpSpan(span, res);
        originalEnd.apply(this, args);
      };

      next();
    };
  }

  // Trace function execution
  traceFunction<T, R>(
    operationName: string,
    fn: (span: Span, ...args: T[]) => Promise<R>,
    parentSpan?: Span
  ): (...args: T[]) => Promise<R> {
    return async (...args: T[]): Promise<R> => {
      const span = parentSpan ?
        this.tracer.startSpan(operationName, { childOf: parentSpan }) :
        this.startSpan(operationName);

      try {
        const result = await fn(span, ...args);
        span.setTag(Tags.ERROR, false);
        return result;
      } catch (error) {
        span.setTag(Tags.ERROR, true);
        span.log({
          event: 'error',
          'error.object': error,
          message: error.message,
          stack: error.stack,
        });
        throw error;
      } finally {
        span.finish();
      }
    };
  }

  // Add custom tags to active span
  addTag(key: string, value: any): void {
    const span = opentracing.globalTracer().activeSpan();
    if (span) {
      span.setTag(key, value);
    }
  }

  // Log event to active span
  logEvent(event: string, payload?: any): void {
    const span = opentracing.globalTracer().activeSpan();
    if (span) {
      span.log({
        event,
        ...payload,
      });
    }
  }

  // Get tracer for manual operations
  getTracer(): JaegerTracer {
    return this.tracer;
  }

  // Close tracer (for graceful shutdown)
  close(): void {
    this.tracer.close((err: any) => {
      if (err) {
        console.error('Error closing tracer:', err);
      } else {
        console.log('Tracer closed successfully');
      }
    });
  }
}

export default DistributedTracer;