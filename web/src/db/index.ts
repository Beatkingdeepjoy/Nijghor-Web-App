// Database Core Exports & Access Repositories

export * from './schema';
export * from './encryption';
export * from './storage';

import { db } from './schema';
import type { MessageRecord, RoomRecord, ContactRecord, OutboxRecord } from '../types/db';

export const dbService = {
  // Messages
  async getRoomMessages(roomId: string, limit = 50, beforeTimestamp?: number): Promise<MessageRecord[]> {
    let query = db.messages.where('roomId').equals(roomId);
    if (beforeTimestamp) {
      return db.messages
        .where('[roomId+createdAt]')
        .between([roomId, 0], [roomId, beforeTimestamp], false, false)
        .reverse()
        .limit(limit)
        .toArray();
    }
    return query.reverse().sortBy('createdAt').then((msgs) => msgs.slice(0, limit));
  },

  async saveMessage(msg: MessageRecord): Promise<string> {
    await db.messages.put(msg);
    // Update room lastMessage metadata
    await db.rooms.update(msg.roomId, {
      lastMessageId: msg.id,
      lastMessageTimestamp: msg.createdAt,
      updatedAt: Date.now(),
    });
    return msg.id;
  },

  async updateMessageStatus(id: string, status: MessageRecord['status']): Promise<void> {
    await db.messages.update(id, { status });
  },

  // Rooms
  async getAllRooms(): Promise<RoomRecord[]> {
    return db.rooms.orderBy('lastMessageTimestamp').reverse().toArray();
  },

  async getRoom(id: string): Promise<RoomRecord | undefined> {
    return db.rooms.get(id);
  },

  async saveRoom(room: RoomRecord): Promise<string> {
    await db.rooms.put(room);
    return room.id;
  },

  // Outbox (Offline Queue)
  async enqueueOutbox(item: OutboxRecord): Promise<void> {
    await db.outbox.put(item);
  },

  async getPendingOutbox(): Promise<OutboxRecord[]> {
    return db.outbox.orderBy('createdAt').toArray();
  },

  async removeFromOutbox(id: string): Promise<void> {
    await db.outbox.delete(id);
  },

  // Contacts
  async getContact(userId: string): Promise<ContactRecord | undefined> {
    return db.contacts.get(userId);
  },

  async saveContact(contact: ContactRecord): Promise<void> {
    await db.contacts.put(contact);
  },
};
