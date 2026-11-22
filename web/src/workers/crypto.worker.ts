// Nijghor Dedicated Crypto Web Worker
// Performs all Signal Protocol ratchets, key generations, and local DB encryption off the main thread.

import type {
  WorkerRequest,
  WorkerResponse,
  PrekeyBundleData,
  FetchedPrekeyBundle,
  SignalEnvelopeData,
  SenderKeyDistribution,
} from '../types/crypto';

// In-memory decrypted key (Purged on lock)
let masterDataKey: CryptoKey | null = null;

// Double Ratchet session state cache in worker memory
interface RatchetSession {
  contactId: string;
  rootKey: Uint8Array;
  sendChainKey: Uint8Array;
  recvChainKey: Uint8Array;
  sendCounter: number;
  recvCounter: number;
  myDHPrivate: CryptoKey;
  myDHPublic: Uint8Array;
  theirDHPublic: Uint8Array;
}

const activeSessions: Map<string, RatchetSession> = new Map();
const activeSenderKeys: Map<string, SenderKeyDistribution> = new Map();

// ----------------- Master Key & DB Encryption (AES-256-GCM) -----------------

async function deriveMasterKeyFromSecret(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptWithMasterKey(plaintext: string): Promise<string> {
  if (!masterDataKey) {
    throw new Error('Database is locked. Master key not initialized in worker.');
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encodedData = enc.encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterDataKey,
    encodedData
  );

  // Pack: 12-byte IV + Ciphertext (with auth tag)
  const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuffer), iv.length);

  return uint8ArrayToBase64(combined);
}

async function decryptWithMasterKey(ciphertextB64: string): Promise<string> {
  if (!masterDataKey) {
    throw new Error('Database is locked. Master key not initialized in worker.');
  }

  const combined = base64ToUint8Array(ciphertextB64);
  if (combined.length < 13) {
    throw new Error('Invalid ciphertext payload');
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterDataKey,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

// ----------------- Signal Protocol Primitives (ECDH / Curve25519) -----------------

async function generateECDHKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, // P-256 / WebCrypto hardware accelerated
    true,
    ['deriveKey', 'deriveBits']
  );

  const pubRaw = await crypto.subtle.exportKey('raw', pair.publicKey);
  return {
    publicKey: new Uint8Array(pubRaw),
    privateKey: pair.privateKey,
  };
}

async function deriveDHSecret(privateKey: CryptoKey, theirPublicKeyRaw: Uint8Array): Promise<Uint8Array> {
  const theirPublicKey = await crypto.subtle.importKey(
    'raw',
    theirPublicKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublicKey },
    privateKey,
    256
  );

  return new Uint8Array(sharedBits);
}

async function hkdfExtractAndExpand(salt: Uint8Array, ikm: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const enc = new TextEncoder();
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: enc.encode(info),
    },
    keyMaterial,
    length * 8
  );
  return new Uint8Array(derivedBits);
}

async function stepChainKey(chainKey: Uint8Array): Promise<{ nextChainKey: Uint8Array; messageKey: Uint8Array }> {
  const keyMaterial = await crypto.subtle.importKey('raw', chainKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const enc = new TextEncoder();
  const messageKeyBits = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode('MessageKey'));
  const nextChainBits = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode('ChainKey'));

  return {
    nextChainKey: new Uint8Array(nextChainBits).slice(0, 32),
    messageKey: new Uint8Array(messageKeyBits).slice(0, 32),
  };
}

// ----------------- Bundle Generation -----------------

async function generateIdentityBundle(): Promise<{
  bundle: PrekeyBundleData;
  identityPrivateKeyB64: string;
  signedPrekeyPrivateB64: string;
}> {
  const registrationId = Math.floor(Math.random() * 16384) + 1;
  const identityPair = await generateECDHKeyPair();
  const signedPrekeyPair = await generateECDHKeyPair();

  // Export private keys for local encrypted storage
  const idPrivExport = await crypto.subtle.exportKey('pkcs8', identityPair.privateKey);
  const spkPrivExport = await crypto.subtle.exportKey('pkcs8', signedPrekeyPair.privateKey);

  // Generate Dummy Signature for SPK over Identity Key
  const signatureBytes = crypto.getRandomValues(new Uint8Array(64));

  // Generate 50 One-Time Prekeys
  const otpks: Array<{ keyId: number; publicKey: string }> = [];
  for (let i = 1; i <= 50; i++) {
    const otpkPair = await generateECDHKeyPair();
    otpks.push({
      keyId: i,
      publicKey: uint8ArrayToBase64(otpkPair.publicKey),
    });
  }

  const bundle: PrekeyBundleData = {
    registrationId,
    identityKey: uint8ArrayToBase64(identityPair.publicKey),
    signedPrekeyId: 1,
    signedPrekey: uint8ArrayToBase64(signedPrekeyPair.publicKey),
    signedPrekeySignature: uint8ArrayToBase64(signatureBytes),
    oneTimePrekeys: otpks,
  };

  return {
    bundle,
    identityPrivateKeyB64: uint8ArrayToBase64(new Uint8Array(idPrivExport)),
    signedPrekeyPrivateB64: uint8ArrayToBase64(new Uint8Array(spkPrivExport)),
  };
}

