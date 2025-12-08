import { TurboFlowServer } from '../../src/api/TurboFlowServer.js';
import request from 'supertest';
import WebSocket from 'ws';

describe('TurboFlowServer', () => {
  let server: TurboFlowServer;
  const testPort = 3001;

  beforeEach(async () => {
    server = new TurboFlowServer({
      port: testPort,
      enableWebSocket: false, // Disable WebSocket for API tests
      enableSecurity: false,   // Disable security for easier testing
      enableLogging: false     // Disable logging for cleaner test output
    });
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
  });

  describe('Server Lifecycle', () => {
    test('should start and stop server successfully', async () => {
      await expect(server.start()).resolves.not.toThrow();
      expect(server.isRunning()).toBe(true);
      expect(server.getPort()).toBe(testPort);

      await expect(server.stop()).resolves.not.toThrow();
      expect(server.isRunning()).toBe(false);
    });

    test('should handle multiple start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await server.start();
        expect(server.isRunning()).toBe(true);
        await server.stop();
        expect(server.isRunning()).toBe(false);
      }
    });
  });

  describe('Health Check Endpoint', () => {
    beforeEach(async () => {
      await server.start();
    });

    test('should return health status', async () => {
      const response = await request(server.getApp())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await server.start();
    });

    test('should handle 404 for unknown routes', async () => {
      const response = await request(server.getApp())
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    test('should handle malformed requests', async () => {
      const response = await request(server.getApp())
        .post('/api/truth/verify')
        .send('invalid-json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Core Systems Access', () => {
    test('should provide access to core systems', () => {
      const coreSystems = server.getCoreSystems();

      expect(coreSystems).toHaveProperty('truthVerification');
      expect(coreSystems).toHaveProperty('agentCoordination');
      expect(coreSystems).toHaveProperty('githubIntegration');
      expect(coreSystems).toHaveProperty('securityScanning');
      expect(coreSystems).toHaveProperty('performanceMonitoring');
    });

    test('should provide access to Express app', () => {
      const app = server.getApp();
      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
      expect(typeof app.get).toBe('function');
      expect(typeof app.post).toBe('function');
    });
  });

  describe('Configuration', () => {
    test('should accept custom configuration', () => {
      const customServer = new TurboFlowServer({
        port: 3002,
        enableWebSocket: false,
        enableSecurity: false,
        enableLogging: false
      });

      expect(customServer.getPort()).toBe(3002);
      expect(customServer.getWebSocketManager()).toBeUndefined();
    });
  });

  describe('Event Emission', () => {
    test('should emit server events', async () => {
      let startEventEmitted = false;
      let stopEventEmitted = false;

      server.on('server_started', () => {
        startEventEmitted = true;
      });

      server.on('server_stopped', () => {
        stopEventEmitted = true;
      });

      await server.start();
      expect(startEventEmitted).toBe(true);

      await server.stop();
      expect(stopEventEmitted).toBe(true);
    });
  });

  describe('WebSocket Manager', () => {
    test('should create WebSocket manager when enabled', () => {
      const wsServer = new TurboFlowServer({
        port: testPort,
        enableWebSocket: true,
        enableSecurity: false,
        enableLogging: false
      });

      expect(wsServer.getWebSocketManager()).toBeDefined();
    });

    test('should not create WebSocket manager when disabled', () => {
      const noWsServer = new TurboFlowServer({
        port: testPort,
        enableWebSocket: false,
        enableSecurity: false,
        enableLogging: false
      });

      expect(noWsServer.getWebSocketManager()).toBeUndefined();
    });
  });
});