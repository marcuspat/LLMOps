# Load Testing and Stress Testing Framework

This directory contains comprehensive load testing and stress testing frameworks for Turbo Flow with Claude-Flow Integration using K6.

## 🎯 Overview

The load testing framework is designed to:
- Test system performance under various load conditions
- Identify performance bottlenecks and breaking points
- Validate system scalability and reliability
- Provide detailed performance metrics and analysis
- Generate comprehensive test reports

## 📁 Directory Structure

```
tests/load/
├── scenarios/           # Test scenarios
│   ├── basic-load-test.js
│   └── stress-test.js
├── config/             # Configuration files
│   ├── load-test-config.js
│   └── stress-test-config.js
├── thresholds/         # Performance thresholds
│   └── load-test-thresholds.ts
├── utils/              # Helper utilities
│   └── helpers.js
├── reports/            # Generated test reports
├── runner.js           # Test orchestration script
└── README.md          # This file
```

## 🚀 Quick Start

### Prerequisites

1. Install K6:
```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Download binary (cross-platform)
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1
```

2. Ensure the application is running:
```bash
npm run dev
```

### Running Load Tests

#### Basic Load Test
```bash
# Run basic load test with default settings
node tests/load/runner.js

# Run with custom options
node tests/load/runner.js --stress --baseUrl=http://localhost:3000/api
```

#### Direct K6 Execution
```bash
# Run specific scenario
k6 run tests/load/scenarios/basic-load-test.js

# Run with environment variables
BASE_URL=http://localhost:3000/api ENVIRONMENT=staging k6 run tests/load/scenarios/basic-load-test.js

# Generate HTML report
k6 run --out html=report.html tests/load/scenarios/basic-load-test.js
```

## 📊 Test Scenarios

### 1. Basic Load Test (`basic-load-test.js`)

Simulates normal user load with gradual ramp-up and sustained traffic patterns.

**Features:**
- Gradual user ramp-up (10 → 25 → 50 users)
- Sustained load phase (50 users for 10 minutes)
- Peak load testing (up to 100 users)
- Multiple user workflows (swarm creation, task submission, mixed operations)
- Comprehensive metrics collection

**Stages:**
1. Warm-up: 10 users for 2 minutes
2. Ramp-up: 25 users for 3 minutes
3. Load: 50 users for 5 minutes
4. Sustained: 50 users for 10 minutes
5. Peak: 75-100 users for 8 minutes
6. Cool-down: Ramp down to 0 users

### 2. Stress Test (`stress-test.js`)

Pushes the system to its breaking point to identify limits and failure modes.

**Features:**
- Aggressive user ramp-up (up to 1000 users)
- Breaking point detection
- Resource usage monitoring
- Recovery analysis
- Error categorization

**Stages:**
1. Gradual ramp-up to breaking point
2. Breaking point identification
3. Recovery testing
4. Resource pressure analysis

## ⚙️ Configuration

### Load Test Configuration (`config/load-test-config.js`)

Key configuration options:
- `stages`: Test ramp-up/down stages
- `thresholds`: Performance thresholds
- `rpsLimit`: Requests per second limit
- `thinkTime`: Time between user requests
- `environment`: Test environment (dev/staging/production)

### Stress Test Configuration (`config/stress-test-config.js`)

Stress-specific settings:
- `maxConcurrentUsers`: Maximum user limit
- `breakingPointThreshold`: Error rate that indicates breaking point
- `responseTimeThreshold`: Response time that indicates breaking point

## 📈 Performance Thresholds

Defined in `thresholds/load-test-thresholds.ts`:

### Response Time
- **Excellent**: < 100ms
- **Good**: < 500ms
- **Acceptable**: < 1s
- **Poor**: < 2s
- **Critical**: >= 2s

### Throughput
- **Minimal**: 10 req/s
- **Basic**: 50 req/s
- **Good**: 100 req/s
- **Excellent**: 200 req/s
- **Exceptional**: 500 req/s

