// Global Zustand State Store for Chat Rooms, Messages, and Optimistic UI

import { create } from 'zustand';
import type { RoomRecord, MessageRecord } from '../types/db';
import { dbService, decryptMessages } from '../db';
import { wsRelay, type ConnectionStatus } from '../services/websocket';
import { cryptoWorker } from '../crypto/worker-client';

interface ChatState {
  rooms: RoomRecord[];
  activeRoomId: string | null;
  messages: Array<MessageRecord & { decryptedContent: string }>;
  typingUsers: Record<string, string[]>; // roomId -> array of usernames typing
  onlineUsers: Set<string>;
  connectionStatus: ConnectionStatus;

  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  loadRooms: () => void;
  selectRoom: (roomId: string) => Promise<void>;
  sendMessageOptimistic: (text: string, recipientId?: string, isGroup?: boolean) => Promise<void>;
  markRoomAsRead: (roomId: string) => Promise<void>;
  setTyping: (roomId: string, isTyping: boolean, currentUsername: string) => void;
  updateMessageStatus: (messageId: string, status: MessageRecord['status']) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  activeRoomId: null,
  messages: [],
  typingUsers: {},
  onlineUsers: new Set(),
  connectionStatus: 'DISCONNECTED',

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  loadRooms: async () => {
    const rooms = await dbService.getAllRooms();
    set({ rooms });
  },

  selectRoom: async (roomId: string) => {
    set({ activeRoomId: roomId });
    const rawMsgs = await dbService.getRoomMessages(roomId, 100);
    const decrypted = await decryptMessages(rawMsgs);
    set({ messages: decrypted.reverse() });

    // Mark unread messages as read (Triggers Glowing House Receipt)
    await get().markRoomAsRead(roomId);
  },

  sendMessageOptimistic: async (text: string, recipientId?: string, isGroup = false) => {
    const { activeRoomId, messages } = get();
    if (!activeRoomId || !text.trim()) return;

    const clientMsgId = crypto.randomUUID();
    const now = Date.now();

    // 1. Encrypt message locally for IndexedDB storage
    const encryptedContent = await cryptoWorker.encryptRecord(text);

    // 2. Optimistic local message record (Status = 'pending' -> Clock Icon)
    const optimisticMsg: MessageRecord & { decryptedContent: string } = {
      id: clientMsgId,
      roomId: activeRoomId,
      senderId: 'me',
      senderUsername: 'me',
      content: encryptedContent,
      decryptedContent: text,
      status: 'pending', // Clock icon
      isEdited: false,
      createdAt: now,
    };

    // Update UI immediately (Never block on network!)
    set({ messages: [...messages, optimisticMsg] });

    // Persist to IndexedDB
    await dbService.saveMessage(optimisticMsg);

    // 3. Encrypt envelope with recipient's Double Ratchet
    let envelope;
    try {
      if (recipientId) {
        envelope = await cryptoWorker.ratchetEncrypt(recipientId, text);
      }
    } catch {
      // If no ratchet exists yet, create dummy envelope to queue in outbox
      envelope = {
        type: 'WHISPER' as const,
        senderUserId: 'me',
        senderUsername: 'me',
        senderDeviceId: 1,
        ciphertext: encryptedContent,
        sequence: 1,
      };
    }

    // 4. Save to Outbox queue for guaranteed delivery
    await dbService.enqueueOutbox({
      id: clientMsgId,
      roomId: activeRoomId,
      recipientId,
      isGroup,
      envelopeJson: JSON.stringify(envelope),
      clientTimestamp: now,
      retryCount: 0,
      nextRetryAt: now,
      createdAt: now,
    });

    // 5. Attempt immediate transmission over WebSocket relay
    const sent = wsRelay.send({
      type: 'SEND_MESSAGE',
      payload: {
        clientMsgId,
        roomId: activeRoomId,
        recipientId,
        isGroup,
        envelope,
      },
      timestamp: now,
    });

    if (sent) {
      console.log('[Chat] Sent frame over WebSocket. Waiting for Outline House ACK.');
    } else {
      console.log('[Chat] WebSocket not open. Message safely queued in IndexedDB Outbox.');
    }
  },

  markRoomAsRead: async (roomId: string) => {
    const { messages } = get();
    for (const m of messages) {
      if (m.senderId !== 'me' && m.status !== 'read') {
        await dbService.updateMessageStatus(m.id, 'read');
        wsRelay.send({
          type: 'DELIVERY_RECEIPT',
          payload: {
            roomId,
            messageId: m.id,
            status: 'READ',
            senderId: m.senderId,
            readerId: 'me',
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
      }
    }
  },

  setTyping: (roomId: string, isTyping: boolean, currentUsername: string) => {
    wsRelay.send({
      type: 'TYPING',
      payload: {
        roomId,
        userId: 'me',
        username: currentUsername,
        isTyping,
      },
      timestamp: Date.now(),
    });
  },

  updateMessageStatus: (messageId: string, status: MessageRecord['status']) => {
    const { messages } = get();
    const updated = messages.map((m) => (m.id === messageId ? { ...m, status } : m));
    set({ messages: updated });
  },
}));
