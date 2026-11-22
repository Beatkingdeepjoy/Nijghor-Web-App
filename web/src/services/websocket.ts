// High-Performance Resilient WebSocket Relay Client
// Single persistent connection, binary frames, exponential backoff + jitter, outbox drainer.

import { encodeFrame, decodeFrame, type WSFrame, type DeliveryReceiptPayload } from '../proto/chat';
import { db, dbService } from '../db';
import { cryptoWorker } from '../crypto/worker-client';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'AUTHENTICATING' | 'CONNECTED';

type FrameListener = (frame: WSFrame) => void;
type StatusListener = (status: ConnectionStatus) => void;

class WebSocketRelayService {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private token: string | null = null;
  private lastSeq: number = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private pingInterval: any = null;

  private frameListeners: Set<FrameListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[WS] Network online detected. Reconnecting immediately...');
        this.reconnectAttempts = 0;
        this.connect();
      });
      window.addEventListener('offline', () => {
        console.log('[WS] Network offline detected.');
        this.setStatus('DISCONNECTED');
      });
    }
  }

  public setToken(token: string) {
    this.token = token;
  }

  public setLastSeq(seq: number) {
    this.lastSeq = seq;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach((l) => l(status));
    }
  }

  public onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  public connect() {
    if (!this.token || typeof window === 'undefined') return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('CONNECTING');

    const defaultBase = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const wsBase = (import.meta.env.VITE_WS_URL || defaultBase).replace(/\/$/, '');
    const url = `${wsBase}/ws?token=${encodeURIComponent(this.token)}&seq=${this.lastSeq}`;

    try {
      this.socket = new WebSocket(url, ['nijghor-binary-v1']);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        console.log('[WS] WebSocket connection established');
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Immediately flush offline messages stored in Dexie Outbox
        this.flushOutbox();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        const frame = decodeFrame(event.data);
        if (frame) {
          this.handleInboundFrame(frame);
        }
      };

      this.socket.onclose = (event) => {
        console.log(`[WS] WebSocket closed (code: ${event.code}). Scheduling reconnect...`);
        this.stopHeartbeat();
        this.setStatus('DISCONNECTED');
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.error('[WS] WebSocket error:', err);
      };
    } catch (err) {
      console.error('[WS] Connection attempt failed:', err);
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('DISCONNECTED');
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // Exponential backoff: base 200ms, cap at 5000ms + random jitter
    const delay = Math.min(200 * Math.pow(1.5, this.reconnectAttempts), 5000) + Math.random() * 300;
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({
          type: 'PING',
          payload: {},
          timestamp: Date.now(),
        });
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  public send(frame: WSFrame): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const data = encodeFrame(frame);
      this.socket.send(data);
      return true;
    } catch (err) {
      console.error('[WS] Send failed:', err);
      return false;
    }
  }

  // ----------------- Inbound Frame Dispatcher -----------------

  private async handleInboundFrame(frame: WSFrame) {
    switch (frame.type) {
      case 'PONG':
        // Heartbeat ACK
        break;

      case 'MESSAGE_ACK': {
        // Outline House Tick: Message safely stored in server relay
        const { clientMsgId } = frame.payload;
        if (clientMsgId) {
          await dbService.updateMessageStatus(clientMsgId, 'sent');
          await dbService.removeFromOutbox(clientMsgId);
        }
        break;
      }

      case 'DELIVERY_RECEIPT': {
        // Filled House (DELIVERED) or Glowing House (READ)
        const receipt = frame.payload as DeliveryReceiptPayload;
        const newStatus = receipt.status.toLowerCase() as 'delivered' | 'read';
        await dbService.updateMessageStatus(receipt.messageId, newStatus);
        break;
      }

      case 'RECEIVE_MESSAGE': {
        const msg = frame.payload;
        if (msg.seqId) {
          this.lastSeq = Math.max(this.lastSeq, msg.seqId);
        }

        // Send Delivery Receipt back immediately (Filled House)
        this.send({
          type: 'DELIVERY_RECEIPT',
          payload: {
            roomId: msg.roomId,
            messageId: msg.clientMsgId || msg.serverMsgId,
            status: 'DELIVERED',
            senderId: msg.senderId,
            readerId: '',
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });
        break;
      }
    }

    // Broadcast frame to UI subscribers
    this.frameListeners.forEach((l) => l(frame));
  }

  // ----------------- Offline Outbox Drainage -----------------

  public async flushOutbox() {
    if (this.status !== 'CONNECTED') return;

    const pending = await dbService.getPendingOutbox();
    if (pending.length === 0) return;

    console.log(`[WS] Flushing ${pending.length} pending messages from IndexedDB Outbox...`);

    for (const item of pending) {
      const envelope = JSON.parse(item.envelopeJson);
      const sent = this.send({
        type: 'SEND_MESSAGE',
        payload: {
          clientMsgId: item.id,
          roomId: item.roomId,
          recipientId: item.recipientId,
          isGroup: item.isGroup,
          envelope: envelope,
        },
        timestamp: item.clientTimestamp,
      });

      if (!sent) {
        console.warn('[WS] Outbox flush interrupted. Will retry on reconnect.');
        break;
      }
    }
  }
}

export const wsRelay = new WebSocketRelayService();
