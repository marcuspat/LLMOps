# Turbo Flow Backend System

A comprehensive backend system for Turbo Flow with Claude-Flow Integration, featuring truth verification, agent coordination, GitHub integration, security scanning, and performance monitoring.

## 🚀 Features

### Core Systems
- **Truth Verification Engine** - 0.95 threshold enforcement for code quality, testing, security, and performance
- **Agent Coordination & Swarm Management** - Intelligent agent orchestration with multiple topologies
- **GitHub Integration Layer** - Webhooks, API connections, and repository management
- **Security Scanning Engine** - SAST, DAST, and dependency vulnerability detection
- **Performance Monitoring** - Real-time metrics collection and analysis
- **Workflow Orchestration** - Task management and execution coordination
- **Real-time Communication** - WebSocket-based collaboration features
- **Configuration Management** - Environment-based configuration with validation

### Architecture
- **TypeScript** for type safety and better development experience
- **RESTful API** design principles with comprehensive error handling
- **WebSocket** support for real-time updates and collaboration
- **Modular architecture** with clear separation of concerns
- **Event-driven** communication between system components
- **Singleton patterns** for core system managers

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- TypeScript 5.0 or higher

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/your-org/turbo-flow-backend.git
cd turbo-flow-backend

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

## 🔧 Configuration

The system uses environment variables for configuration. Create a `.env` file:

```env
# Basic Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Truth Verification
TRUTH_THRESHOLD=0.95
ENABLE_TRUTH_CACHE=true

# Agent Coordination
MAX_AGENTS=50
DEFAULT_TOPOLOGY=mesh
ENABLE_AUTO_SCALING=true

# GitHub Integration
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Security
ENABLE_REAL_TIME_SCANNING=true
SCAN_TIMEOUT=300000
MAX_CONCURRENT_SCANS=5

# Performance Monitoring
METRICS_INTERVAL=5000
CPU_ALERT_THRESHOLD=80
MEMORY_ALERT_THRESHOLD=85

# Authentication (optional)
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRATION=24h

# Database (optional)
DATABASE_URL=postgresql://user:password@localhost:5432/turboflow

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

## 🚀 API Endpoints

### Truth Verification
- `POST /api/truth/verify` - Verify content against truth standards
- `POST /api/truth/verify-batch` - Batch verify multiple content items
- `GET /api/truth/stats` - Get verification statistics

### Agent Coordination
- `POST /api/agents/swarms` - Create a new swarm
- `POST /api/agents` - Spawn a new agent
- `POST /api/agents/batch` - Spawn multiple agents in parallel
- `GET /api/agents/status` - Get system status
- `GET /api/agents/:agentId/metrics` - Get agent performance metrics
- `POST /api/agents/tasks` - Orchestrate a task

### GitHub Integration
- `POST /api/github/webhook` - Handle GitHub webhooks
- `POST /api/github/repos/:owner/:repo/webhooks` - Create repository webhook
- `GET /api/github/repos/:owner/:repo` - Get repository information
- `POST /api/github/repos/:owner/:repo/pulls` - Create pull request

### Security Scanning
- `POST /api/security/scans` - Initiate security scan
- `POST /api/security/scans/comprehensive` - Perform comprehensive scan
- `GET /api/security/scans/:scanId` - Get scan status
- `GET /api/security/results/:target` - Get security results
- `GET /api/security/stats` - Get security statistics

### Performance Monitoring
- `POST /api/performance/monitoring/start` - Start monitoring
- `POST /api/performance/monitoring/stop` - Stop monitoring
- `GET /api/performance/metrics` - Get performance metrics
- `GET /api/performance/agents/:agentId` - Get agent metrics
- `POST /api/performance/benchmarks` - Run performance benchmarks

## 🔌 WebSocket Events

The system emits real-time events over WebSocket:

- `agent_status_update` - Agent status changes
- `task_update` - Task execution updates
- `verification_result` - Truth verification results
- `security_scan_result` - Security scan results
- `performance_update` - Performance metrics updates
- `github_webhook` - GitHub webhook events

Example WebSocket client:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security

# Run load tests (1000+ concurrent users)
npm run test:load

# Run production load test
node scripts/load-test.js --production --users=1000 --duration=120

# Run performance benchmarks
npm run benchmark

# View performance dashboard
# Open docs/performance-dashboard.html in browser
```

## 📊 Truth Verification

The truth verification system enforces a 0.95 threshold for code quality, testing, security, and performance. It includes:

### Verification Types
- **Code Quality** - Structure, type safety, performance patterns
- **Test Coverage** - Test completeness, quality, and assertions
- **Security** - Vulnerability detection and security best practices
- **Performance** - Efficiency and resource usage analysis
- **Documentation** - Completeness and clarity

### Usage Example

