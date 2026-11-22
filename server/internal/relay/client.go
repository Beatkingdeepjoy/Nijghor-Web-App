package relay

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"nhooyr.io/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 30 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024 // 512 KB max Protobuf frame
)

type Client struct {
	Hub         *Hub
	Conn        *websocket.Conn
	UserID      uuid.UUID
	Username    string
	SendChan    chan []byte
	LastAckSeq  int64
	IsAlive     bool
	DeviceHint  string
	ctx         context.Context
	cancel      context.CancelFunc
}

func NewClient(hub *Hub, conn *websocket.Conn, userID uuid.UUID, username string, lastAckSeq int64, deviceHint string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	return &Client{
		Hub:        hub,
		Conn:       conn,
		UserID:     userID,
		Username:   username,
		SendChan:   make(chan []byte, 256),
		LastAckSeq: lastAckSeq,
		IsAlive:    true,
		DeviceHint: deviceHint,
		ctx:        ctx,
		cancel:     cancel,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.cancel()
		c.Hub.Unregister <- c
		c.Conn.Close(websocket.StatusNormalClosure, "connection closed")
	}()

	c.Conn.SetReadLimit(maxMessageSize)

	for {
		msgType, payload, err := c.Conn.Read(c.ctx)
		if err != nil {
			if websocket.CloseStatus(err) != websocket.StatusNormalClosure {
				log.Printf("[WS] Read error for user %s: %v", c.Username, err)
			}
			break
		}

		if msgType != websocket.MessageBinary {
			// All Nijghor frames MUST be binary Protobuf
			continue
		}

		c.Hub.Inbound <- &InboundMessage{
			Client:  c,
			Payload: payload,
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.cancel()
		c.Conn.Close(websocket.StatusGoingAway, "write pump closed")
	}()

	for {
		select {
		case <-c.ctx.Done():
			return

		case payload, ok := <-c.SendChan:
			if !ok {
				c.Conn.Close(websocket.StatusNormalClosure, "channel closed")
				return
			}

			writeCtx, writeCancel := context.WithTimeout(c.ctx, writeWait)
			err := c.Conn.Write(writeCtx, websocket.MessageBinary, payload)
			writeCancel()
			if err != nil {
				log.Printf("[WS] Write error for user %s: %v", c.Username, err)
				return
			}

		case <-ticker.C:
			// Send WebSocket Ping heartbeat
			pingCtx, pingCancel := context.WithTimeout(c.ctx, 5*time.Second)
			err := c.Conn.Ping(pingCtx)
			pingCancel()
			if err != nil {
				log.Printf("[WS] Ping timeout for user %s: %v", c.Username, err)
				return
			}
		}
	}
}
