// Base interfaces and types for refactored components

export interface VerificationRule {
  name: string;
  execute(content: string, context?: Record<string, any>): Promise<RuleResult>;
}

export interface RuleResult {
  score: number;
  issues: VerificationIssue[];
  suggestions: string[];
  metrics: Record<string, number>;
}

export interface VerificationIssue {
  type: string;
  severity: IssueSeverity;
  message: string;
  line?: number;
  column?: number;
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  lastPing: Date;
  role?: string;
  permissions: string[];
}

export interface WebSocketMessage {
  type: string;
  id: string;
  payload: any;
  timestamp: Date;
  sessionId?: string;
  userId?: string;
}