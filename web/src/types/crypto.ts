// Cryptographic Data Structures and Typed Worker RPC Contracts

export interface KeyPair {
  publicKey: string;  // Base64
  privateKey: string; // Base64 (Never leaves client memory/encrypted DB)
}

export interface PrekeyBundleData {
  registrationId: number;
  identityKey: string;            // Base64
  signedPrekeyId: number;
  signedPrekey: string;           // Base64
  signedPrekeySignature: string;  // Base64
  oneTimePrekeys: Array<{
    keyId: number;
    publicKey: string;
  }>;
}

export interface FetchedPrekeyBundle {
  userId: string;
  username: string;
  registrationId: number;
  identityKey: string;
  signedPrekeyId: number;
  signedPrekey: string;
  signedPrekeySignature: string;
  oneTimePrekey?: {
    keyId: number;
    publicKey: string;
  };
}

export interface SignalEnvelopeData {
  type: 'PREKEY_BUNDLE' | 'WHISPER' | 'SENDER_KEY';
  senderUserId: string;
  senderUsername: string;
  senderDeviceId: number;
  ephemeralKey?: string; // Base64 (for X3DH)
  oneTimePrekeyId?: number;
  ciphertext: string;    // Base64
  sequence: number;
}

export interface SenderKeyDistribution {
  groupId: string;
  senderId: string;
  chainKey: string;
  iteration: number;
  signingKey: string;
}

export type WorkerAction =
  | 'INIT_MASTER_KEY'
  | 'LOCK_KEY'
  | 'IS_LOCKED'
  | 'ENCRYPT_RECORD'
  | 'DECRYPT_RECORD'
  | 'GENERATE_IDENTITY_BUNDLE'
  | 'X3DH_INITIATE'
  | 'X3DH_RECEIVE'
  | 'RATCHET_ENCRYPT'
  | 'RATCHET_DECRYPT'
  | 'CREATE_SENDER_KEY'
  | 'ENCRYPT_SENDER_KEY'
  | 'DECRYPT_SENDER_KEY'
  | 'GENERATE_SAFETY_NUMBER'
  | 'EXPORT_ENCRYPTED_BACKUP'
  | 'IMPORT_ENCRYPTED_BACKUP';

export interface WorkerRequest<T = any> {
  id: string;
  action: WorkerAction;
  payload: T;
}

export interface WorkerResponse<T = any> {
  id: string;
  action: WorkerAction;
  success: boolean;
  data?: T;
  error?: string;
}
