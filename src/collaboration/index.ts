/**
 * Pair Programming and Collaborative Development System
 * Main entry point for the collaboration system
 */

export * from './types.js';
export * from './core/CollaborationEngine.js';
export * from './crdt/OperationalTransform.js';
export * from './communication/ChatSystem.js';
export * from './editor/SharedCodeEditor.js';
export * from './terminal/TerminalSharing.js';
export * from './debugging/DebugCoordinator.js';
export * from './integration/BackendIntegration.js';

// Re-export main classes for convenience
export { CollaborationEngine } from './core/CollaborationEngine.js';
export { CRDTOperationalTransform } from './crdt/OperationalTransform.js';
export { ChatSystem } from './communication/ChatSystem.js';
export { SharedCodeEditor } from './editor/SharedCodeEditor.js';
export { TerminalSharing } from './terminal/TerminalSharing.js';
export { DebugCoordinator } from './debugging/DebugCoordinator.js';
export { BackendIntegration } from './integration/BackendIntegration.js';