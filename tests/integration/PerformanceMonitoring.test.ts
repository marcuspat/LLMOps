import { PerformanceMonitoring } from '../../src/core/PerformanceMonitoring.js';
import { MessageType } from '../../src/types/index.js';

// Mock console methods to reduce test noise
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();
jest.spyOn(console, 'warn').mockImplementation();

// Mock fetch for network benchmarks
global.fetch = jest.fn();

describe('PerformanceMonitoring - Comprehensive Performance Tests', () => {
  let performanceMonitoring: PerformanceMonitoring;

  beforeEach(() => {
    // Reset singleton instance for each test
    (PerformanceMonitoring as any).instance = null;
    performanceMonitoring = PerformanceMonitoring.getInstance();
  });

  afterEach(() => {
    // Clean up any monitoring intervals
    performanceMonitoring.stopMonitoring();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PerformanceMonitoring.getInstance();
      const instance2 = PerformanceMonitoring.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance when none exists', () => {
      const instance = PerformanceMonitoring.getInstance();

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(PerformanceMonitoring);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring with default interval', () => {
      const startSpy = jest.fn();
      performanceMonitoring.on('monitoringStarted', startSpy);

      performanceMonitoring.startMonitoring();

      expect(startSpy).toHaveBeenCalledWith({ interval: 5000 });
      expect(performanceMonitoring['monitoringActive']).toBe(true);
      expect(performanceMonitoring['collectionInterval']).toBeDefined();
    });

    it('should start monitoring with custom interval', () => {
      performanceMonitoring.startMonitoring(2000);

      expect(performanceMonitoring['monitoringActive']).toBe(true);
    });

    it('should not start monitoring if already active', () => {
      performanceMonitoring.startMonitoring();
      const consoleSpy = jest.spyOn(console, 'log');

      performanceMonitoring.startMonitoring();

      expect(consoleSpy).toHaveBeenCalledWith('Performance monitoring already active');
    });

    it('should stop monitoring successfully', () => {
      performanceMonitoring.startMonitoring();
      const stopSpy = jest.fn();
      performanceMonitoring.on('monitoringStopped', stopSpy);

      performanceMonitoring.stopMonitoring();

      expect(stopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date)
        })
      );
      expect(performanceMonitoring['monitoringActive']).toBe(false);
      expect(performanceMonitoring['collectionInterval']).toBeNull();
    });

    it('should handle stopping when monitoring is not active', () => {
      // Should not throw error when stopping inactive monitoring
      expect(() => performanceMonitoring.stopMonitoring()).not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect system metrics successfully', async () => {
      const metrics = await performanceMonitoring.collectMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.cpu).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.network).toBeDefined();
      expect(metrics.custom).toBeDefined();

      expect(typeof metrics.cpu.usage).toBe('number');
      expect(typeof metrics.memory.percentage).toBe('number');
      expect(typeof metrics.network.bytesIn).toBe('number');
    });

    it('should store metrics in history', async () => {
      const initialCount = performanceMonitoring['metrics'].length;

      await performanceMonitoring.collectMetrics();

      expect(performanceMonitoring['metrics'].length).toBe(initialCount + 1);
    });

    it('should limit metrics history to prevent memory issues', async () => {
      const originalMaxSize = 1000;

      // Simulate having max metrics
      performanceMonitoring['metrics'] = Array(originalMaxSize).fill(null).map((_, i) => ({
        timestamp: new Date(Date.now() - i * 1000),
        cpu: { usage: 50, loadAverage: [1, 1, 1], cores: 4 },
        memory: { used: 4000, free: 4000, total: 8000, percentage: 50 },
        network: { bytesIn: 1000, bytesOut: 1000, packetsIn: 100, packetsOut: 100 },
        custom: {}
      }));

      await performanceMonitoring.collectMetrics();

      expect(performanceMonitoring['metrics'].length).toBe(originalMaxSize);
    });

    it('should emit metricsCollected event', async () => {
      const eventSpy = jest.fn();
      performanceMonitoring.on('metricsCollected', eventSpy);

      await performanceMonitoring.collectMetrics();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.PERFORMANCE_UPDATE,
          payload: expect.objectContaining({
            timestamp: expect.any(Date),
            cpu: expect.any(Object),
            memory: expect.any(Object)
          })
        })
      );
    });

    it('should check performance alerts after collecting metrics', async () => {
      const alertSpy = jest.fn();
      performanceMonitoring.on('performanceAlert', alertSpy);

      await performanceMonitoring.collectMetrics();

      // Check that alert checking was attempted
      expect(performanceMonitoring['alerts']).toBeDefined();
    });
  });

  describe('Agent Performance Tracking', () => {
    it('should register agent for performance tracking', () => {
      const eventSpy = jest.fn();
      performanceMonitoring.on('agentRegistered', eventSpy);

      performanceMonitoring.registerAgent('agent-123', 'Test Agent');

      expect(eventSpy).toHaveBeenCalledWith({
        agentId: 'agent-123',
        agentName: 'Test Agent'
      });

      const agentData = performanceMonitoring['agentMetrics'].get('agent-123');
      expect(agentData).toBeDefined();
      expect(agentData!.agentId).toBe('agent-123');
      expect(agentData!.agentName).toBe('Test Agent');
      expect(agentData!.metrics).toEqual([]);
      expect(agentData!.taskHistory).toEqual([]);
    });

    it('should update agent metrics', () => {
      performanceMonitoring.registerAgent('agent-123', 'Test Agent');

      const agentMetrics = {
        responseTime: 150,
        successRate: 0.95,
        resourceUsage: { cpu: 25, memory: 512 },
        tasksCompleted: 10
      };

      const eventSpy = jest.fn();
      performanceMonitoring.on('agentMetricsUpdated', eventSpy);

      performanceMonitoring.updateAgentMetrics('agent-123', agentMetrics);

      const agentData = performanceMonitoring['agentMetrics'].get('agent-123');
      expect(agentData!.metrics).toHaveLength(1);
      expect(agentData!.metrics[0]).toMatchObject(agentMetrics);
      expect(agentData!.metrics[0].timestamp).toBeInstanceOf(Date);

      expect(eventSpy).toHaveBeenCalledWith({
        agentId: 'agent-123',
        metrics: expect.any(Object)
      });
    });

    it('should handle updating metrics for unregistered agent', () => {
      const warnSpy = jest.spyOn(console, 'warn');

      performanceMonitoring.updateAgentMetrics('unregistered-agent', {
        responseTime: 100,
        successRate: 1.0
      });

      expect(warnSpy).toHaveBeenCalledWith(
        'Agent unregistered-agent not registered for performance tracking'
      );
    });

    it('should limit agent metrics history', () => {
      performanceMonitoring.registerAgent('agent-123', 'Test Agent');

      // Add more than the limit (100)
      for (let i = 0; i < 150; i++) {
        performanceMonitoring.updateAgentMetrics('agent-123', {
          responseTime: i,
          successRate: 1.0
        });
      }

      const agentData = performanceMonitoring['agentMetrics'].get('agent-123');
      expect(agentData!.metrics.length).toBe(100);
    });

    it('should record task execution', () => {
      performanceMonitoring.registerAgent('agent-123', 'Test Agent');

      const eventSpy = jest.fn();
      performanceMonitoring.on('taskExecutionRecorded', eventSpy);

      performanceMonitoring.recordTaskExecution(
        'agent-123',
        'task-456',
        2000,
        true,
        { cpu: 30, memory: 1024 }
      );

      const agentData = performanceMonitoring['agentMetrics'].get('agent-123');
      expect(agentData!.taskHistory).toHaveLength(1);

      const taskRecord = agentData!.taskHistory[0];
      expect(taskRecord.taskId).toBe('task-456');
      expect(taskRecord.duration).toBe(2000);
      expect(taskRecord.success).toBe(true);
      expect(taskRecord.resourceUsage).toEqual({ cpu: 30, memory: 1024 });

      expect(eventSpy).toHaveBeenCalledWith({
        agentId: 'agent-123',
        taskRecord: expect.any(Object)
      });
    });

    it('should limit task history', () => {
      performanceMonitoring.registerAgent('agent-123', 'Test Agent');

      // Add more than the limit (50)
      for (let i = 0; i < 75; i++) {
        performanceMonitoring.recordTaskExecution(
          'agent-123',
          `task-${i}`,
          1000,
          i % 2 === 0
        );
      }

      const agentData = performanceMonitoring['agentMetrics'].get('agent-123');
      expect(agentData!.taskHistory.length).toBe(50);
    });

    it('should update calculated metrics after task execution', () => {
      performanceMonitoring.registerAgent('agent-123', 'Test Agent');

      // Record some tasks
      performanceMonitoring.recordTaskExecution('agent-123', 'task-1', 1000, true);
      performanceMonitoring.recordTaskExecution('agent-123', 'task-2', 2000, false);
      performanceMonitoring.recordTaskExecution('agent-123', 'task-3', 3000, true);

      const agentData = performanceMonitoring['agentMetrics'].get('agent-123');

      expect(agentData!.averageResponseTime).toBeCloseTo(2000, 1); // (1000 + 2000 + 3000) / 3
      expect(agentData!.successRate).toBeCloseTo(0.667, 2); // 2/3 success rate
    });
  });

  describe('Custom Metrics', () => {
    it('should add custom metric', () => {
      const eventSpy = jest.fn();
      performanceMonitoring.on('customMetricAdded', eventSpy);

      performanceMonitoring.addCustomMetric('custom.counter', 42, { tag: 'test' });

      const metrics = performanceMonitoring['customMetrics'].get('custom.counter');
      expect(metrics).toHaveLength(1);

      const metric = metrics[0];
      expect(metric.name).toBe('custom.counter');
      expect(metric.value).toBe(42);
      expect(metric.tags).toEqual({ tag: 'test' });
      expect(metric.timestamp).toBeInstanceOf(Date);

      expect(eventSpy).toHaveBeenCalledWith({
        name: 'custom.counter',
        metric: expect.any(Object)
      });
    });

    it('should limit custom metrics history', () => {
      // Add more than the limit (500)
      for (let i = 0; i < 600; i++) {
        performanceMonitoring.addCustomMetric('test.metric', i);
      }

      const metrics = performanceMonitoring['customMetrics'].get('test.metric');
      expect(metrics.length).toBe(500);

      // Should keep the most recent values
      expect(metrics[0].value).toBeGreaterThan(99); // First value after cleanup
      expect(metrics[metrics.length - 1].value).toBe(599);
    });

    it('should retrieve custom metrics', () => {
      performanceMonitoring.addCustomMetric('metric1', 100);
      performanceMonitoring.addCustomMetric('metric2', 200);
      performanceMonitoring.addCustomMetric('metric1', 150);

      const allMetrics = performanceMonitoring.getCustomMetrics();
      expect(allMetrics.size).toBe(2);

      const metric1Data = performanceMonitoring.getCustomMetrics('metric1');
      expect(metric1Data).toHaveLength(2);
      expect(metric1Data[0].value).toBe(100);
      expect(metric1Data[1].value).toBe(150);

      const metric2Data = performanceMonitoring.getCustomMetrics('metric2');
      expect(metric2Data).toHaveLength(1);
      expect(metric2Data[0].value).toBe(200);
    });

    it('should return empty array for non-existent metric', () => {
      const metrics = performanceMonitoring.getCustomMetrics('nonexistent');
      expect(metrics).toEqual([]);
    });
  });

  describe('Metrics Retrieval', () => {
    beforeEach(async () => {
      // Add some test metrics
      await performanceMonitoring.collectMetrics();
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await performanceMonitoring.collectMetrics();
      await new Promise(resolve => setTimeout(resolve, 10));
      await performanceMonitoring.collectMetrics();
    });

    it('should return all metrics when no time range specified', () => {
      const metrics = performanceMonitoring.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should filter metrics by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const timeRange = {
        start: oneHourAgo,
        end: now
      };

      const filteredMetrics = performanceMonitoring.getMetrics(timeRange);

      filteredMetrics.forEach(metric => {
        expect(metric.timestamp.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        expect(metric.timestamp.getTime()).toBeLessThanOrEqual(now.getTime());
      });
    });

    it('should return empty array when no metrics in time range', () => {
      const futureTimeRange = {
        start: new Date(Date.now() + 60 * 60 * 1000),
        end: new Date(Date.now() + 2 * 60 * 60 * 1000)
      };

      const filteredMetrics = performanceMonitoring.getMetrics(futureTimeRange);
      expect(filteredMetrics).toEqual([]);
    });
  });

  describe('Alert System', () => {
    it('should return all alerts by default', () => {
      const alerts = performanceMonitoring.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should filter alerts by severity', () => {
      const alerts = performanceMonitoring.getAlerts('high');
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should generate CPU alerts when usage exceeds threshold', async () => {
      // Mock high CPU usage
      jest.spyOn(performanceMonitoring as any, 'getCpuMetrics').mockResolvedValue({
        usage: 90, // Above default threshold of 80
        loadAverage: [1.5, 1.6, 1.7],
        cores: 4
      });

      const alertSpy = jest.fn();
      performanceMonitoring.on('performanceAlert', alertSpy);

      await performanceMonitoring.collectMetrics();

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cpu_high',
          severity: expect.any(String),
          message: expect.stringContaining('CPU usage')
        })
      );
    });

    it('should generate memory alerts when usage exceeds threshold', async () => {
      // Mock high memory usage
      jest.spyOn(performanceMonitoring as any, 'getMemoryMetrics').mockResolvedValue({
        used: 7000,
        free: 1000,
        total: 8000,
        percentage: 87.5 // Above default threshold of 85
      });

      const alertSpy = jest.fn();
      performanceMonitoring.on('performanceAlert', alertSpy);

      await performanceMonitoring.collectMetrics();

      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory_high',
          severity: expect.any(String),
          message: expect.stringContaining('Memory usage')
        })
      );
    });

    it('should determine alert severity correctly', async () => {
      // Test different CPU usage levels
      const testCases = [
        { usage: 85, expectedSeverity: 'medium' }, // 5% above threshold
        { usage: 100, expectedSeverity: 'high' }, // 25% above threshold
        { usage: 130, expectedSeverity: 'critical' } // 62.5% above threshold
      ];

      for (const testCase of testCases) {
        jest.spyOn(performanceMonitoring as any, 'getCpuMetrics').mockResolvedValue({
          usage: testCase.usage,
          loadAverage: [1, 1, 1],
          cores: 4
        });

        const alertSpy = jest.fn();
        performanceMonitoring.on('performanceAlert', alertSpy);

        await performanceMonitoring.collectMetrics();

        const alertCall = alertSpy.mock.calls.find(call =>
          call[0].type === 'cpu_high'
        );

        if (alertCall) {
          expect(alertCall[0].severity).toBe(testCase.expectedSeverity);
        }
      }
    });
  });

  describe('Threshold Management', () => {
    it('should set custom thresholds', () => {
      const customThresholds = {
        cpu: { maxUsage: 90, maxLoadAverage: 3.0 },
        memory: { maxPercentage: 90 }
      };

      const eventSpy = jest.fn();
      performanceMonitoring.on('thresholdsUpdated', eventSpy);

      performanceMonitoring.setThresholds(customThresholds);

      expect(performanceMonitoring['thresholds'].cpu.maxUsage).toBe(90);
      expect(performanceMonitoring['thresholds'].cpu.maxLoadAverage).toBe(3.0);
      expect(performanceMonitoring['thresholds'].memory.maxPercentage).toBe(90);
      expect(performanceMonitoring['thresholds'].agent).toBeDefined(); // Default values should remain

      expect(eventSpy).toHaveBeenCalledWith(performanceMonitoring['thresholds']);
    });

    it('should preserve default thresholds for unchanged properties', () => {
      const originalThreshold = performanceMonitoring['thresholds'].cpu.maxUsage;

      performanceMonitoring.setThresholds({ memory: { maxPercentage: 95 } });

      expect(performanceMonitoring['thresholds'].cpu.maxUsage).toBe(originalThreshold);
      expect(performanceMonitoring['thresholds'].memory.maxPercentage).toBe(95);
    });
  });

  describe('Performance Reports', () => {
    beforeEach(async () => {
      // Add some test data
      await performanceMonitoring.collectMetrics();
      performanceMonitoring.registerAgent('agent-1', 'Agent 1');
      performanceMonitoring.registerAgent('agent-2', 'Agent 2');

      performanceMonitoring.recordTaskExecution('agent-1', 'task-1', 1000, true);
      performanceMonitoring.recordTaskExecution('agent-2', 'task-2', 2000, false);
    });

    it('should generate performance report', () => {
      const report = performanceMonitoring.generatePerformanceReport();

      expect(report).toBeDefined();
      expect(report.timeRange).toBeDefined();
      expect(report.systemMetrics).toBeDefined();
      expect(report.agentPerformance).toBeDefined();
      expect(report.alerts).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should analyze system metrics correctly', () => {
      const report = performanceMonitoring.generatePerformanceReport();
      const systemMetrics = report.systemMetrics;

      expect(typeof systemMetrics.averageCpuUsage).toBe('number');
      expect(typeof systemMetrics.averageMemoryUsage).toBe('number');
      expect(typeof systemMetrics.peakCpuUsage).toBe('number');
      expect(typeof systemMetrics.peakMemoryUsage).toBe('number');
      expect(typeof systemMetrics.uptime).toBe('number');
    });

    it('should analyze agent performance correctly', () => {
      const report = performanceMonitoring.generatePerformanceReport();
      const agentAnalysis = report.agentPerformance;

      expect(agentAnalysis.totalAgents).toBe(2);
      expect(agentAnalysis.activeAgents).toBe(2);
      expect(typeof agentAnalysis.averageResponseTime).toBe('number');
      expect(typeof agentAnalysis.overallSuccessRate).toBe('number');
      expect(Array.isArray(agentAnalysis.topPerformers)).toBe(true);
      expect(Array.isArray(agentAnalysis.needsAttention)).toBe(true);
    });

    it('should generate meaningful recommendations', () => {
      const report = performanceMonitoring.generatePerformanceReport();
      const recommendations = report.recommendations;

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should filter report by time range', async () => {
      const now = new Date();
      const timeRange = {
        start: new Date(now.getTime() - 60 * 60 * 1000),
        end: now
      };

      const report = performanceMonitoring.generatePerformanceReport(timeRange);

      expect(report.timeRange.start).toBe(timeRange.start);
      expect(report.timeRange.end).toBe(timeRange.end);
    });

    it('should handle empty data gracefully', () => {
      // Reset singleton to get empty instance
      (PerformanceMonitoring as any).instance = null;
      const emptyMonitor = PerformanceMonitoring.getInstance();

      const report = emptyMonitor.generatePerformanceReport();

      expect(report.systemMetrics.averageCpuUsage).toBe(0);
      expect(report.agentPerformance.totalAgents).toBe(0);
    });
  });

  describe('Benchmarks', () => {
    beforeEach(() => {
      // Mock fetch for network benchmarks
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('test response')
      });
    });

    it('should run default benchmarks', async () => {
      const results = await performanceMonitoring.runBenchmarks();

      expect(results).toBeDefined();
      expect(results.timestamp).toBeInstanceOf(Date);
      expect(results.config).toBeDefined();
      expect(results.results).toBeDefined();
      expect(results.results).toHaveLength(3); // CPU, Memory, Network

      const benchmarkNames = results.results.map(r => r.name);
      expect(benchmarkNames).toContain('CPU Performance');
      expect(benchmarkNames).toContain('Memory Performance');
      expect(benchmarkNames).toContain('Network Performance');
    });

    it('should run custom benchmarks', async () => {
      const customBenchmarks = [
        {
          name: 'Custom CPU Test',
          type: 'cpu' as const,
          config: { iterations: 500000 }
        }
      ];

      const results = await performanceMonitoring.runBenchmarks({
        benchmarks: customBenchmarks
      });

      expect(results.results).toHaveLength(1);
      expect(results.results[0].name).toBe('Custom CPU Test');
    });

    it('should handle benchmark failures gracefully', async () => {
      const failingBenchmarks = [
        {
          name: 'Failing Benchmark',
          type: 'custom' as const,
          config: {}
        }
      ];

      const results = await performanceMonitoring.runBenchmarks({
        benchmarks: failingBenchmarks
      });

      expect(results.results).toHaveLength(1);
      expect(results.results[0].success).toBe(false);
      expect(results.results[0].error).toBeDefined();
    });

    it('should emit benchmarksCompleted event', async () => {
      const eventSpy = jest.fn();
      performanceMonitoring.on('benchmarksCompleted', eventSpy);

      await performanceMonitoring.runBenchmarks();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
          results: expect.any(Array)
        })
      );
    });

    it('should run CPU benchmark successfully', async () => {
      const result = await (performanceMonitoring as any).runCpuBenchmark({
        name: 'CPU Test',
        type: 'cpu',
        config: { iterations: 10000 }
      });

      expect(result.name).toBe('CPU Test');
      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should run memory benchmark successfully', async () => {
      const result = await (performanceMonitoring as any).runMemoryBenchmark({
        name: 'Memory Test',
        type: 'memory',
        config: { size: 10000 }
      });

      expect(result.name).toBe('Memory Test');
      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should run network benchmark successfully', async () => {
      const result = await (performanceMonitoring as any).runNetworkBenchmark({
        name: 'Network Test',
        type: 'network',
        config: { url: 'https://httpbin.org/get' }
      });

      expect(result.name).toBe('Network Test');
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('https://httpbin.org/get');
    });

    it('should handle network benchmark failures', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await (performanceMonitoring as any).runNetworkBenchmark({
        name: 'Network Test',
        type: 'network'
      });

      expect(result.name).toBe('Network Test');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Bottleneck Analysis', () => {
    beforeEach(async () => {
      // Add some test metrics with high values
      jest.spyOn(performanceMonitoring as any, 'getCpuMetrics').mockResolvedValue({
        usage: 95, // Above threshold
        loadAverage: [2.5, 2.6, 2.7],
        cores: 4
      });

      jest.spyOn(performanceMonitoring as any, 'getMemoryMetrics').mockResolvedValue({
        used: 7000,
        free: 1000,
        total: 8000,
        percentage: 87.5 // Above threshold
      });

      await performanceMonitoring.collectMetrics();
    });

    it('should analyze bottlenecks', () => {
      const analysis = performanceMonitoring.analyzeBottlenecks();

      expect(analysis).toBeDefined();
      expect(analysis.timestamp).toBeInstanceOf(Date);
      expect(analysis.bottlenecks).toBeDefined();
      expect(typeof analysis.overallHealth).toBe('number');
      expect(Array.isArray(analysis.priorityActions)).toBe(true);
    });

    it('should identify CPU bottlenecks', () => {
      const analysis = performanceMonitoring.analyzeBottlenecks();

      const cpuBottleneck = analysis.bottlenecks.find(b => b.type === 'cpu');
      expect(cpuBottleneck).toBeDefined();
      expect(cpuBottleneck!.description).toContain('high CPU usage');
      expect(cpuBottleneck!.affectedComponents).toContain('system');
    });

    it('should identify memory bottlenecks', () => {
      const analysis = performanceMonitoring.analyzeBottlenecks();

      const memoryBottleneck = analysis.bottlenecks.find(b => b.type === 'memory');
      expect(memoryBottleneck).toBeDefined();
      expect(memoryBottleneck!.description).toContain('high memory usage');
      expect(memoryBottleneck!.affectedComponents).toContain('system');
    });

    it('should identify agent performance bottlenecks', async () => {
      performanceMonitoring.registerAgent('slow-agent', 'Slow Agent');

      // Add slow task execution
      for (let i = 0; i < 5; i++) {
        performanceMonitoring.recordTaskExecution('slow-agent', `task-${i}`, 6000, true);
      }

      const analysis = performanceMonitoring.analyzeBottlenecks();

      const agentBottleneck = analysis.bottlenecks.find(b => b.type === 'agent_performance');
      expect(agentBottleneck).toBeDefined();
      expect(agentBottleneck!.description).toContain('high average response time');
      expect(agentBottleneck!.affectedComponents).toContain('slow-agent');
    });

    it('should calculate overall health score', () => {
      const analysis = performanceMonitoring.analyzeBottlenecks();
      expect(typeof analysis.overallHealth).toBe('number');
      expect(analysis.overallHealth).toBeGreaterThanOrEqual(0);
      expect(analysis.overallHealth).toBeLessThanOrEqual(100);
    });

    it('should generate priority actions', () => {
      const analysis = performanceMonitoring.analyzeBottlenecks();

      expect(Array.isArray(analysis.priorityActions)).toBe(true);
      // Should include recommendations from high severity bottlenecks
    });

    it('should handle empty data gracefully', () => {
      (PerformanceMonitoring as any).instance = null;
      const emptyMonitor = PerformanceMonitoring.getInstance();

      const analysis = emptyMonitor.analyzeBottlenecks();

      expect(analysis.bottlenecks).toHaveLength(0);
      expect(analysis.overallHealth).toBe(100);
      expect(analysis.priorityActions).toHaveLength(0);
    });
  });

  describe('Event System', () => {
    it('should emit events with correct data', () => {
      const eventSpy = jest.fn();
      performanceMonitoring.on('test-event', eventSpy);

      performanceMonitoring.emit('test-event', { test: 'data' });

      expect(eventSpy).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should handle multiple event listeners', () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();

      performanceMonitoring.on('test-event', spy1);
      performanceMonitoring.on('test-event', spy2);

      performanceMonitoring.emit('test-event', { test: 'data' });

      expect(spy1).toHaveBeenCalledWith({ test: 'data' });
      expect(spy2).toHaveBeenCalledWith({ test: 'data' });
    });
  });

  describe('Memory Management', () => {
    it('should clean up old alerts automatically', async () => {
      // Mock old alert
      const oldAlert = {
        id: 'old-alert',
        type: 'test',
        severity: 'medium' as const,
        message: 'Test alert',
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        resolved: false
      };

      performanceMonitoring['alerts'].push(oldAlert);

      // Trigger alert cleanup by collecting metrics
      jest.spyOn(performanceMonitoring as any, 'getCpuMetrics').mockResolvedValue({
        usage: 85, // Above threshold to trigger new alert
        loadAverage: [1.5, 1.6, 1.7],
        cores: 4
      });

      await performanceMonitoring.collectMetrics();

      // Old alert should be cleaned up
      expect(performanceMonitoring['alerts']).not.toContain(oldAlert);
    });

    it('should not crash with extremely large metric values', async () => {
      jest.spyOn(performanceMonitoring as any, 'getCpuMetrics').mockResolvedValue({
        usage: 999999,
        loadAverage: [999999, 999999, 999999],
        cores: 999999
      });

      jest.spyOn(performanceMonitoring as any, 'getMemoryMetrics').mockResolvedValue({
        used: 999999,
        free: 1,
        total: 1000000,
        percentage: 99.9999
      });

      expect(async () => {
        await performanceMonitoring.collectMetrics();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero metrics for analysis', () => {
      const report = performanceMonitoring.generatePerformanceReport();

      expect(report.systemMetrics.averageCpuUsage).toBe(0);
      expect(report.agentPerformance.totalAgents).toBe(0);
    });

    it('should handle invalid agent IDs gracefully', () => {
      expect(() => {
        performanceMonitoring.updateAgentMetrics('', {});
      }).not.toThrow();

      expect(() => {
        performanceMonitoring.recordTaskExecution('', '', 0, false);
      }).not.toThrow();
    });

    it('should handle negative values in metrics', () => {
      expect(() => {
        performanceMonitoring.addCustomMetric('test', -5);
      }).not.toThrow();

      expect(() => {
        performanceMonitoring.updateAgentMetrics('test-agent', {
          responseTime: -100,
          successRate: 1.0
        });
      }).not.toThrow();
    });

    it('should handle very large custom metric values', () => {
      expect(() => {
        performanceMonitoring.addCustomMetric('test', Number.MAX_SAFE_INTEGER);
      }).not.toThrow();
    });
  });

  describe('Integration Features', () => {
    it('should work with real-time monitoring', async () => {
      performanceMonitoring.startMonitoring(100); // Fast interval for testing

      const metricsSpy = jest.fn();
      performanceMonitoring.on('metricsCollected', metricsSpy);

      // Wait for at least one collection cycle
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(metricsSpy).toHaveBeenCalled();
      expect(performanceMonitoring['metrics'].length).toBeGreaterThan(0);

      performanceMonitoring.stopMonitoring();
    });

    it('should handle multiple metric collections concurrently', async () => {
      const promises = Array(10).fill(null).map(() =>
        performanceMonitoring.collectMetrics()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should support agent lifecycle management', () => {
      const agentId = 'lifecycle-agent';

      // Register agent
      performanceMonitoring.registerAgent(agentId, 'Lifecycle Agent');

      // Add metrics and tasks
      performanceMonitoring.updateAgentMetrics(agentId, {
        responseTime: 100,
        successRate: 1.0
      });

      performanceMonitoring.recordTaskExecution(agentId, 'lifecycle-task', 500, true);

      performanceMonitoring.recordTaskExecution(agentId, 'lifecycle-task-2', 750, false);

      // Get agent data
      const agentData = performanceMonitoring.getAgentMetrics(agentId);

      expect(agentData).toBeDefined();
      expect(agentData!.taskHistory).toHaveLength(2);
      expect(agentData!.metrics).toHaveLength(1);
      expect(agentData!.averageResponseTime).toBeCloseTo(625, 1);
      expect(agentData!.successRate).toBeCloseTo(0.5, 1);
    });
  });
});