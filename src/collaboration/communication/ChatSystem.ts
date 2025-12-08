/**
 * Integrated Chat and Communication System
 * Real-time messaging, voice/video calls, and screen sharing
 */

import { EventEmitter } from 'events';
import {
  ChatMessage,
  MessageType,
  VoiceCall,
  CallType,
  CallStatus,
  CallQuality,
  MessageReaction,
  MessageAttachment
} from '../types.js';

export interface ChatMessagePayload {
  sessionId: string;
  authorId: string;
  content: string;
  type: MessageType;
  attachments?: MessageAttachment[];
  threadId?: string;
  replyToId?: string;
  mentions?: string[];
  priority?: 'low' | 'medium' | 'high';
}

export interface VoiceCallPayload {
  sessionId: string;
  type: CallType;
  participants: string[];
  configuration?: CallConfiguration;
}

export interface CallConfiguration {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled: boolean;
  quality: 'low' | 'medium' | 'high';
  recordingEnabled: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  mentionsOnly: boolean;
  doNotDisturb: boolean;
}

/**
 * Comprehensive chat and communication system
 */
export class ChatSystem extends EventEmitter {
  private messages: Map<string, ChatMessage[]> = new Map();
  private calls: Map<string, VoiceCall> = new Map();
  private notifications: Map<string, NotificationSettings> = new Map();
  private threads: Map<string, string[]> = new Map(); // threadId -> messageIds
  private typingIndicators: Map<string, Set<string>> = new Map(); // sessionId -> userIds

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Send a chat message
   */
  public async sendMessage(payload: ChatMessagePayload): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      sessionId: payload.sessionId,
      authorId: payload.authorId,
      content: payload.content,
      type: payload.type || MessageType.TEXT,
      timestamp: new Date(),
      metadata: {
        edited: false,
        pinned: false,
        priority: payload.priority || 'medium',
        attachments: payload.attachments || []
      },
      threadId: payload.threadId,
      reactions: []
    };

    // Store message
    const sessionMessages = this.messages.get(payload.sessionId) || [];
    sessionMessages.push(message);
    this.messages.set(payload.sessionId, sessionMessages);

    // Add to thread if applicable
    if (payload.threadId) {
      const threadMessages = this.threads.get(payload.threadId) || [];
      threadMessages.push(message.id);
      this.threads.set(payload.threadId, threadMessages);
    }

    // Handle mentions
    if (payload.mentions && payload.mentions.length > 0) {
      this.handleMentions(payload.mentions, message);
    }

    // Clear typing indicator for sender
    this.clearTypingIndicator(payload.sessionId, payload.authorId);

    this.emit('messageSent', message);
    return message;
  }

  /**
   * Edit a message
   */
  public async editMessage(
    messageId: string,
    newContent: string,
    authorId: string
  ): Promise<ChatMessage> {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (message.authorId !== authorId) {
      throw new Error('Not authorized to edit this message');
    }

    message.content = newContent;
    message.metadata.edited = true;
    message.metadata.editedAt = new Date();

    this.emit('messageEdited', message);
    return message;
  }

  /**
   * Delete a message
   */
  public async deleteMessage(messageId: string, authorId: string): Promise<void> {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (message.authorId !== authorId) {
      throw new Error('Not authorized to delete this message');
    }

    // Remove from session messages
    const sessionMessages = this.messages.get(message.sessionId) || [];
    const index = sessionMessages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      sessionMessages.splice(index, 1);
      this.messages.set(message.sessionId, sessionMessages);
    }

    // Remove from thread if applicable
    if (message.threadId) {
      const threadMessages = this.threads.get(message.threadId) || [];
      const threadIndex = threadMessages.indexOf(messageId);
      if (threadIndex !== -1) {
        threadMessages.splice(threadIndex, 1);
        this.threads.set(message.threadId, threadMessages);
      }
    }

    this.emit('messageDeleted', { messageId, sessionId: message.sessionId });
  }

  /**
   * Add reaction to message
   */
  public async addReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<ChatMessage> {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    const existingReaction = message.reactions?.find(r => r.emoji === emoji && r.userId === userId);

    if (!existingReaction) {
      if (!message.reactions) {
        message.reactions = [];
      }

      message.reactions.push({
        emoji,
        userId,
        timestamp: new Date()
      });

      this.emit('reactionAdded', { messageId, emoji, userId });
    }

    return message;
  }

  /**
   * Remove reaction from message
   */
  public async removeReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<ChatMessage> {
    const message = this.findMessageById(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (message.reactions) {
      const index = message.reactions.findIndex(r => r.emoji === emoji && r.userId === userId);
      if (index !== -1) {
        message.reactions.splice(index, 1);
        this.emit('reactionRemoved', { messageId, emoji, userId });
      }
    }

    return message;
  }

  /**
   * Start a voice/video call
   */
  public async startCall(payload: VoiceCallPayload): Promise<VoiceCall> {
    const call: VoiceCall = {
      id: this.generateCallId(),
      sessionId: payload.sessionId,
      participants: payload.participants,
      type: payload.type,
      status: CallStatus.RINGING,
      startedAt: new Date(),
      quality: {
        audio: { bitrate: 0, latency: 0, packetLoss: 0, quality: 'good' },
        video: { bitrate: 0, latency: 0, packetLoss: 0, quality: 'good' },
        connection: { bitrate: 0, latency: 0, packetLoss: 0, quality: 'good' }
      }
    };

    this.calls.set(call.id, call);

    this.emit('callStarted', call);
    return call;
  }

  /**
   * Join a call
   */
  public async joinCall(callId: string, userId: string): Promise<VoiceCall> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    if (call.participants.includes(userId)) {
      return call;
    }

    call.participants.push(userId);

    // If this is the first participant joining after ringing, start the call
    if (call.status === CallStatus.RINGING && call.participants.length > 1) {
      call.status = CallStatus.ACTIVE;
    }

    this.emit('callJoined', { callId, userId, call });
    return call;
  }

  /**
   * Leave a call
   */
  public async leaveCall(callId: string, userId: string): Promise<VoiceCall> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    const index = call.participants.indexOf(userId);
    if (index !== -1) {
      call.participants.splice(index, 1);
    }

    // End call if no participants left
    if (call.participants.length === 0) {
      call.status = CallStatus.ENDED;
      call.endedAt = new Date();
    }

    this.emit('callLeft', { callId, userId, call });
    return call;
  }

  /**
   * End a call
   */
  public async endCall(callId: string, userId: string): Promise<VoiceCall> {
    const call = this.calls.get(callId);
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }

    call.status = CallStatus.ENDED;
    call.endedAt = new Date();

    this.emit('callEnded', { callId, userId, call });
    return call;
  }

  /**
   * Update call quality metrics
   */
  public updateCallQuality(
    callId: string,
    metrics: Partial<CallQuality>
  ): void {
    const call = this.calls.get(callId);
    if (!call) {
      return;
    }

    if (metrics.audio) {
      call.quality.audio = { ...call.quality.audio, ...metrics.audio };
    }
    if (metrics.video) {
      call.quality.video = { ...call.quality.video, ...metrics.video };
    }
    if (metrics.connection) {
      call.quality.connection = { ...call.quality.connection, ...metrics.connection };
    }

    this.emit('callQualityUpdated', { callId, call, metrics });
  }

  /**
   * Show typing indicator
   */
  public showTypingIndicator(sessionId: string, userId: string): void {
    const sessionTyping = this.typingIndicators.get(sessionId) || new Set();
    sessionTyping.add(userId);
    this.typingIndicators.set(sessionId, sessionTyping);

    this.emit('typingIndicator', { sessionId, userId, isTyping: true });

    // Auto-clear after 3 seconds of inactivity
    setTimeout(() => {
      this.clearTypingIndicator(sessionId, userId);
    }, 3000);
  }

  /**
   * Clear typing indicator
   */
  public clearTypingIndicator(sessionId: string, userId: string): void {
    const sessionTyping = this.typingIndicators.get(sessionId);
    if (sessionTyping) {
      sessionTyping.delete(userId);
      if (sessionTyping.size === 0) {
        this.typingIndicators.delete(sessionId);
      } else {
        this.typingIndicators.set(sessionId, sessionTyping);
      }
    }

    this.emit('typingIndicator', { sessionId, userId, isTyping: false });
  }

  /**
   * Get typing users for session
   */
  public getTypingUsers(sessionId: string): string[] {
    const sessionTyping = this.typingIndicators.get(sessionId);
    return sessionTyping ? Array.from(sessionTyping) : [];
  }

  /**
   * Get messages for session
   */
  public getMessages(
    sessionId: string,
    limit?: number,
    before?: Date,
    threadId?: string
  ): ChatMessage[] {
    let messages = this.messages.get(sessionId) || [];

    // Filter by thread if specified
    if (threadId) {
      const threadMessageIds = this.threads.get(threadId) || [];
      messages = messages.filter(m => threadMessageIds.includes(m.id));
    }

    // Filter by date if specified
    if (before) {
      messages = messages.filter(m => m.timestamp < before);
    }

    // Sort by timestamp descending
    messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (limit) {
      messages = messages.slice(0, limit);
    }

    return messages;
  }

  /**
   * Get message by ID
   */
  public getMessage(messageId: string): ChatMessage | null {
    return this.findMessageById(messageId);
  }

  /**
   * Search messages
   */
  public searchMessages(
    sessionId: string,
    query: string,
    options?: {
      authorId?: string;
      messageType?: MessageType;
      dateRange?: { start: Date; end: Date };
    }
  ): ChatMessage[] {
    const messages = this.messages.get(sessionId) || [];
    const lowercaseQuery = query.toLowerCase();

    return messages.filter(message => {
      // Content search
      const contentMatch = message.content.toLowerCase().includes(lowercaseQuery);

      // Author filter
      const authorMatch = !options?.authorId || message.authorId === options.authorId;

      // Message type filter
      const typeMatch = !options?.messageType || message.type === options.messageType;

      // Date range filter
      let dateMatch = true;
      if (options?.dateRange) {
        dateMatch = message.timestamp >= options.dateRange.start &&
                   message.timestamp <= options.dateRange.end;
      }

      return contentMatch && authorMatch && typeMatch && dateMatch;
    });
  }

  /**
   * Get active calls for session
   */
  public getActiveCalls(sessionId: string): VoiceCall[] {
    return Array.from(this.calls.values())
      .filter(call => call.sessionId === sessionId && call.status === CallStatus.ACTIVE);
  }

  /**
   * Get call by ID
   */
  public getCall(callId: string): VoiceCall | null {
    return this.calls.get(callId) || null;
  }

  /**
   * Update notification settings
   */
  public updateNotificationSettings(
    userId: string,
    settings: Partial<NotificationSettings>
  ): NotificationSettings {
    const currentSettings = this.notifications.get(userId) || {
      enabled: true,
      soundEnabled: true,
      desktopEnabled: true,
      mentionsOnly: false,
      doNotDisturb: false
    };

    const updatedSettings = { ...currentSettings, ...settings };
    this.notifications.set(userId, updatedSettings);

    this.emit('notificationSettingsUpdated', { userId, settings: updatedSettings });
    return updatedSettings;
  }

  /**
   * Get notification settings
   */
  public getNotificationSettings(userId: string): NotificationSettings {
    return this.notifications.get(userId) || {
      enabled: true,
      soundEnabled: true,
      desktopEnabled: true,
      mentionsOnly: false,
      doNotDisturb: false
    };
  }

  // Private methods

  private setupEventHandlers(): void {
    // Cleanup old calls periodically
    setInterval(() => {
      this.cleanupOldCalls();
    }, 60000); // Check every minute
  }

  private handleMentions(mentions: string[], message: ChatMessage): void {
    for (const userId of mentions) {
      const settings = this.getNotificationSettings(userId);

      if (!settings.doNotDisturb && settings.enabled) {
        this.emit('userMentioned', {
          userId,
          message,
          shouldNotify: !settings.mentionsOnly
        });
      }
    }
  }

  private findMessageById(messageId: string): ChatMessage | null {
    for (const messages of this.messages.values()) {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        return message;
      }
    }
    return null;
  }

  private cleanupOldCalls(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [callId, call] of this.calls.entries()) {
      if (call.status === CallStatus.ENDED &&
          call.endedAt &&
          call.endedAt < cutoff) {
        this.calls.delete(callId);
      }
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}