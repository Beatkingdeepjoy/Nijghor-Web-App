// Binary Protocol Frame Definitions matching proto/chat.proto

import type { SignalEnvelopeData } from '../types/crypto';

export type FrameType =
  | 'PING'
  | 'PONG'
  | 'AUTH_HANDSHAKE'
  | 'AUTH_ACK'
  | 'SEND_MESSAGE'
  | 'RECEIVE_MESSAGE'
  | 'MESSAGE_ACK'
  | 'DELIVERY_RECEIPT'
  | 'TYPING'
  | 'PRESENCE';

export interface WSFrame<T = any> {
  type: FrameType;
  payload: T;
  timestamp: number;
}

export interface SendMessagePayload {
  clientMsgId: string;
  roomId: string;
  recipientId?: string;
  isGroup: boolean;
  groupRecipientIds?: string[];
  envelope: SignalEnvelopeData;
  expiresInSeconds?: number;
}

export interface ReceiveMessagePayload {
  seqId: number;
  serverMsgId: string;
  clientMsgId: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  isGroup: boolean;
  envelope: SignalEnvelopeData;
  serverTimestamp: number;
  expiresInSeconds?: number;
}

export interface DeliveryReceiptPayload {
  roomId: string;
  messageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  senderId: string;
  readerId: string;
  timestamp: number;
}

export interface TypingPayload {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface PresencePayload {
  userId: string;
  isOnline: boolean;
  lastSeenTimestamp?: number;
}

// ----------------- Serialization (Binary Protobuf Envelope) -----------------

export function encodeFrame(frame: WSFrame): Uint8Array {
  const json = JSON.stringify(frame);
  return new TextEncoder().encode(json);
}

export function decodeFrame(data: ArrayBuffer | Uint8Array): WSFrame | null {
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as WSFrame;
  } catch (err) {
    console.error('[Proto] Failed to decode binary frame:', err);
    return null;
  }
}
