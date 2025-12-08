module.exports = {
  apps: [
    {
      name: 'turbo-flow',
      script: 'dist/index.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable cluster mode
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Database configurations
        DATABASE_HOST: process.env.DATABASE_HOST || 'database-primary',
        DATABASE_PORT: process.env.DATABASE_PORT || 5432,
        DATABASE_NAME: process.env.DATABASE_NAME || 'turboflow',
        DATABASE_USER: process.env.DATABASE_USER || 'turboflow',
        DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || '',
        DATABASE_SSL: process.env.DATABASE_SSL || 'true',
        DATABASE_POOL_MIN: process.env.DATABASE_POOL_MIN || '2',
        DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX || '10',
        DATABASE_TIMEOUT: process.env.DATABASE_TIMEOUT || '30000',
        // Redis configurations
        REDIS_HOST: process.env.REDIS_HOST || 'redis',
        REDIS_PORT: process.env.REDIS_PORT || 6379,
        REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
        REDIS_DB: process.env.REDIS_DB || '0',
        REDIS_POOL_MIN: process.env.REDIS_POOL_MIN || '5',
        REDIS_POOL_MAX: process.env.REDIS_POOL_MAX || '20',
        REDIS_CONNECT_TIMEOUT: process.env.REDIS_CONNECT_TIMEOUT || '10000',
        REDIS_LAZY_CONNECT: process.env.REDIS_LAZY_CONNECT || 'true',
        // JWT configurations
        JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
        JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        // Application configurations
        APP_NAME: 'Turbo Flow',
        APP_VERSION: '1.0.0',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        LOG_MAX_SIZE: process.env.LOG_MAX_SIZE || '10m',
        LOG_MAX_FILES: process.env.LOG_MAX_FILES || '5',
        // Performance configurations
        WORKER_COUNT: process.env.WORKER_COUNT || '0', // 0 = auto based on CPU
        MAX_MEMORY_RESTART: process.env.MAX_MEMORY_RESTART || '1G',
        // Monitoring configurations
        ENABLE_METRICS: process.env.ENABLE_METRICS || 'true',
        METRICS_PORT: process.env.METRICS_PORT || '9464',
        METRICS_PATH: process.env.METRICS_PATH || '/metrics',
        // Security configurations
        RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || '900000', // 15 minutes
        RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || '100',
        CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://turboflow.com',
        ENABLE_TRUST_PROXY: process.env.ENABLE_TRUST_PROXY || 'true',
        HELMET_ENABLED: process.env.HELMET_ENABLED || 'true',
        // File upload configurations
        MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '10485760', // 10MB
        UPLOAD_PATH: process.env.UPLOAD_PATH || '/app/uploads',
        // WebSocket configurations
        WEBSOCKET_ENABLED: process.env.WEBSOCKET_ENABLED || 'true',
        WEBSOCKET_MAX_CONNECTIONS: process.env.WEBSOCKET_MAX_CONNECTIONS || '1000',
        // External services
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
        GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || ''
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        LOG_LEVEL: 'debug',
        WORKER_COUNT: '2',
        MAX_MEMORY_RESTART: '512M',
        DATABASE_POOL_MIN: '1',
        DATABASE_POOL_MAX: '5'
      },

      // Logging configuration
      log_file: '/app/logs/combined.log',
      out_file: '/app/logs/out.log',
      error_file: '/app/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Performance tuning
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,

      // Health check
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,

      // Restart strategy
      autorestart: true,
      watch: false, // Disable watching in production
      ignore_watch: ['node_modules', 'logs', 'uploads', '.git'],

      // Environment-specific settings
      node_args: [
        '--max-old-space-size=1024',
        '--max-semi-space-size=128',
        '--optimize-for-size',
        '--gc-interval=100'
      ],

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Instance configuration for clustering
      instance_var: 'INSTANCE_ID',

      // PM2 advanced features
      pmx: true,
      v8: true,

      // Custom metrics and monitoring
      pmx: {
        network: true,
        ports: {
          metrics: 9464
        }
      },

      // Enhanced error handling
      error_file: '/app/logs/error.log',
      out_file: '/app/logs/out.log',
      log_type: 'json',

      // Cron jobs for maintenance
      cron_restart: '0 2 * * *', // Restart daily at 2 AM
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'nodejs',
      host: ['turboflow.com'],
      ref: 'origin/main',
      repo: 'https://github.com/your-org/turbo-flow.git',
      path: '/var/www/turbo-flow',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --only=production && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt-get install git',
      'ssh_options': 'StrictHostKeyChecking=no'
    },
    staging: {
      user: 'nodejs',
      host: ['staging.turboflow.com'],
      ref: 'origin/develop',
      repo: 'https://github.com/your-org/turbo-flow.git',
      path: '/var/www/turbo-flow-staging',
      'post-deploy': 'npm ci --only=production && npm run build && pm2 reload ecosystem.config.js --env staging',
      'ssh_options': 'StrictHostKeyChecking=no'
    }
  }
};