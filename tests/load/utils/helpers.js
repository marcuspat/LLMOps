import http from 'k6/http';

export function createTestUser(vuId) {
  return {
    email: `testuser${vuId}@turboflow.test`,
    password: `TestPassword123!${vuId}`,
    name: `Test User ${vuId}`,
    role: vuId % 3 === 0 ? 'admin' : 'user',
  };
}

export function authenticateUser(user) {
  const authPayload = {
    email: user.email,
    password: user.password,
  };

  const response = http.post('http://localhost:3000/api/auth/login', JSON.stringify(authPayload), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 200) {
    const data = response.json();
    return data.token || data.access_token;
  }

  // If login fails, try to register first
  const registerPayload = {
    ...user,
    confirm_password: user.password,
  };

  const registerResponse = http.post('http://localhost:3000/api/auth/register', JSON.stringify(registerPayload), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (registerResponse.status === 201) {
    // Try login again
    const loginResponse = http.post('http://localhost:3000/api/auth/login', JSON.stringify(authPayload), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (loginResponse.status === 200) {
      const data = loginResponse.json();
      return data.token || data.access_token;
    }
  }

  throw new Error(`Failed to authenticate user ${user.email}`);
}

export function generateTaskPayload(options = {}) {
  const taskTypes = ['CODE_GENERATION', 'TESTING', 'DOCUMENTATION', 'ANALYSIS', 'OPTIMIZATION'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  return {
    name: options.name || `Test Task ${Math.random().toString(36).substr(2, 9)}`,
    description: options.description || `Load testing task with ID ${Math.random().toString(36).substr(2, 9)}`,
    type: options.type || taskTypes[Math.floor(Math.random() * taskTypes.length)],
    priority: options.priority || priorities[Math.floor(Math.random() * priorities.length)],
    metadata: {
      created_by: 'load-test',
      test_run_id: `${Date.now()}`,
      ...options.metadata
    },
    dependencies: options.dependencies || [],
    attachments: options.attachments || [],
    estimated_duration: options.estimated_duration || `${Math.floor(Math.random() * 60) + 5}m`,
    tags: options.tags || ['load-test', 'automated'],
    parameters: {
      complexity: options.complexity || 'medium',
      size: options.size || 'medium',
      ...options.parameters
    }
  };
}

export function createTestSwarm(token) {
  const swarmPayload = {
    name: `Load Test Swarm ${Math.random().toString(36).substr(2, 9)}`,
    description: 'Swarm created for load testing purposes',
    topology: 'MESH',
    strategy: 'BALANCED',
    max_agents: 10,
    enable_auto_scaling: true,
    initial_agents: [
      {
        type: 'CODER',
        name: 'Load Test Coder',
        capabilities: ['coding', 'development'],
        priority: 'medium'
      },
      {
        type: 'TESTER',
        name: 'Load Test Tester',
        capabilities: ['testing', 'quality_assurance'],
        priority: 'medium'
      }
    ]
  };

  return http.post('http://localhost:3000/api/swarms', JSON.stringify(swarmPayload), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export function waitForTaskCompletion(token, taskId, maxWaitTime = 30000) {
  const startTime = Date.now();
  const pollInterval = 1000;

  while (Date.now() - startTime < maxWaitTime) {
    const response = http.get(`http://localhost:3000/api/tasks/${taskId}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 200) {
      const status = response.json();
      if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        return status;
      }
    }

    sleep(pollInterval / 1000);
  }

  throw new Error(`Task ${taskId} did not complete within ${maxWaitTime}ms`);
}

export function getTestMetrics(token) {
  const response = http.get('http://localhost:3000/api/metrics/system', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 200) {
    return response.json();
  }

  return null;
}

export function cleanupTestData(token, testData) {
  const cleanupPromises = [];

  // Clean up created tasks
  if (testData.taskIds && testData.taskIds.length > 0) {
    testData.taskIds.forEach(taskId => {
      cleanupPromises.push(
        http.asyncRequest('DELETE', `http://localhost:3000/api/tasks/${taskId}`, null, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      );
    });
  }

  // Clean up created swarms
  if (testData.swarmIds && testData.swarmIds.length > 0) {
    testData.swarmIds.forEach(swarmId => {
      cleanupPromises.push(
        http.asyncRequest('DELETE', `http://localhost:3000/api/swarms/${swarmId}`, null, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      );
    });
  }

  return Promise.all(cleanupPromises);
}

export function getRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomFloat(min, max, decimals = 2) {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);
  return parseFloat(str);
}

export function generateBulkTasks(count, options = {}) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    tasks.push(generateTaskPayload({
      ...options,
      name: options.name ? `${options.name} ${i}` : undefined,
    }));
  }
  return tasks;
}

export function createMetricsSnapshot() {
  return {
    timestamp: Date.now(),
    memory: {
      used: Math.random() * 1024 * 1024 * 1024, // Random bytes
      total: 4 * 1024 * 1024 * 1024, // 4GB
    },
    cpu: {
      usage: Math.random() * 100,
      cores: 8,
    },
    network: {
      bytes_in: Math.random() * 1024 * 1024,
      bytes_out: Math.random() * 1024 * 1024,
    },
  };
}

export function calculateMetricsDifference(before, after) {
  return {
    duration: after.timestamp - before.timestamp,
    memory_diff: after.memory.used - before.memory.used,
    cpu_avg: (before.cpu.usage + after.cpu.usage) / 2,
    network_in_diff: after.network.bytes_in - before.network.bytes_in,
    network_out_diff: after.network.bytes_out - before.network.bytes_out,
  };
}

// Error handling utilities
export function handleRequestError(response, operation) {
  if (response.status >= 400) {
    console.error(`Error in ${operation}: Status ${response.status}, Body: ${response.body}`);
    return {
      success: false,
      error: {
        status: response.status,
        message: response.body || 'Unknown error',
        operation,
      },
    };
  }

  return {
    success: true,
    data: response.status === 204 ? null : response.json(),
    headers: response.headers,
  };
}

// Test data validation utilities
export function validateTaskResponse(response) {
  const validations = {
    hasId: () => response.json('id') !== undefined,
    hasName: () => response.json('name') !== undefined,
    hasStatus: () => ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'].includes(response.json('status')),
    hasValidType: () => ['CODE_GENERATION', 'TESTING', 'DOCUMENTATION', 'ANALYSIS', 'OPTIMIZATION'].includes(response.json('type')),
  };

  const results = Object.keys(validations).map(key => ({
    test: key,
    passed: validations[key](),
  }));

  return results.every(result => result.passed);
}

export function validateSwarmResponse(response) {
  const validations = {
    hasId: () => response.json('id') !== undefined,
    hasName: () => response.json('name') !== undefined,
    hasStatus: () => ['ACTIVE', 'INACTIVE', 'SCALING', 'OPTIMIZING'].includes(response.json('status')),
    hasAgents: () => Array.isArray(response.json('agents')),
    hasValidTopology: () => ['HIERARCHICAL', 'MESH', 'RING', 'STAR', 'ADAPTIVE'].includes(response.json('topology')),
  };

  const results = Object.keys(validations).map(key => ({
    test: key,
    passed: validations[key](),
  }));

  return results.every(result => result.passed);
}