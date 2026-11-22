// Database Record Encryption Layer (Uses Worker AES-256-GCM)

import { cryptoWorker } from '../crypto/worker-client';
import type { MessageRecord, ContactRecord, RoomRecord } from '../types/db';

export async function encryptMessagePayload(plaintext: string): Promise<string> {
  return cryptoWorker.encryptRecord(plaintext);
}

export async function decryptMessagePayload(ciphertext: string): Promise<string> {
  try {
    return await cryptoWorker.decryptRecord(ciphertext);
  } catch (err) {
    console.error('[DB] Failed to decrypt message payload:', err);
    return '🔒 Decryption Error';
  }
}

export async function encryptContactNickname(nickname: string): Promise<string> {
  return cryptoWorker.encryptRecord(nickname);
}

export async function decryptContactNickname(ciphertext: string): Promise<string> {
  try {
    return await cryptoWorker.decryptRecord(ciphertext);
  } catch {
    return '';
  }
}

// Bulk decrypt messages for smooth UI virtualization
export async function decryptMessages(messages: MessageRecord[]): Promise<Array<MessageRecord & { decryptedContent: string }>> {
  const isLocked = await cryptoWorker.isLocked();
  if (isLocked) {
    return messages.map((m) => ({ ...m, decryptedContent: '🔒 Room Locked' }));
  }

  return Promise.all(
    messages.map(async (m) => {
      const text = await decryptMessagePayload(m.content);
      return {
        ...m,
        decryptedContent: text,
      };
    })
  );
}
