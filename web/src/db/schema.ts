// Dexie.js Encrypted Local Database Schema for Nijghor

import Dexie, { type Table } from 'dexie';
import type {
  IdentityRecord,
  SessionRecord,
  ContactRecord,
  RoomRecord,
  MessageRecord,
  MediaRecord,
  OutboxRecord,
  SettingsRecord,
} from '../types/db';

export class NijghorDB extends Dexie {
  identity!: Table<IdentityRecord, string>;
  sessions!: Table<SessionRecord, string>;
  contacts!: Table<ContactRecord, string>;
  rooms!: Table<RoomRecord, string>;
  messages!: Table<MessageRecord, string>;
  media!: Table<MediaRecord, string>;
  outbox!: Table<OutboxRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('NijghorEncryptedDB');

    this.version(1).stores({
      identity: 'id',
      sessions: 'contactId, updatedAt',
      contacts: 'userId, username, requestStatus, isVerified, createdAt',
      rooms: 'id, type, unreadCount, isPinned, isArchived, folderId, updatedAt',
      messages: 'id, roomId, [roomId+createdAt], seqId, senderId, status, expiresAt, createdAt',
      media: 'id, roomId, messageId, createdAt',
      outbox: 'id, roomId, retryCount, nextRetryAt, createdAt',
      settings: 'key',
    });
  }
}

export const db = new NijghorDB();