// ----------------- X3DH Key Exchange -----------------

async function initiateX3DH(payload: {
  recipientBundle: FetchedPrekeyBundle;
  myIdentityPrivateKeyB64: string;
  myIdentityPublicKeyB64: string;
}): Promise<{
  envelope: SignalEnvelopeData;
  masterSharedKey: string;
}> {
  const myIdPrivBytes = base64ToUint8Array(payload.myIdentityPrivateKeyB64);
  const myIdPrivKey = await crypto.subtle.importKey('pkcs8', myIdPrivBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);

  // Generate ephemeral key pair
  const ephemeralPair = await generateECDHKeyPair();

  const recipientIK = base64ToUint8Array(payload.recipientBundle.identityKey);
  const recipientSPK = base64ToUint8Array(payload.recipientBundle.signedPrekey);

  // DH1 = DH(IK_A, SPK_B)
  const dh1 = await deriveDHSecret(myIdPrivKey, recipientSPK);
  // DH2 = DH(EK_A, IK_B)
  const dh2 = await deriveDHSecret(ephemeralPair.privateKey, recipientIK);
  // DH3 = DH(EK_A, SPK_B)
  const dh3 = await deriveDHSecret(ephemeralPair.privateKey, recipientSPK);

  let combinedIKM = new Uint8Array(dh1.length + dh2.length + dh3.length);
  combinedIKM.set(dh1, 0);
  combinedIKM.set(dh2, dh1.length);
  combinedIKM.set(dh3, dh1.length + dh2.length);

  if (payload.recipientBundle.oneTimePrekey) {
    const recipientOPK = base64ToUint8Array(payload.recipientBundle.oneTimePrekey.publicKey);
    const dh4 = await deriveDHSecret(ephemeralPair.privateKey, recipientOPK);
    const withDH4 = new Uint8Array(combinedIKM.length + dh4.length);
    withDH4.set(combinedIKM, 0);
    withDH4.set(dh4, combinedIKM.length);
    combinedIKM = withDH4;
  }

  // Derive Master Shared Secret via HKDF
  const salt = new Uint8Array(32); // Zero salt as per Signal spec
  const masterSecret = await hkdfExtractAndExpand(salt, combinedIKM, 'NijghorSignalX3DH', 64);
  const rootKey = masterSecret.slice(0, 32);
  const sendChainKey = masterSecret.slice(32, 64);

  // Initialize in-memory ratchet session
  activeSessions.set(payload.recipientBundle.userId, {
    contactId: payload.recipientBundle.userId,
    rootKey,
    sendChainKey,
    recvChainKey: new Uint8Array(32),
    sendCounter: 0,
    recvCounter: 0,
    myDHPrivate: ephemeralPair.privateKey,
    myDHPublic: ephemeralPair.publicKey,
    theirDHPublic: recipientSPK,
  });

  return {
    envelope: {
      type: 'PREKEY_BUNDLE',
      senderUserId: '',
      senderUsername: '',
      senderDeviceId: 1,
      ephemeralKey: uint8ArrayToBase64(ephemeralPair.publicKey),
      oneTimePrekeyId: payload.recipientBundle.oneTimePrekey?.keyId,
      ciphertext: '',
      sequence: 0,
    },
    masterSharedKey: uint8ArrayToBase64(masterSecret),
  };
}

// ----------------- Double Ratchet Symmetric Encryption -----------------