```typescript
import { TruthVerification } from './src/core/TruthVerification.js';

const verifier = TruthVerification.getInstance();

const result = await verifier.verify({
  content: 'function example() { return true; }',
  type: 'code_quality',
  threshold: 0.95
});

console.log(`Score: ${result.score}, Passed: ${result.passed}`);
```

## 🤖 Agent Coordination

The agent coordination system manages swarms of AI agents with different capabilities:

### Agent Types
- Coordinator, Analyst, Optimizer, Documenter
- Code Analyzer, Performance Benchmarker, Security Manager
- System Architect, Researcher, Coder, Tester, Reviewer

### Swarm Topologies
- **Hierarchical** - Tree-based coordination
- **Mesh** - Peer-to-peer communication
- **Ring** - Circular coordination
- **Star** - Centralized coordination
- **Adaptive** - Dynamic topology adjustment

### Usage Example

```typescript
import { AgentCoordination } from './src/core/AgentCoordination.js';

const coordinator = AgentCoordination.getInstance();

// Create swarm
const swarm = await coordinator.createSwarm({
  name: 'Development Swarm',
  topology: 'mesh',
  maxAgents: 10,
  strategy: 'balanced'
});

// Spawn agents
const agents = await coordinator.spawnAgentsParallel([
  { type: 'coder', name: 'Frontend Developer' },
  { type: 'tester', name: 'QA Engineer' },
  { type: 'reviewer', name: 'Code Reviewer' }
]);
```

## 🔐 Security Features

Comprehensive security scanning and vulnerability detection:

### Scan Types
- **SAST** (Static Application Security Testing) - Code analysis
- **DAST** (Dynamic Application Security Testing) - Runtime testing
- **Dependency Scanning** - Third-party vulnerability detection
- **Comprehensive** - All scan types combined

### Supported Vulnerability Databases
- CVE (Common Vulnerabilities and Exposures)
- NVD (National Vulnerability Database)
- GitHub Advisory Database
- Snyk Vulnerability Database

## 📈 Performance Monitoring

Real-time performance monitoring with production-grade optimizations:

### Performance Features
- **1000+ Concurrent User Support** - Horizontal scaling with cluster mode
- **P95 Response Times <500ms** - Optimized API responses and caching
- **<1% Error Rate Under Load** - Robust error handling and retry logic
- **Multi-Level Caching** - L1 in-memory + L2 Redis with intelligent warming
- **Advanced Connection Pooling** - PostgreSQL pool with health checks and retry logic
- **Adaptive Rate Limiting** - Token bucket algorithm with load shedding
- **Memory Leak Detection** - Automatic monitoring and garbage collection optimization
- **Real-time Dashboard** - WebSocket-based performance visualization

### Metrics Collection
- **System Metrics** - CPU, memory, network usage with detailed analytics
- **Database Metrics** - Connection pool stats, query performance, health monitoring
- **Cache Metrics** - Hit rates, eviction patterns, cache efficiency analysis
- **Agent Metrics** - Response time, success rate, resource efficiency
- **Custom Metrics** - Application-specific performance data
- **Load Testing** - Automated load generation with configurable scenarios

### Performance Optimization Components
- **DatabasePool.ts** - Production-grade PostgreSQL connection pooling
- **CacheManager.ts** - Multi-level caching with compression and batch operations
- **RateLimiter.ts** - Adaptive rate limiting with priority queues
- **ResponseOptimizer.ts** - API response compression and field selection
- **MemoryOptimizer.ts** - Memory monitoring and automatic optimization
- **Load Testing Script** - Comprehensive load testing with worker threads
- **Performance Dashboard** - Real-time WebSocket-based monitoring

### Alert System
- Configurable thresholds for different metrics
- Real-time alert notifications via WebSocket
- Historical trend analysis and predictive analytics
- Bottleneck detection with actionable recommendations
- Automated performance tuning based on load patterns

## 📚 Development

### Project Structure
```
src/
├── core/           # Core system components
├── api/            # REST API and WebSocket handlers
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── middleware/     # Express middleware
└── config/         # Configuration management

tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/           # End-to-end tests

docs/
├── api/            # API documentation
└── architecture/   # System architecture docs
```

### Code Style
- TypeScript with strict mode enabled
- ESLint for linting
- Prettier for code formatting
- Comprehensive test coverage (95%+)
- Documentation with JSDoc comments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style and patterns
- Add tests for new functionality
- Update documentation for API changes
- Ensure all tests pass before submitting
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Turbo Flow](https://github.com/ruvnet/turbo-flow) - Main Turbo Flow project
- [Claude-Flow](https://github.com/ruvnet/claude-flow) - Claude Flow orchestration system
- [Agentic-Jujutsu](https://github.com/ruvnet/agentic-jujutsu) - Agent coordination framework

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Join our Discord community
- Check the documentation at [docs.turboflow.dev](https://docs.turboflow.dev)

---

**Built with ❤️ using TypeScript, Node.js, and modern web technologies**