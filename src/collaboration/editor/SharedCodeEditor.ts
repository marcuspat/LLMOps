/**
 * Shared Code Editor with Live Updates
 * Real-time collaborative editing with cursor tracking and syntax highlighting
 */

import { EventEmitter } from 'events';
import {
  CursorPosition,
  TextSelection,
  OperationalTransform,
  TransformType,
  DocumentState,
  User,
  Permission
} from '../types.js';
import { CRDTOperationalTransform } from '../crdt/OperationalTransform.js';

export interface EditorDocument {
  id: string;
  sessionId: string;
  name: string;
  content: string;
  language: string;
  version: number;
  lastModified: Date;
  modifiedBy: string;
  cursors: Map<string, CursorPosition>;
  selections: Map<string, TextSelection>;
  syntaxHighlighting: SyntaxHighlightData;
  outline: DocumentOutline;
  diagnostics: Diagnostic[];
}

export interface SyntaxHighlightData {
  tokens: SyntaxToken[];
  version: number;
  updatedAt: Date;
}

export interface SyntaxToken {
  start: { line: number; column: number };
  end: { line: number; column: number };
  type: string;
  style: TokenStyle;
}

export interface TokenStyle {
  color: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
}

export interface DocumentOutline {
  symbols: DocumentSymbol[];
  version: number;
  updatedAt: Date;
}

export interface DocumentSymbol {
  name: string;
  kind: SymbolKind;
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  children?: DocumentSymbol[];
  detail?: string;
}

export interface Diagnostic {
  id: string;
  severity: DiagnosticSeverity;
  message: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  source: string;
  code?: string | number;
  tags?: DiagnosticTag[];
}

export enum SymbolKind {
  FILE = 1,
  MODULE = 2,
  NAMESPACE = 3,
  PACKAGE = 4,
  CLASS = 5,
  METHOD = 6,
  PROPERTY = 7,
  FIELD = 8,
  CONSTRUCTOR = 9,
  ENUM = 10,
  INTERFACE = 11,
  FUNCTION = 12,
  VARIABLE = 13,
  CONSTANT = 14,
  STRING = 15,
  NUMBER = 16,
  BOOLEAN = 17,
  ARRAY = 18,
  OBJECT = 19,
  KEY = 20,
  NULL = 21,
  ENUM_MEMBER = 22,
  STRUCT = 23,
  EVENT = 24,
  OPERATOR = 25,
  TYPE_PARAMETER = 26
}

export enum DiagnosticSeverity {
  ERROR = 1,
  WARNING = 2,
  INFORMATION = 3,
  HINT = 4
}

export enum DiagnosticTag {
  UNNECESSARY = 1,
  DEPRECATED = 2
}

export interface EditorOperation {
  type: 'insert' | 'delete' | 'replace' | 'format';
  position: { line: number; column: number };
  length?: number;
  content?: string;
  userId: string;
  timestamp: Date;
}

export interface EditorState {
  documents: Map<string, EditorDocument>;
  activeDocument?: string;
  users: Map<string, UserEditorState>;
  version: number;
}

export interface UserEditorState {
  userId: string;
  cursor?: CursorPosition;
  selection?: TextSelection;
  activeDocument?: string;
  permissions: Permission[];
  lastActivity: Date;
  preferences: EditorPreferences;
}

export interface EditorPreferences {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  theme: 'light' | 'dark' | 'high-contrast';
  fontFamily: string;
  autoSave: boolean;
  autoSaveDelay: number;
}

/**
 * Shared Code Editor Manager
 * Handles real-time collaborative editing with CRDT operations
 */
export class SharedCodeEditor extends EventEmitter {
  private sessions: Map<string, EditorState> = new Map();
  private crdtEngines: Map<string, CRDTOperationalTransform> = new Map();
  private syntaxHighlighters: Map<string, SyntaxHighlighter> = new Map();
  private linters: Map<string, Linter> = new Map();

  constructor() {
    super();
    this.initializeLanguageServices();
  }

  /**
   * Create a new editor document
   */
  public async createDocument(
    sessionId: string,
    config: {
      name: string;
      content?: string;
      language?: string;
    }
  ): Promise<EditorDocument> {
    let sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      sessionState = {
        documents: new Map(),
        users: new Map(),
        version: 1
      };
      this.sessions.set(sessionId, sessionState);

      // Create CRDT engine for this session
      const crdt = new CRDTOperationalTransform(sessionId);
      this.crdtEngines.set(sessionId, crdt);
    }

    const documentId = this.generateDocumentId();

    // Create CRDT document
    const crdt = this.crdtEngines.get(sessionId)!;
    const crdtDocument = crdt.createDocument(documentId, config.content || '');