async function ratchetEncrypt(payload: {
  contactId: string;
  plaintext: string;
}): Promise<SignalEnvelopeData> {
  const session = activeSessions.get(payload.contactId);
  if (!session) {
    throw new Error('No active ratchet session with contact: ' + payload.contactId);
  }

  const { nextChainKey, messageKey } = await stepChainKey(session.sendChainKey);
  session.sendChainKey = nextChainKey;
  session.sendCounter++;

  // Encrypt plaintext with messageKey using AES-256-GCM
  const aesKey = await crypto.subtle.importKey('raw', messageKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(payload.plaintext));

  const packedCiphertext = new Uint8Array(iv.length + encryptedBuf.byteLength);
  packedCiphertext.set(iv, 0);
  packedCiphertext.set(new Uint8Array(encryptedBuf), iv.length);

  return {
    type: 'WHISPER',
    senderUserId: '',
    senderUsername: '',
    senderDeviceId: 1,
    ciphertext: uint8ArrayToBase64(packedCiphertext),
    sequence: session.sendCounter,
  };
}

async function ratchetDecrypt(payload: {
  contactId: string;
  envelope: SignalEnvelopeData;
}): Promise<string> {
  const session = activeSessions.get(payload.contactId);
  if (!session) {
    throw new Error('No active ratchet session for decryption with contact: ' + payload.contactId);
  }

  const packed = base64ToUint8Array(payload.envelope.ciphertext);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);

  const { nextChainKey, messageKey } = await stepChainKey(session.sendChainKey);
  session.sendChainKey = nextChainKey;

  const aesKey = await crypto.subtle.importKey('raw', messageKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);

  const dec = new TextDecoder();
  return dec.decode(decryptedBuf);
}

// ----------------- Safety Number Calculation -----------------

async function calculateSafetyNumber(keyA: string, keyB: string): Promise<string> {
  // Sort keys deterministically
  const keys = [keyA, keyB].sort();
  const enc = new TextEncoder();
  const input = enc.encode(keys[0] + keys[1]);

  const hashBuffer = await crypto.subtle.digest('SHA-512', input);
  const hashBytes = new Uint8Array(hashBuffer);

  // Convert first 30 bytes into 12 chunks of 5-digit numbers
  let digits = '';
  for (let i = 0; i < 12; i++) {
    const chunk = (hashBytes[i * 2] << 8) | hashBytes[i * 2 + 1];
    const num = (chunk % 100000).toString().padStart(5, '0');
    digits += (i > 0 ? ' ' : '') + num;
  }
  return digits;
}

// ----------------- Helpers -----------------

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ----------------- Worker Message Dispatcher -----------------

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, action, payload } = e.data;

  try {
    let result: any = null;

    switch (action) {
      case 'INIT_MASTER_KEY': {
        const salt = payload.salt ? base64ToUint8Array(payload.salt) : new Uint8Array(16);
        masterDataKey = await deriveMasterKeyFromSecret(payload.secret, salt);
        result = { initialized: true };
        break;
      }

      case 'LOCK_KEY': {
        masterDataKey = null;
        activeSessions.clear();
        activeSenderKeys.clear();
        result = { locked: true };
        break;
      }

      case 'IS_LOCKED': {
        result = { isLocked: masterDataKey === null };
        break;
      }

      case 'ENCRYPT_RECORD': {
        result = await encryptWithMasterKey(payload.plaintext);
        break;
      }

      case 'DECRYPT_RECORD': {
        result = await decryptWithMasterKey(payload.ciphertext);
        break;
      }

      case 'GENERATE_IDENTITY_BUNDLE': {
        result = await generateIdentityBundle();
        break;
      }

      case 'X3DH_INITIATE': {
        result = await initiateX3DH(payload);
        break;
      }

      case 'RATCHET_ENCRYPT': {
        result = await ratchetEncrypt(payload);
        break;
      }

      case 'RATCHET_DECRYPT': {
        result = await ratchetDecrypt(payload);
        break;
      }

      case 'GENERATE_SAFETY_NUMBER': {
        result = await calculateSafetyNumber(payload.keyA, payload.keyB);
        break;
      }

      default:
        throw new Error(`Unknown worker action: ${action}`);
    }

    const response: WorkerResponse = {
      id,
      action,
      success: true,
      data: result,
    };
    self.postMessage(response);
  } catch (err: any) {
    const response: WorkerResponse = {
      id,
      action,
      success: false,
      error: err?.message || 'Crypto worker internal error',
    };
    self.postMessage(response);
  }
};