### Error Rate
- **Excellent**: < 0.1%
- **Good**: < 0.5%
- **Acceptable**: < 1%
- **Poor**: < 5%
- **Critical**: >= 5%

## 🔧 Customization

### Adding New Test Scenarios

1. Create a new JavaScript file in `scenarios/`:
```javascript
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export let errorRate = new Rate('errors');
export let responseTime = new Trend('response_time');

export let options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Your test logic here
}

export function handleSummary(data) {
  // Custom summary logic
  return {
    'custom-summary.json': JSON.stringify(data, null, 2),
  };
}
```

2. Add to runner configuration:
```javascript
const testTypes = ['load', 'stress', 'your-custom-test'];
```

### Custom Metrics

Define custom metrics for your application:
```javascript
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

export let customErrorRate = new Rate('custom_errors');
export let customResponseTime = new Trend('custom_response_time');
export let customCounter = new Counter('custom_operations');
export let customGauge = new Gauge('custom_gauge');
```

## 📊 Reports

### Generated Reports

The framework generates multiple report formats:

1. **HTML Report**: Interactive web report with charts and analysis
2. **JSON Report**: Machine-readable results for automation
3. **Consolidated Report**: Combined results from multiple test types
4. **Console Summary**: Quick overview in the terminal

### Report Location
Reports are generated in `tests/load/reports/` with timestamp-based filenames.

### Report Contents

- **Executive Summary**: High-level overview and key metrics
- **Performance Metrics**: Detailed response times, throughput, error rates
- **Resource Usage**: CPU, memory, and disk utilization
- **Threshold Analysis**: Comparison against defined thresholds
- **Recommendations**: Actionable insights for improvement

## 🔄 Continuous Integration

### GitHub Actions Integration

Add to your CI pipeline:

```yaml
name: Load Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Install K6
      run: |
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6

    - name: Start application
      run: npm run dev &

    - name: Wait for application
      run: sleep 30

    - name: Run load tests
      run: node tests/load/runner.js

    - name: Upload reports
      uses: actions/upload-artifact@v3
      with:
        name: load-test-reports
        path: tests/load/reports/
```

## 🐛 Troubleshooting

### Common Issues

1. **Connection Refused**:
   - Ensure the application is running on the correct port
   - Check firewall settings
   - Verify BASE_URL environment variable

2. **High Error Rates**:
   - Check application logs for errors
   - Verify authentication tokens are valid
   - Ensure test data is properly set up

3. **Memory Issues**:
   - Reduce concurrent user count
   - Increase system memory
   - Check for memory leaks in the application

4. **Timeout Errors**:
   - Increase timeout values in test configuration
   - Check application performance under load
   - Verify database connections aren't exhausted

### Debug Mode

Run tests with debug output:
```bash
DEBUG=k6:* k6 run --vus 10 --duration 30s tests/load/scenarios/basic-load-test.js
```

## 📚 Best Practices

1. **Test Data Management**:
   - Use separate test environments
   - Clean up test data after runs
   - Use realistic data volumes

2. **Threshold Setting**:
   - Set thresholds based on business requirements
   - Consider peak traffic patterns
   - Account for normal performance variations

3. **Monitoring**:
   - Monitor system resources during tests
   - Collect application metrics
   - Use APM tools for deeper insights

4. **Test Scheduling**:
   - Run tests during off-peak hours
   - Schedule regular performance regression tests
   - Test after major code changes

5. **Result Analysis**:
   - Compare results over time
   - Identify performance trends
   - Document and investigate anomalies

## 🔗 Additional Resources

- [K6 Documentation](https://k6.io/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/test-types/load-testing/)
- [K6 Cloud](https://k6.io/cloud/)
- [Load Testing with K6](https://k6.io/docs/getting-started/running-k6/)

## 📞 Support

For issues with the load testing framework:
1. Check the troubleshooting section above
2. Review K6 documentation
3. Examine application logs
4. Verify test configuration
5. Contact the development team if issues persist