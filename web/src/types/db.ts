// Local Dexie.js Database Schemas

export interface IdentityRecord {
  id: string; // 'current_user'
  userId: string;
  username: string;
  registrationId: number;
  identityKeyPair: string; // Encrypted Base64 JSON
  signedPrekey: string;    // Encrypted Base64 JSON
  createdAt: number;
}

export interface SessionRecord {
  contactId: string;       // User ID of remote peer
  contactUsername: string;
  sessionState: string;    // Encrypted Base64 Double Ratchet state
  updatedAt: number;
}

export interface ContactRecord {
  userId: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  identityKey: string;     // Base64 Identity Public Key
  safetyNumber?: string;   // 60-digit fingerprint
  isVerified: boolean;
  requestStatus: 'accepted' | 'pending' | 'blocked';
  createdAt: number;
}

export interface RoomRecord {
  id: string;              // UUID
  type: 'direct' | 'group';
  name?: string;           // Encrypted if group title
  avatarUrl?: string;
  participantIds: string[];
  unreadCount: number;
  lastMessageId?: string;
  lastMessagePreview?: string; // Encrypted
  lastMessageTimestamp: number;
  isPinned: boolean;
  isArchived: boolean;
  mutedUntil?: number;
  disappearingTimerSeconds: number; // 0 = disabled
  folderId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRecord {
  id: string;              // Client UUID
  roomId: string;
  seqId?: number;          // Server monotonic sequence ID
  senderId: string;
  senderUsername: string;
  content: string;         // Encrypted Base64 text
  mediaId?: string;
  replyToId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: Record<string, string[]>; // emoji -> array of usernames
  isEdited: boolean;
  editedAt?: number;
  expiresAt?: number;      // Disappearing message deletion timestamp
  createdAt: number;
}

export interface MediaRecord {
  id: string;              // UUID
  roomId: string;
  messageId: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  blurHash?: string;
  encryptionKey: string;   // Encrypted Base64 256-bit AES key
  localBlob?: Blob | ArrayBuffer;
  remoteUrl?: string;
  createdAt: number;
}

export interface OutboxRecord {
  id: string;              // Client Msg UUID
  roomId: string;
  recipientId?: string;    // empty if group
  isGroup: boolean;
  envelopeJson: string;    // SignalEnvelopeData
  clientTimestamp: number;
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
}

export interface SettingsRecord {
  key: string;             // 'general', 'theme', 'privacy'
  value: any;
}
