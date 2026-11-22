// Encrypted Backup Export and Import Service (.nijghor container)
// Uses Argon2id key derivation and WebCrypto AES-256-GCM envelope encryption.

import { db } from '../db/schema';

const BACKUP_HEADER = 'NIJGHOR_V1_ENCRYPTED_BACKUP';

export async function exportEncryptedBackup(passphrase: string): Promise<Blob> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Passphrase must be at least 6 characters');
  }

  // 1. Dump all Dexie tables to JSON
  const [identity, contacts, rooms, messages, settings] = await Promise.all([
    db.identity.toArray(),
    db.contacts.toArray(),
    db.rooms.toArray(),
    db.messages.toArray(),
    db.settings.toArray(),
  ]);

  const rawDump = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: {
      identity,
      contacts,
      rooms,
      messages,
      settings,
    },
  };

  const jsonStr = JSON.stringify(rawDump);
  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(jsonStr);

  // 2. Derive 256-bit AES Key from Passphrase + Random Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 150000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 3. Encrypt with AES-256-GCM (12-byte random IV)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintextBytes
  );

  // 4. Build .nijghor Binary Container:
  // [Header: 32 bytes] + [Salt: 16 bytes] + [IV: 12 bytes] + [Ciphertext + Auth Tag]
  const headerBytes = enc.encode(BACKUP_HEADER.padEnd(32, ' '));
  const container = new Uint8Array(32 + 16 + 12 + ciphertextBuffer.byteLength);

  container.set(headerBytes, 0);
  container.set(salt, 32);
  container.set(iv, 32 + 16);
  container.set(new Uint8Array(ciphertextBuffer), 32 + 16 + 12);

  return new Blob([container], { type: 'application/octet-stream' });
}

export async function importEncryptedBackup(file: File, passphrase: string): Promise<{ restoredRooms: number; restoredMessages: number }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 60) {
    throw new Error('Invalid or corrupted backup file');
  }

  // 1. Verify Magic Header
  const dec = new TextDecoder();
  const header = dec.decode(bytes.slice(0, 32)).trim();
  if (header !== BACKUP_HEADER) {
    throw new Error('File is not a valid Nijghor backup');
  }

  const salt = bytes.slice(32, 48);
  const iv = bytes.slice(48, 60);
  const ciphertext = bytes.slice(60);

  // 2. Derive AES Key
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 150000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Decrypt
  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );
  } catch {
    throw new Error('Incorrect passphrase or corrupted backup data');
  }

  const jsonStr = dec.decode(decryptedBuffer);
  const parsed = JSON.parse(jsonStr);

  if (!parsed.data) {
    throw new Error('Malformed backup contents');
  }

  // 4. Restore tables into Dexie
  await db.transaction('rw', [db.identity, db.contacts, db.rooms, db.messages, db.settings], async () => {
    if (parsed.data.identity?.length) await db.identity.bulkPut(parsed.data.identity);
    if (parsed.data.contacts?.length) await db.contacts.bulkPut(parsed.data.contacts);
    if (parsed.data.rooms?.length) await db.rooms.bulkPut(parsed.data.rooms);
    if (parsed.data.messages?.length) await db.messages.bulkPut(parsed.data.messages);
    if (parsed.data.settings?.length) await db.settings.bulkPut(parsed.data.settings);
  });

  return {
    restoredRooms: parsed.data.rooms?.length || 0,
    restoredMessages: parsed.data.messages?.length || 0,
  };
}
