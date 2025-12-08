import { BaseComponent, BaseVerificationRule, BaseAPIService, BaseWebSocketHandler } from '../../src/shared/base-classes.js';
import { VerificationIssue, IssueSeverity } from '../../src/shared/interfaces.js';

// Mock implementations for testing
class MockComponent extends BaseComponent {
  testMethod() {
    this.emitEvent('test_event', { data: 'test' });
    this.handleError(new Error('test error'), 'test context');
  }
}

class MockVerificationRule extends BaseVerificationRule {
  name = 'test_rule';

  async execute(content: string): Promise<any> {
    if (content.includes('error')) {
      throw new Error('Test error');
    }

    const issues = content.includes('issue') ? [this.createIssue('test_issue', IssueSeverity.LOW, 'Test issue')] : [];
    return { score: this.calculateBaseScore(issues), issues, suggestions: [], metrics: {} };
  }
}

class MockAPIService extends BaseAPIService {
  async testOperation() {
    return this.handleRequest(
      async () => ({ result: 'success' }),
      'TEST_ERROR',
      'Test operation failed'
    );
  }
}

class MockWebSocketHandler extends BaseWebSocketHandler {
  private messages: Map<string, any> = new Map();

  protected sendMessage(clientId: string, message: any): void {
    this.messages.set(clientId, message);
  }

  protected sendError(clientId: string, error: string): void {
    this.sendMessage(clientId, { type: 'error', payload: { error } });
  }

  getLastMessage(clientId: string) {
    return this.messages.get(clientId);
  }

  clearMessages() {
    this.messages.clear();
  }
}

describe('BaseClasses', () => {
  describe('BaseComponent', () => {
    let component: MockComponent;

    beforeEach(() => {
      component = new MockComponent();
    });

    test('should emit events correctly', (done) => {
      component.on('test_event', (event) => {
        expect(event.source).toBe('MockComponent');
        expect(event.data).toEqual({ data: 'test' });
        expect(event.timestamp).toBeInstanceOf(Date);
        done();
      });

      component.testMethod();
    });

    test('should handle errors correctly', (done) => {
      component.on('error', (event) => {
        expect(event.source).toBe('MockComponent');
        expect(event.context).toBe('test context');
        expect(event.error).toBeInstanceOf(Error);
        expect(event.error.message).toBe('test error');
        done();
      });

      component.testMethod();
    });
  });

  describe('BaseVerificationRule', () => {
    let rule: MockVerificationRule;

    beforeEach(() => {
      rule = new MockVerificationRule();
    });

    test('should execute rule successfully', async () => {
      const result = await rule.execute('clean content');

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('metrics');
      expect(result.score).toBe(1); // No issues
      expect(result.issues).toHaveLength(0);
    });

    test('should detect issues in content', async () => {
      const result = await rule.execute('content with issue');

      expect(result.score).toBeLessThan(1);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('test_issue');
      expect(result.issues[0].severity).toBe(IssueSeverity.LOW);
    });

    test('should handle execution errors', async () => {
      const result = await rule.execute('content with error');

      expect(result.score).toBeLessThan(1);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('rule_execution_error');
    });

    test('should calculate base score correctly', () => {
      const issues = [
        { type: 'test1', severity: IssueSeverity.LOW, message: 'Low issue' },
        { type: 'test2', severity: IssueSeverity.HIGH, message: 'High issue' },
        { type: 'test3', severity: IssueSeverity.CRITICAL, message: 'Critical issue' }
      ];

      // CRITICAL(0.3) + HIGH(0.2) + LOW(0.05) = 0.55 reduction
      const score = rule['calculateBaseScore'](issues);
      expect(score).toBeCloseTo(0.45, 2);
    });
  });

  describe('BaseAPIService', () => {
    let service: MockAPIService;

    beforeEach(() => {
      service = new MockAPIService();
    });

    test('should handle successful request', async () => {
      const result = await service.testOperation();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success' });
    });

    test('should handle failed request', async () => {
      // Override testOperation to throw an error
      service = new MockAPIService();
      const result = await service['handleRequest'](
        async () => { throw new Error('Test error'); },
        'TEST_ERROR',
        'Test operation failed'
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('TEST_ERROR');
      expect(result.error.message).toBe('Test error');
    });

    test('should create success response correctly', () => {
      const response = service['createSuccessResponse']({ data: 'test' });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ data: 'test' });
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    test('should create error response correctly', () => {
      const response = service['createErrorResponse']('TEST_CODE', 'Test message');

      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TEST_CODE');
      expect(response.error.message).toBe('Test message');
      expect(response.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('BaseWebSocketHandler', () => {
    let handler: MockWebSocketHandler;

    beforeEach(() => {
      handler = new MockWebSocketHandler();
    });

    test('should validate message correctly', () => {
      expect(handler['validateMessage']({ type: 'test' }, 'client1')).toBe(true);
    });

    test('should reject invalid message format', () => {
      const result = handler['validateMessage']('not an object', 'client1');
      expect(result).toBe(false);

      const lastMessage = handler.getLastMessage('client1');
      expect(lastMessage.type).toBe('error');
      expect(lastMessage.payload.error).toBe('Invalid message format');
    });

    test('should reject message without type', () => {
      const result = handler['validateMessage']({ data: 'test' }, 'client1');
      expect(result).toBe(false);

      const lastMessage = handler.getLastMessage('client1');
      expect(lastMessage.type).toBe('error');
      expect(lastMessage.payload.error).toBe('Message type is required');
    });

    test('should send message correctly', () => {
      const message = { type: 'test', payload: { data: 'test' } };
      handler.sendMessage('client1', message);

      const lastMessage = handler.getLastMessage('client1');
      expect(lastMessage).toEqual(message);
    });

    test('should send error correctly', () => {
      handler.sendError('client1', 'Test error');

      const lastMessage = handler.getLastMessage('client1');
      expect(lastMessage.type).toBe('error');
      expect(lastMessage.payload.error).toBe('Test error');
    });
  });
});