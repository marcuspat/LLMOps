import { EventEmitter } from 'events';
import { VerificationRule, RuleResult, VerificationIssue, IssueSeverity } from './interfaces.js';

export abstract class BaseComponent extends EventEmitter {
  protected logger: Console;
  protected config: Record<string, any>;

  constructor(config: Record<string, any> = {}, logger: Console = console) {
    super();
    this.config = config;
    this.logger = logger;
  }

  protected handleError(error: Error, context: string): void {
    this.logger.error(`[${this.constructor.name}] ${context}:`, error);
    this.emit('error', { error, context, timestamp: new Date() });
  }

  protected emitEvent(type: string, data: any): void {
    this.emit(type, {
      ...data,
      source: this.constructor.name,
      timestamp: new Date()
    });
  }
}

export abstract class BaseVerificationRule extends BaseComponent implements VerificationRule {
  abstract name: string;
  abstract execute(content: string, context?: Record<string, any>): Promise<RuleResult>;

  protected createIssue(type: string, severity: IssueSeverity, message: string, line?: number, column?: number): VerificationIssue {
    return { type, severity, message, line, column };
  }

  protected calculateBaseScore(issues: VerificationIssue[]): number {
    const criticalWeight = 0.3;
    const highWeight = 0.2;
    const mediumWeight = 0.1;
    const lowWeight = 0.05;

    let scoreReduction = 0;
    issues.forEach(issue => {
      switch (issue.severity) {
        case IssueSeverity.CRITICAL:
          scoreReduction += criticalWeight;
          break;
        case IssueSeverity.HIGH:
          scoreReduction += highWeight;
          break;
        case IssueSeverity.MEDIUM:
          scoreReduction += mediumWeight;
          break;
        case IssueSeverity.LOW:
          scoreReduction += lowWeight;
          break;
      }
    });

    return Math.max(0, 1 - scoreReduction);
  }
}

export abstract class BaseAPIService extends BaseComponent {
  protected createSuccessResponse<T>(data: T) {
    return {
      success: true,
      data,
      timestamp: new Date()
    };
  }

  protected createErrorResponse(code: string, message: string, details?: any) {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      timestamp: new Date()
    };
  }

  protected async handleRequest<T>(
    operation: () => Promise<T>,
    errorCode: string,
    errorMessage: string
  ): Promise<{ success: boolean; data?: T; error?: any }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      this.handleError(error as Error, errorMessage);
      return {
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : errorMessage,
          details: error
        }
      };
    }
  }
}

export abstract class BaseWebSocketHandler extends BaseComponent {
  protected validateMessage(message: any, clientId: string): boolean {
    if (!message || typeof message !== 'object') {
      this.sendError(clientId, 'Invalid message format');
      return false;
    }

    if (!message.type) {
      this.sendError(clientId, 'Message type is required');
      return false;
    }

    return true;
  }

  protected abstract sendMessage(clientId: string, message: any): void;
  protected abstract sendError(clientId: string, error: string): void;
}