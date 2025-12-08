/**
 * CRDT-based Operational Transformation Engine
 * Implements conflict-free replicated data types for real-time collaboration
 */

import { OperationalTransform, TransformType, ConflictType, ConflictResolutionStrategy } from '../types.js';

export interface CRDTDocument {
  id: string;
  text: string;
  version: number;
  operations: Operation[];
  replicas: Map<string, ReplicaState>;
  conflicts: Map<string, ConflictInfo>;
}

export interface Operation {
  id: string;
  type: TransformType;
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, any>;
  author: string;
  timestamp: number;
  replicaId: string;
  vector: VectorClock;
  dependencies: string[];
}

export interface VectorClock {
  [replicaId: string]: number;
}

export interface ReplicaState {
  id: string;
  version: number;
  clock: VectorClock;
  lastSeen: number;
}

export interface ConflictInfo {
  id: string;
  type: ConflictType;
  operations: Operation[];
  resolved: boolean;
  resolution?: Operation[];
}

/**
 * CRDT Operational Transform Engine
 * Implements a sequence CRDT with operational transformation
 */
export class CRDTOperationalTransform {
  private documents: Map<string, CRDTDocument> = new Map();
  private replicaId: string;
  private clock: VectorClock = {};

  constructor(replicaId: string) {
    this.replicaId = replicaId;
    this.clock[replicaId] = 0;
  }

  /**
   * Create a new document
   */
  public createDocument(documentId: string, initialContent: string = ''): CRDTDocument {
    const document: CRDTDocument = {
      id: documentId,
      text: initialContent,
      version: 0,
      operations: [],
      replicas: new Map(),
      conflicts: new Map()
    };

    // Initialize replica state
    document.replicas.set(this.replicaId, {
      id: this.replicaId,
      version: 0,
      clock: { ...this.clock },
      lastSeen: Date.now()
    });

    this.documents.set(documentId, document);
    return document;
  }

  /**
   * Apply an operation to a document
   */
  public applyOperation(
    documentId: string,
    operation: Partial<Operation>
  ): { success: boolean; conflicts?: ConflictInfo[]; appliedOperation?: Operation } {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Create complete operation
    const op: Operation = {
      id: operation.id || this.generateOperationId(),
      type: operation.type!,
      position: operation.position!,
      content: operation.content,
      length: operation.length,
      attributes: operation.attributes,
      author: operation.author || this.replicaId,
      timestamp: operation.timestamp || Date.now(),
      replicaId: operation.replicaId || this.replicaId,
      vector: { ...this.clock },
      dependencies: operation.dependencies || []
    };

    // Update vector clock
    this.clock[this.replicaId]++;
    op.vector[this.replicaId] = this.clock[this.replicaId];

    // Detect conflicts
    const conflicts = this.detectConflicts(document, op);

    if (conflicts.length > 0) {
      // Handle conflicts based on strategy
      const resolution = this.resolveConflicts(document, conflicts, op);

      if (!resolution.resolved) {
        return {
          success: false,
          conflicts: conflicts.map(c => c.conflictInfo)
        };
      }

      // Apply resolved operations
      for (const resolvedOp of resolution.resolvedOperations) {
        this.applyOperationInternal(document, resolvedOp);
      }

      return {
        success: true,
        conflicts: conflicts.map(c => c.conflictInfo),
        appliedOperation: resolution.resolvedOperations.find(o => o.id === op.id)
      };
    }

    // Apply operation directly
    this.applyOperationInternal(document, op);

    return {
      success: true,
      appliedOperation: op
    };
  }

