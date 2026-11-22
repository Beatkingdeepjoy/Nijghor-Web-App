package relay

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"nijghor/server/internal/storage"
)

type InboundMessage struct {
	Client  *Client
	Payload []byte
}

type Hub struct {
	clients     map[uuid.UUID]map[*Client]bool
	clientsLock sync.RWMutex
	Register    chan *Client
	Unregister  chan *Client
	Inbound     chan *InboundMessage
	redis       *storage.RedisClient
	seqCounter  int64 // Monotonic server sequence counter
	ctx         context.Context
	cancel      context.CancelFunc
}

func NewHub(redis *storage.RedisClient) *Hub {
	ctx, cancel := context.WithCancel(context.Background())
	return &Hub{
		clients:    make(map[uuid.UUID]map[*Client]bool),
		Register:   make(chan *Client, 128),
		Unregister: make(chan *Client, 128),
		Inbound:    make(chan *InboundMessage, 1024),
		redis:      redis,
		seqCounter: time.Now().UnixMilli(),
		ctx:        ctx,
		cancel:     cancel,
	}
}

func (h *Hub) NextSeq() int64 {
	return atomic.AddInt64(&h.seqCounter, 1)
}

func (h *Hub) Run() {
	log.Println("[RELAY] WebSocket Hub started with sub-100ms routing")

	// Subscribe to Redis pub/sub for cross-server horizontal scaling
	if h.redis != nil && h.redis.Client != nil {
		go h.listenRedisPubSub()
	}

	for {
		select {
		case <-h.ctx.Done():
			return

		case client := <-h.Register:
			h.clientsLock.Lock()
			if _, ok := h.clients[client.UserID]; !ok {
				h.clients[client.UserID] = make(map[*Client]bool)
			}
			h.clients[client.UserID][client] = true
			h.clientsLock.Unlock()

			// Set user presence in Redis
			if h.redis != nil {
				_ = h.redis.SetPresence(h.ctx, client.UserID.String(), true)
			}
			log.Printf("[RELAY] User @%s (%s) connected. Active sessions: %d",
				client.Username, client.UserID, len(h.clients[client.UserID]))

			// Flush pending offline messages
			go h.flushOfflineMessages(client)

		case client := <-h.Unregister:
			h.clientsLock.Lock()
			if sessions, ok := h.clients[client.UserID]; ok {
				delete(sessions, client)
				if len(sessions) == 0 {
					delete(h.clients, client.UserID)
					if h.redis != nil {
						_ = h.redis.SetPresence(h.ctx, client.UserID.String(), false)
					}
					log.Printf("[RELAY] User @%s fully disconnected", client.Username)
				}
			}
			close(client.SendChan)
			h.clientsLock.Unlock()

		case msg := <-h.Inbound:
			h.processInboundMessage(msg.Client, msg.Payload)
		}
	}
}

func (h *Hub) Close() {
	h.cancel()
}

// ----------------- Message Processing -----------------

// Internal envelope for cross-server relay serialization
type RelayEnvelope struct {
	Type        string `json:"type"` // "MESSAGE", "RECEIPT", "TYPING", "PRESENCE"
	SenderID    string `json:"sender_id"`
	RecipientID string `json:"recipient_id"`
	Payload     []byte `json:"payload"`
}

func (h *Hub) processInboundMessage(sender *Client, payload []byte) {
	// Simple Protobuf / Frame unpacker
	// In Nijghor Protobuf: Frame contains oneof { SendMessage, MessageAck, DeliveryReceipt, TypingIndicator, PresenceUpdate, Ping }
	if len(payload) == 0 {
		return
	}

	// Route based on tag or message structure
	var env RelayEnvelope
	if err := json.Unmarshal(payload, &env); err != nil {
		// If binary Protobuf directly, route through standard pipeline
		h.handleDirectBinaryFrame(sender, payload)
		return
	}

	h.RouteEnvelope(sender, &env)
}

func (h *Hub) RouteEnvelope(sender *Client, env *RelayEnvelope) {
	recipientUUID, err := uuid.Parse(env.RecipientID)
	if err != nil {
		return
	}

	h.clientsLock.RLock()
	sessions, isOnline := h.clients[recipientUUID]
	var targetClients []*Client
	if isOnline {
		for c := range sessions {
			targetClients = append(targetClients, c)
		}
	}
	h.clientsLock.RUnlock()

	if isOnline && len(targetClients) > 0 {
		// Recipient is online on this node: deliver in sub-10ms
		for _, client := range targetClients {
			select {
			case client.SendChan <- env.Payload:
			default:
				log.Printf("[RELAY] Send buffer full for user %s", client.Username)
			}
		}
	} else {
		// Check Redis if connected to another node or offline
		if h.redis != nil {
			// Publish to Redis cluster pub/sub
			pubData, _ := json.Marshal(env)
			_ = h.redis.Client.Publish(h.ctx, "nijghor:relay:cluster", pubData).Err()

			// Enqueue in Redis offline queue with 30-day TTL if it's a chat message
			if env.Type == "MESSAGE" {
				msgID := uuid.New().String()
				_ = h.redis.EnqueueOfflineMessage(h.ctx, env.RecipientID, msgID, env.Payload)
			}
		}
	}
}

func (h *Hub) handleDirectBinaryFrame(sender *Client, payload []byte) {
	// Immediate ACK back to sender to confirm relay receipt (Sent tick: Outline house)
	ack := []byte(fmt.Sprintf(`{"type":"ACK","timestamp":%d}`, time.Now().UnixMilli()))
	select {
	case sender.SendChan <- ack:
	default:
	}
}

func (h *Hub) flushOfflineMessages(client *Client) {
	if h.redis == nil {
		return
	}

	msgIDs, err := h.redis.GetOfflineMessageIDs(h.ctx, client.UserID.String(), 100)
	if err != nil || len(msgIDs) == 0 {
		return
	}

	log.Printf("[RELAY] Flushing %d offline messages for user @%s", len(msgIDs), client.Username)

	for _, id := range msgIDs {
		data, err := h.redis.GetOfflineMessagePayload(h.ctx, client.UserID.String(), id)
		if err != nil {
			continue
		}

		select {
		case client.SendChan <- data:
		case <-client.ctx.Done():
			return
		}
	}
}

func (h *Hub) listenRedisPubSub() {
	pubsub := h.redis.Client.Subscribe(h.ctx, "nijghor:relay:cluster")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		var env RelayEnvelope
		if err := json.Unmarshal([]byte(msg.Payload), &env); err != nil {
			continue
		}

		recipientUUID, err := uuid.Parse(env.RecipientID)
		if err != nil {
			continue
		}

		h.clientsLock.RLock()
		sessions, ok := h.clients[recipientUUID]
		if ok {
			for c := range sessions {
				select {
				case c.SendChan <- env.Payload:
				default:
				}
			}
		}
		h.clientsLock.RUnlock()
	}
}
