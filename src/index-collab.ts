/**
 * Main entry point for Turbo Flow Backend System with Pair Programming and Collaborative Development System
 * Initializes and starts the server with all core systems including collaboration features
 */

import { TurboFlowServer } from './api/server.js';
import { config } from './config/index.js';
import { CollaborationAPI } from './api/collaboration.js';
import { BackendIntegration } from './collaboration/integration/BackendIntegration.js';

async function main(): Promise<void> {
  console.log('🚀 Starting Turbo Flow Backend System with Pair Programming...');
  console.log(`📋 Environment: ${config.environment}`);
  console.log(`🔧 Port: ${config.port}`);
  console.log('🤝 Collaboration Features: Enabled');

  try {
    // Create and start the server
    const server = new TurboFlowServer(config.port);

    // Initialize collaboration system
    const backendIntegration = new BackendIntegration(server);
    await backendIntegration.start();

    // Add collaboration API routes
    const collaborationAPI = new CollaborationAPI(backendIntegration);
    server.addRouter('/api/collaboration', collaborationAPI.getRouter());

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 ${signal} received, shutting down gracefully...`);

      try {
        // Shutdown collaboration system first
        console.log('🤝 Shutting down collaboration system...');
        await backendIntegration.stop();

        // Shutdown server
        await server.stop();

        console.log('✅ All systems shut down successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled error handling
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    // Start the server
    await server.start();

    console.log('✅ Turbo Flow Backend System with Pair Programming is running successfully');
    console.log('🤝 Collaboration features available:');
    console.log('   - Real-time collaborative editing with CRDT');
    console.log('   - Role-based participation (Driver/Navigator/Observer/Moderator)');
    console.log('   - Integrated chat, voice calls, and video conferencing');
    console.log('   - Terminal sharing with secure command execution');
    console.log('   - Collaborative debugging with breakpoint management');
    console.log('   - Agent coordination and truth verification');
    console.log('   - GitHub integration and collaborative workflows');
    console.log('');
    console.log('📡 API Endpoints:');
    console.log('   - Collaboration API: /api/collaboration/*');
    console.log('   - WebSocket: ws://localhost:3000 (real-time updates)');
    console.log('');
    console.log('🎯 Key Features:');
    console.log('   • Conflict-free collaborative editing using CRDTs');
    console.log('   • Operational transformation for real-time text synchronization');
    console.log('   • Live cursor tracking and user presence indicators');
    console.log('   • Multi-role participation with dynamic role switching');
    console.log('   • Integrated communication with reactions and threads');
    console.log('   • Secure terminal sharing with permission management');
    console.log('   • Collaborative debugging with session recording');
    console.log('   • AI agent integration for intelligent assistance');
    console.log('   • Truth verification maintaining 95% accuracy threshold');
    console.log('   • Performance monitoring and optimization recommendations');

  } catch (error) {
    console.error('❌ Failed to start Turbo Flow Backend System:', error);
    process.exit(1);
  }
}

// Start the application
main();

export { TurboFlowServer, BackendIntegration };