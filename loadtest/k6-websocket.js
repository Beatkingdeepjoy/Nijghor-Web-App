// k6 Load Test Script: Nijghor WebSocket Relay
// Simulates 10,000 concurrent WebSocket connections on a modest VPS.
// Measures connection setup time, heartbeat stability, and round-trip relay latency (< 100ms).

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom Metrics
const connectionTime = new Trend('ws_connection_time_ms');
const messageLatency = new Trend('ws_message_latency_ms');
const connectionErrors = new Counter('ws_connection_errors');

export const options = {
  stages: [
    { duration: '30s', target: 500 },    // Warm up
    { duration: '1m',  target: 2000 },   // Ramp up
    { duration: '2m',  target: 10000 },  // High load: 10k concurrent connections
    { duration: '1m',  target: 10000 },  // Sustain 10k connections
    { duration: '30s', target: 0 },      // Ramp down
  ],
  thresholds: {
    ws_connection_time_ms: ['p(95)<300'], // 95% connections established < 300ms
    ws_message_latency_ms: ['p(95)<100'], // 95% message delivery < 100ms
    ws_connection_errors: ['count<50'],
  },
};

export default function () {
  const vuId = __VU;
  const url = `ws://localhost:8080/ws?token=mock_load_token_${vuId}&seq=0`;

  const startTime = Date.now();

  const res = ws.connect(url, {}, function (socket) {
    connectionTime.add(Date.now() - startTime);

    socket.on('open', function () {
      // Send Heartbeat Ping
      socket.setInterval(function () {
        const pingTime = Date.now();
        const pingFrame = JSON.stringify({
          type: 'PING',
          payload: { timestamp: pingTime },
          timestamp: pingTime,
        });
        socket.send(pingFrame);
      }, 25000);

      // Simulate sending periodic messages
      if (vuId % 10 === 0) {
        socket.setInterval(function () {
          const sendStart = Date.now();
          const frame = JSON.stringify({
            type: 'SEND_MESSAGE',
            payload: {
              clientMsgId: `k6-msg-${vuId}-${Date.now()}`,
              roomId: 'benchmark-room',
              recipientId: `recipient-${(vuId + 1) % 1000}`,
              isGroup: false,
              envelope: {
                type: 'WHISPER',
                ciphertext: 'k6_encrypted_payload_sample_bytes',
                sequence: 1,
              },
            },
            timestamp: sendStart,
          });

          socket.send(frame);
        }, 5000);
      }
    });

    socket.on('message', function (data) {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'ACK' || msg.type === 'PONG') {
          messageLatency.add(Date.now() - msg.timestamp);
        }
      } catch (e) {
        // Binary Protobuf frame received
      }
    });

    socket.on('error', function (e) {
      connectionErrors.add(1);
    });

    // Keep connection alive for virtual user duration
    sleep(60);
    socket.close();
  });

  check(res, {
    'WebSocket handshake succeeded': (r) => r && r.status === 101,
  });
}