    const document: EditorDocument = {
      id: documentId,
      sessionId,
      name: config.name,
      content: config.content || '',
      language: config.language || this.detectLanguage(config.name),
      version: 1,
      lastModified: new Date(),
      modifiedBy: 'system',
      cursors: new Map(),
      selections: new Map(),
      syntaxHighlighting: {
        tokens: [],
        version: 1,
        updatedAt: new Date()
      },
      outline: {
        symbols: [],
        version: 1,
        updatedAt: new Date()
      },
      diagnostics: []
    };

    sessionState.documents.set(documentId, document);
    sessionState.activeDocument = documentId;

    // Perform initial syntax highlighting and analysis
    await this.updateSyntaxHighlighting(document);
    await this.updateDocumentOutline(document);
    await this.runDiagnostics(document);

    this.emit('documentCreated', { sessionId, document });
    return document;
  }

  /**
   * Apply editor operation
   */
  public async applyOperation(
    sessionId: string,
    documentId: string,
    operation: EditorOperation,
    userId: string
  ): Promise<{ success: boolean; conflicts?: any; document?: EditorDocument }> {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const document = sessionState.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const userState = sessionState.users.get(userId);
    if (!userState || !userState.permissions.includes(Permission.WRITE)) {
      throw new Error('No write permission');
    }

    const crdt = this.crdtEngines.get(sessionId);
    if (!crdt) {
      throw new Error(`CRDT engine not found for session ${sessionId}`);
    }

    try {
      // Convert editor operation to CRDT operation
      const crdtOperation = this.convertToCRDTOperation(operation, documentId);

      // Apply CRDT operation
      const result = crdt.applyOperation(documentId, crdtOperation);

      if (result.success) {
        // Update document state
        document.content = crdt.getDocument(documentId)?.text || document.content;
        document.version++;
        document.lastModified = new Date();
        document.modifiedBy = userId;

        // Update analysis
        await this.updateSyntaxHighlighting(document);
        await this.updateDocumentOutline(document);
        await this.runDiagnostics(document);

        // Update user activity
        userState.lastActivity = new Date();

        this.emit('operationApplied', {
          sessionId,
          documentId,
          operation,
          userId,
          document,
          conflicts: result.conflicts
        });

        return {
          success: true,
          conflicts: result.conflicts,
          document
        };
      } else {
        return {
          success: false,
          conflicts: result.conflicts
        };
      }
    } catch (error) {
      this.emit('operationError', {
        sessionId,
        documentId,
        operation,
        userId,
        error
      });
      throw error;
    }
  }

  /**
   * Update cursor position
   */
  public updateCursor(
    sessionId: string,
    documentId: string,
    userId: string,
    position: CursorPosition
  ): void {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      return;
    }

    const document = sessionState.documents.get(documentId);
    if (!document) {
      return;
    }

    // Update cursor in document
    document.cursors.set(userId, {
      ...position,
      userId,
      timestamp: new Date(),
      visible: true
    });

    // Update user state
    let userState = sessionState.users.get(userId);
    if (!userState) {
      userState = {
        userId,
        permissions: [Permission.READ],
        lastActivity: new Date(),
        preferences: this.getDefaultPreferences()
      };
      sessionState.users.set(userId, userState);
    }

    userState.cursor = position;
    userState.activeDocument = documentId;
    userState.lastActivity = new Date();

    this.emit('cursorUpdated', {
      sessionId,
      documentId,
      userId,
      position
    });
  }

  /**
   * Update text selection
   */
  public updateSelection(
    sessionId: string,
    documentId: string,
    userId: string,
    selection: TextSelection
  ): void {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      return;
    }

    const document = sessionState.documents.get(documentId);
    if (!document) {
      return;
    }

    // Update selection in document
    document.selections.set(userId, {
      ...selection,
      userId,
      timestamp: new Date()
    });

    // Update user state
    const userState = sessionState.users.get(userId);
    if (userState) {
      userState.selection = selection;
      userState.lastActivity = new Date();
    }

    this.emit('selectionUpdated', {
      sessionId,
      documentId,
      userId,
      selection
    });
  }

  /**
   * Get document
   */
  public getDocument(sessionId: string, documentId: string): EditorDocument | null {
    const sessionState = this.sessions.get(sessionId);
    return sessionState?.documents.get(documentId) || null;
  }

  /**
   * Get all documents for session
   */
  public getDocuments(sessionId: string): EditorDocument[] {
    const sessionState = this.sessions.get(sessionId);
    return sessionState ? Array.from(sessionState.documents.values()) : [];
  }

  /**
   * Get active document
   */
  public getActiveDocument(sessionId: string): EditorDocument | null {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState || !sessionState.activeDocument) {
      return null;
    }

    return sessionState.documents.get(sessionState.activeDocument) || null;
  }

  /**
   * Set active document
   */
  public setActiveDocument(sessionId: string, documentId: string, userId: string): void {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      return;
    }

    const document = sessionState.documents.get(documentId);
    if (!document) {
      return;
    }

    sessionState.activeDocument = documentId;

    // Update user state
    let userState = sessionState.users.get(userId);
    if (!userState) {
      userState = {
        userId,
        permissions: [Permission.READ],
        lastActivity: new Date(),
        preferences: this.getDefaultPreferences()
      };
      sessionState.users.set(userId, userState);
    }

    userState.activeDocument = documentId;
    userState.lastActivity = new Date();

    this.emit('activeDocumentChanged', {
      sessionId,
      documentId,
      userId
    });
  }

  /**
   * Format document
   */
  public async formatDocument(
    sessionId: string,
    documentId: string,
    userId: string,
    options?: FormattingOptions
  ): Promise<EditorDocument> {
    const document = this.getDocument(sessionId, documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const sessionState = this.sessions.get(sessionId);
    const userState = sessionState?.users.get(userId);
    if (!userState?.permissions.includes(Permission.EDIT)) {
      throw new Error('No edit permission');
    }

    // Format the document content
    const formattedContent = await this.formatCode(document.content, document.language, options);

    if (formattedContent !== document.content) {
      // Apply formatting as a replace operation
      await this.applyOperation(sessionId, documentId, {
        type: 'replace',
        position: { line: 0, column: 0 },
        length: document.content.length,
        content: formattedContent,
        userId,
        timestamp: new Date()
      }, userId);
    }

    return this.getDocument(sessionId, documentId)!;
  }

  /**
   * Update user permissions
   */
  public updateUserPermissions(
    sessionId: string,
    userId: string,
    permissions: Permission[]
  ): void {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      return;
    }

    let userState = sessionState.users.get(userId);
    if (!userState) {
      userState = {
        userId,
        permissions,
        lastActivity: new Date(),
        preferences: this.getDefaultPreferences()
      };
      sessionState.users.set(userId, userState);
    } else {
      userState.permissions = permissions;
    }

    this.emit('userPermissionsUpdated', {
      sessionId,
      userId,
      permissions
    });
  }

  /**
   * Get user state
   */
  public getUserState(sessionId: string, userId: string): UserEditorState | null {
    const sessionState = this.sessions.get(sessionId);
    return sessionState?.users.get(userId) || null;
  }

  /**
   * Get all users in session
   */
  public getUsers(sessionId: string): UserEditorState[] {
    const sessionState = this.sessions.get(sessionId);
    return sessionState ? Array.from(sessionState.users.values()) : [];
  }

  /**
   * Update user preferences
   */
  public updateUserPreferences(
    sessionId: string,
    userId: string,
    preferences: Partial<EditorPreferences>
  ): UserEditorState {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session ${sessionId} not found`);
    }

    let userState = sessionState.users.get(userId);
    if (!userState) {
      userState = {
        userId,
        permissions: [Permission.READ],
        lastActivity: new Date(),
        preferences: this.getDefaultPreferences()
      };
      sessionState.users.set(userId, userState);
    }

    userState.preferences = { ...userState.preferences, ...preferences };

    this.emit('userPreferencesUpdated', {
      sessionId,
      userId,
      preferences: userState.preferences
    });

    return userState;
  }

  /**
   * Search in document
   */
  public searchInDocument(
    sessionId: string,
    documentId: string,
    query: string,
    options?: SearchOptions
  ): SearchResult[] {
    const document = this.getDocument(sessionId, documentId);
    if (!document) {
      return [];
    }

    const results: SearchResult[] = [];
    const lines = document.content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const regex = new RegExp(
        options?.regex ? query : this.escapeRegex(query),
        options?.caseSensitive ? 'g' : 'gi'
      );

      let match;
      while ((match = regex.exec(line)) !== null) {
        results.push({
          range: {
            start: { line: lineIndex, column: match.index },
            end: { line: lineIndex, column: match.index + match[0].length }
          },
          text: match[0],
          lineText: line,
          lineNumber: lineIndex
        });
      }
    }

    return results;
  }

  // Private methods

  private initializeLanguageServices(): void {
    // Initialize syntax highlighters for different languages
    this.syntaxHighlighters.set('javascript', new JavaScriptHighlighter());
    this.syntaxHighlighters.set('typescript', new TypeScriptHighlighter());
    this.syntaxHighlighters.set('python', new PythonHighlighter());
    this.syntaxHighlighters.set('java', new JavaHighlighter());
    this.syntaxHighlighters.set('cpp', new CppHighlighter());
    this.syntaxHighlighters.set('html', new HTMLHighlighter());
    this.syntaxHighlighters.set('css', new CSSHighlighter());

    // Initialize linters
    this.linters.set('javascript', new ESLinter());
    this.linters.set('typescript', new TypeScriptLinter());
    this.linters.set('python', new PythonLinter());
  }

  private async updateSyntaxHighlighting(document: EditorDocument): Promise<void> {
    const highlighter = this.syntaxHighlighters.get(document.language);
    if (!highlighter) {
      return;
    }

    const tokens = await highlighter.highlight(document.content);
    document.syntaxHighlighting = {
      tokens,
      version: document.syntaxHighlighting.version + 1,
      updatedAt: new Date()
    };
  }

  private async updateDocumentOutline(document: EditorDocument): Promise<void> {
    // Simple outline extraction - in production, use proper language server
    const symbols = this.extractSymbols(document.content, document.language);
    document.outline = {
      symbols,
      version: document.outline.version + 1,
      updatedAt: new Date()
    };
  }

  private async runDiagnostics(document: EditorDocument): Promise<void> {
    const linter = this.linters.get(document.language);
    if (!linter) {
      return;
    }

    const diagnostics = await linter.lint(document.content);
    document.diagnostics = diagnostics;
  }

  private convertToCRDTOperation(operation: EditorOperation, documentId: string): any {
    const position = this.lineColumnToOffset(operation.position.line, operation.position.column);

    switch (operation.type) {
      case 'insert':
        return {
          type: TransformType.INSERT,
          position,
          content: operation.content,
          documentId
        };
      case 'delete':
        return {
          type: TransformType.DELETE,
          position,
          length: operation.length,
          documentId
        };
      case 'replace':
        return {
          type: TransformType.REPLACE,
          position,
          length: operation.length,
          content: operation.content,
          documentId
        };
      case 'format':
        return {
          type: TransformType.FORMAT,
          position,
          attributes: operation.content ? JSON.parse(operation.content) : {},
          documentId
        };
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private lineColumnToOffset(line: number, column: number): number {
    // Simplified conversion - in production, use proper line/column logic
    return line * 100 + column;
  }

  private detectLanguage(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'cpp',
      'h': 'cpp',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'css',
      'sass': 'css'
    };

    return languageMap[extension || ''] || 'plaintext';
  }

  private async formatCode(
    content: string,
    language: string,
    options?: FormattingOptions
  ): Promise<string> {
    // Simplified formatting - in production, use proper formatters like Prettier
    if (language === 'javascript' || language === 'typescript') {
      try {
        // Basic formatting for demo purposes
        return content
          .replace(/;/g, ';\n')
          .replace(/\{/g, ' {\n  ')
          .replace(/\}/g, '\n}')
          .replace(/\n\s*\n/g, '\n');
      } catch {
        return content;
      }
    }

    return content;
  }

  private extractSymbols(content: string, language: string): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];

    // Simple symbol extraction - in production, use proper AST parsing
    if (language === 'javascript' || language === 'typescript') {
      const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))?/g;
      const classRegex = /class\s+(\w+)/g;
      const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g;

      let match;
      while ((match = functionRegex.exec(content)) !== null) {
        symbols.push({
          name: match[1],
          kind: SymbolKind.FUNCTION,
          location: {
            start: { line: 0, column: match.index },
            end: { line: 0, column: match.index + match[0].length }
          }
        });
      }

      while ((match = classRegex.exec(content)) !== null) {
        symbols.push({
          name: match[1],
          kind: SymbolKind.CLASS,
          location: {
            start: { line: 0, column: match.index },
            end: { line: 0, column: match.index + match[0].length }
          }
        });
      }
    }

    return symbols;
  }

  private escapeRegex(query: string): string {
    return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getDefaultPreferences(): EditorPreferences {
    return {
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      lineNumbers: true,
      minimap: true,
      theme: 'dark',
      fontFamily: 'Consolas, Monaco, monospace',
      autoSave: true,
      autoSaveDelay: 1000
    };
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting interfaces

export interface FormattingOptions {
  tabSize?: number;
  insertSpaces?: boolean;
  semicolons?: boolean;
  quotes?: 'single' | 'double';
  trailingComma?: boolean;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
}

export interface SearchResult {
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  text: string;
  lineText: string;
  lineNumber: number;
}

// Placeholder classes for language services

class SyntaxHighlighter {
  async highlight(content: string): Promise<SyntaxToken[]> {
    return [];
  }
}

class JavaScriptHighlighter extends SyntaxHighlighter {}
class TypeScriptHighlighter extends SyntaxHighlighter {}
class PythonHighlighter extends SyntaxHighlighter {}
class JavaHighlighter extends SyntaxHighlighter {}
class CppHighlighter extends SyntaxHighlighter {}
class HTMLHighlighter extends SyntaxHighlighter {}
class CSSHighlighter extends SyntaxHighlighter {}

class Linter {
  async lint(content: string): Promise<Diagnostic[]> {
    return [];
  }
}

class ESLinter extends Linter {}
class TypeScriptLinter extends Linter {}
class PythonLinter extends Linter {}