  /**
   * Transform an operation against concurrent operations
   */
  public transformOperation(
    documentId: string,
    operation: Operation,
    concurrentOps: Operation[]
  ): Operation {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    let transformedOp = { ...operation };
    let positionOffset = 0;

    // Sort concurrent operations by timestamp and then by position
    const sortedOps = concurrentOps.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.position - b.position;
    });

    for (const concurrentOp of sortedOps) {
      if (concurrentOp.id === operation.id) {
        continue; // Skip self
      }

      // Check if operations are concurrent
      if (!this.isConcurrent(operation.vector, concurrentOp.vector)) {
        continue;
      }

      transformedOp = this.transformAgainst(
        transformedOp,
        concurrentOp,
        positionOffset
      );

      // Update position offset for subsequent operations
      if (concurrentOp.type === TransformType.INSERT &&
          concurrentOp.position <= transformedOp.position) {
        positionOffset += concurrentOp.content!.length;
      } else if (concurrentOp.type === TransformType.DELETE &&
                 concurrentOp.position < transformedOp.position) {
        positionOffset -= concurrentOp.length!;
      }
    }

    return transformedOp;
  }

  /**
   * Get the current document state
   */
  public getDocument(documentId: string): CRDTDocument | null {
    return this.documents.get(documentId) || null;
  }

  /**
   * Get all operations since a specific version
   */
  public getOperationsSince(documentId: string, version: number): Operation[] {
    const document = this.documents.get(documentId);
    if (!document) {
      return [];
    }

    return document.operations
      .filter(op => this.getVersionFromVector(op.vector) > version)
      .sort((a, b) => this.compareVectorClocks(a.vector, b.vector));
  }

  /**
   * Merge operations from another replica
   */
  public mergeOperations(
    documentId: string,
    operations: Operation[]
  ): { applied: Operation[]; conflicts: ConflictInfo[] } {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const applied: Operation[] = [];
    const conflicts: ConflictInfo[] = [];

    // Sort operations by causal order
    const sortedOps = this.sortByCausalOrder(operations);

    for (const operation of sortedOps) {
      // Check if we already have this operation
      if (document.operations.some(op => op.id === operation.id)) {
        continue;
      }

      const result = this.applyOperation(documentId, operation);

      if (result.success && result.appliedOperation) {
        applied.push(result.appliedOperation);
      }

      if (result.conflicts) {
        conflicts.push(...result.conflicts);
      }
    }

    return { applied, conflicts };
  }

  /**
   * Get synchronization state for another replica
   */
  public getSyncState(documentId: string): {
    version: number;
    operations: Operation[];
    vector: VectorClock;
  } {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const replicaState = document.replicas.get(this.replicaId);

    return {
      version: replicaState?.version || 0,
      operations: document.operations.slice(),
      vector: { ...this.clock }
    };
  }

  // Private methods

  private applyOperationInternal(document: CRDTDocument, operation: Operation): void {
    switch (operation.type) {
      case TransformType.INSERT:
        this.applyInsert(document, operation);
        break;
      case TransformType.DELETE:
        this.applyDelete(document, operation);
        break;
      case TransformType.REPLACE:
        this.applyReplace(document, operation);
        break;
      case TransformType.FORMAT:
        this.applyFormat(document, operation);
        break;
      case TransformType.RETAIN:
        // No-op for retain
        break;
    }

    // Add to operations history
    document.operations.push(operation);
    document.version++;

    // Update replica state
    const replicaState = document.replicas.get(this.replicaId);
    if (replicaState) {
      replicaState.version = document.version;
      replicaState.clock = { ...this.clock };
      replicaState.lastSeen = Date.now();
    }
  }

  private applyInsert(document: CRDTDocument, operation: Operation): void {
    const { position, content } = operation;
    const before = document.text.substring(0, position);
    const after = document.text.substring(position);
    document.text = before + content + after;
  }

  private applyDelete(document: CRDTDocument, operation: Operation): void {
    const { position, length } = operation;
    const before = document.text.substring(0, position);
    const after = document.text.substring(position + length);
    document.text = before + after;
  }

  private applyReplace(document: CRDTDocument, operation: Operation): void {
    const { position, content, length } = operation;
    const before = document.text.substring(0, position);
    const after = document.text.substring(position + length!);
    document.text = before + content + after;
  }

  private applyFormat(document: CRDTDocument, operation: Operation): void {
    // Format operations don't change text content
    // They would be stored as metadata for rendering
  }

  private detectConflicts(
    document: CRDTDocument,
    operation: Operation
  ): { conflict: boolean; conflictInfo: ConflictInfo }[] {
    const conflicts: { conflict: boolean; conflictInfo: ConflictInfo }[] = [];

    // Check for conflicting insert/delete operations
    for (const existingOp of document.operations) {
      if (this.isConflicting(existingOp, operation)) {
        conflicts.push({
          conflict: true,
          conflictInfo: {
            id: this.generateConflictId(),
            type: this.getConflictType(existingOp, operation),
            operations: [existingOp, operation],
            resolved: false
          }
        });
      }
    }

    return conflicts;
  }

  private isConflicting(op1: Operation, op2: Operation): boolean {
    // Check if operations overlap in a conflicting way
    if (op1.id === op2.id) {
      return false;
    }

    // Insert/Delete conflicts
    if ((op1.type === TransformType.INSERT && op2.type === TransformType.DELETE) ||
        (op1.type === TransformType.DELETE && op2.type === TransformType.INSERT)) {
      return this.rangesOverlap(op1.position, op1.content?.length || 0,
                               op2.position, op2.length || 0);
    }

    // Delete/Delete conflicts
    if (op1.type === TransformType.DELETE && op2.type === TransformType.DELETE) {
      return this.rangesOverlap(op1.position, op1.length!,
                               op2.position, op2.length!);
    }

    // Replace conflicts
    if (op1.type === TransformType.REPLACE || op2.type === TransformType.REPLACE) {
      return this.rangesOverlap(op1.position, op1.content?.length || 0,
                               op2.position, op2.content?.length || 0);
    }

    return false;
  }

  private rangesOverlap(
    pos1: number, len1: number,
    pos2: number, len2: number
  ): boolean {
    const end1 = pos1 + len1;
    const end2 = pos2 + len2;

    return !(end1 <= pos2 || end2 <= pos1);
  }

  private getConflictType(op1: Operation, op2: Operation): ConflictType {
    if (op1.type === TransformType.FORMAT || op2.type === TransformType.FORMAT) {
      return ConflictType.ATTRIBUTE_CONFLICT;
    }
    return ConflictType.CONCURRENT_EDIT;
  }

  private resolveConflicts(
    document: CRDTDocument,
    conflicts: { conflict: boolean; conflictInfo: ConflictInfo }[],
    newOperation: Operation
  ): { resolved: boolean; resolvedOperations: Operation[] } {
    // Default strategy: last writer wins for text operations
    // merge for format operations

    const resolvedOperations: Operation[] = [];

    for (const { conflictInfo } of conflicts) {
      if (conflictInfo.type === ConflictType.ATTRIBUTE_CONFLICT) {
        // Merge format attributes
        const merged = this.mergeFormatOperations(conflictInfo.operations);
        resolvedOperations.push(...merged);
        conflictInfo.resolved = true;
        conflictInfo.resolution = merged;
      } else {
        // Use last writer wins
        const lastOp = conflictInfo.operations
          .sort((a, b) => b.timestamp - a.timestamp)[0];

        if (lastOp.id === newOperation.id) {
          resolvedOperations.push(newOperation);
        }

        conflictInfo.resolved = true;
        conflictInfo.resolution = [lastOp];
      }

      document.conflicts.set(conflictInfo.id, conflictInfo);
    }

    return {
      resolved: true,
      resolvedOperations
    };
  }

  private mergeFormatOperations(operations: Operation[]): Operation[] {
    // Merge format operations by combining attributes
    const merged = new Map<string, Operation>();

    for (const op of operations) {
      if (op.type === TransformType.FORMAT) {
        const key = `${op.position}-${op.length}`;
        const existing = merged.get(key);

        if (existing) {
          // Merge attributes
          existing.attributes = { ...existing.attributes, ...op.attributes };
        } else {
          merged.set(key, { ...op });
        }
      }
    }

    return Array.from(merged.values());
  }

  private transformAgainst(
    op1: Operation,
    op2: Operation,
    positionOffset: number
  ): Operation {
    const transformed = { ...op1 };

    if (op2.type === TransformType.INSERT) {
      if (op2.position <= transformed.position) {
        transformed.position += op2.content!.length;
      }
    } else if (op2.type === TransformType.DELETE) {
      if (op2.position < transformed.position) {
        transformed.position -= op2.length!;
      } else if (op2.position === transformed.position &&
                 transformed.type === TransformType.INSERT) {
        // Both insert at same position - use ordering
        if (op1.timestamp < op2.timestamp) {
          // op1 came first, no transformation needed
        } else {
          // op2 came first, shift op1
          transformed.position += op2.length!;
        }
      }
    }

    return transformed;
  }

  private isConcurrent(vector1: VectorClock, vector2: VectorClock): boolean {
    const keys = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);

    let vector1Greater = false;
    let vector2Greater = false;

    for (const key of keys) {
      const v1 = vector1[key] || 0;
      const v2 = vector2[key] || 0;

      if (v1 > v2) vector1Greater = true;
      if (v2 > v1) vector2Greater = true;
    }

    return vector1Greater && vector2Greater;
  }

  private getVersionFromVector(vector: VectorClock): number {
    return Object.values(vector).reduce((sum, val) => sum + val, 0);
  }

  private compareVectorClocks(v1: VectorClock, v2: VectorClock): number {
    const version1 = this.getVersionFromVector(v1);
    const version2 = this.getVersionFromVector(v2);

    if (version1 < version2) return -1;
    if (version1 > version2) return 1;

    // Same version, compare lexicographically
    const keys = Object.keys(v1).sort();
    for (const key of keys) {
      const val1 = v1[key] || 0;
      const val2 = v2[key] || 0;

      if (val1 !== val2) {
        return val1 - val2;
      }
    }

    return 0;
  }

  private sortByCausalOrder(operations: Operation[]): Operation[] {
    return operations.sort((a, b) => this.compareVectorClocks(a.vector, b.vector));
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}