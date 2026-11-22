// Main Thread RPC Bridge for Crypto Web Worker

import type {
  WorkerRequest,
  WorkerResponse,
  WorkerAction,
  PrekeyBundleData,
  FetchedPrekeyBundle,
  SignalEnvelopeData,
} from '../types/crypto';

class CryptoWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, {
    resolve: (val: any) => void;
    reject: (err: Error) => void;
  }> = new Map();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    this.worker = new Worker(
      new URL('../workers/crypto.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, success, data, error } = e.data;
      const pending = this.pendingRequests.get(id);

      if (pending) {
        this.pendingRequests.delete(id);
        if (success) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error || 'Worker operation failed'));
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error('[CryptoWorker] Error:', err);
    };
  }

  private request<T = any>(action: WorkerAction, payload?: any): Promise<T> {
    if (!this.worker) {
      this.initWorker();
    }

    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pendingRequests.set(id, { resolve, reject });

      const req: WorkerRequest = { id, action, payload };
      this.worker!.postMessage(req);
    });
  }

  // ----------------- Public API -----------------

  async initMasterKey(secret: string, salt?: string): Promise<boolean> {
    const res = await this.request<{ initialized: boolean }>('INIT_MASTER_KEY', { secret, salt });
    return res.initialized;
  }

  async lock(): Promise<boolean> {
    const res = await this.request<{ locked: boolean }>('LOCK_KEY');
    return res.locked;
  }

  async isLocked(): Promise<boolean> {
    const res = await this.request<{ isLocked: boolean }>('IS_LOCKED');
    return res.isLocked;
  }

  async encryptRecord(plaintext: string): Promise<string> {
    return this.request<string>('ENCRYPT_RECORD', { plaintext });
  }

  async decryptRecord(ciphertext: string): Promise<string> {
    return this.request<string>('DECRYPT_RECORD', { ciphertext });
  }

  async generateIdentityBundle(): Promise<{
    bundle: PrekeyBundleData;
    identityPrivateKeyB64: string;
    signedPrekeyPrivateB64: string;
  }> {
    return this.request('GENERATE_IDENTITY_BUNDLE');
  }

  async initiateX3DH(
    recipientBundle: FetchedPrekeyBundle,
    myIdentityPrivateKeyB64: string,
    myIdentityPublicKeyB64: string
  ): Promise<{ envelope: SignalEnvelopeData; masterSharedKey: string }> {
    return this.request('X3DH_INITIATE', {
      recipientBundle,
      myIdentityPrivateKeyB64,
      myIdentityPublicKeyB64,
    });
  }

  async ratchetEncrypt(contactId: string, plaintext: string): Promise<SignalEnvelopeData> {
    return this.request('RATCHET_ENCRYPT', { contactId, plaintext });
  }

  async ratchetDecrypt(contactId: string, envelope: SignalEnvelopeData): Promise<string> {
    return this.request('RATCHET_DECRYPT', { contactId, envelope });
  }

  async generateSafetyNumber(keyA: string, keyB: string): Promise<string> {
    return this.request('GENERATE_SAFETY_NUMBER', { keyA, keyB });
  }
}

export const cryptoWorker = new CryptoWorkerClient();
