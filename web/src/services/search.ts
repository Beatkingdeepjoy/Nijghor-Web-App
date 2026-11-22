// Local Full-Text Search Service
// Strictly searches decrypted messages inside local browser IndexedDB

import { db } from '../db/schema';
import { decryptMessagePayload } from '../db/encryption';
import type { MessageRecord } from '../types/db';

export interface SearchResult {
  message: MessageRecord;
  decryptedText: string;
  matchedTerm: string;
}

export async function searchLocalMessages(
  query: string,
  roomId?: string
): Promise<SearchResult[]> {
  const clean = query.trim().toLowerCase();
  if (!clean || clean.length < 2) return [];

  let msgsQuery = db.messages.toCollection();
  if (roomId) {
    msgsQuery = db.messages.where('roomId').equals(roomId);
  }

  const allMsgs = await msgsQuery.toArray();
  const results: SearchResult[] = [];

  for (const msg of allMsgs) {
    const text = await decryptMessagePayload(msg.content);
    if (text.toLowerCase().includes(clean)) {
      results.push({
        message: msg,
        decryptedText: text,
        matchedTerm: clean,
      });
    }
  }

  return results.sort((a, b) => b.message.createdAt - a.message.createdAt);
}
