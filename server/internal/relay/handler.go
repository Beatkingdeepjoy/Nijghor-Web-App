package relay

import (
	"log"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"nhooyr.io/websocket"
	"nijghor/server/internal/auth"
	"nijghor/server/internal/middleware"
)

type WebSocketHandler struct {
	hub        *Hub
	jwtManager *auth.JWTManager
}

func NewWebSocketHandler(hub *Hub, jwtMgr *auth.JWTManager) *WebSocketHandler {
	return &WebSocketHandler{
		hub:        hub,
		jwtManager: jwtMgr,
	}
}

func (h *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Authenticate connection via token query param or header
	token := r.URL.Query().Get("token")
	if token == "" {
		token = r.Header.Get("Sec-WebSocket-Protocol")
	}

	if token == "" {
		http.Error(w, "Unauthorized: missing token", http.StatusUnauthorized)
		return
	}

	claims, err := h.jwtManager.ValidateAccessToken(token)
	if err != nil {
		log.Printf("[WS] Auth failure: %v", err)
		http.Error(w, "Unauthorized: invalid access token", http.StatusUnauthorized)
		return
	}

	// Parse resumption sequence if provided
	var lastAckSeq int64 = 0
	if seqStr := r.URL.Query().Get("seq"); seqStr != "" {
		lastAckSeq, _ = strconv.ParseInt(seqStr, 10, 64)
	}

	// Accept WebSocket connection
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		Subprotocols:       []string{token, "nijghor-binary-v1"},
		InsecureSkipVerify: true, // Configured for dev & Caddy reverse proxy
	})
	if err != nil {
		log.Printf("[WS] Upgrade error: %v", err)
		return
	}

	deviceHint := r.UserAgent()
	if deviceHint == "" {
		deviceHint = "Web Browser"
	}

	client := NewClient(h.hub, conn, claims.UserID, claims.Username, lastAckSeq, deviceHint)

	// Register in hub
	h.hub.Register <- client

	// Start read & write loops
	go client.WritePump()
	client.ReadPump()
}
