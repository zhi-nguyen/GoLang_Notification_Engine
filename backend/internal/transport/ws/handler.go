package ws

import (
	"net/http"
	"strings"

	"notification-engine/internal/auth"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

// Handler handles HTTP to WebSocket connection upgrade requests.
type Handler struct {
	hub        *Hub
	jwtManager *auth.JWTManager
	upgrader   websocket.Upgrader
}

// NewHandler creates a new WebSocket Handler.
func NewHandler(hub *Hub, jwtManager *auth.JWTManager) *Handler {
	return &Handler{
		hub:        hub,
		jwtManager: jwtManager,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				// Allow all connections in dev/demo environment; can be configured per domain
				return true
			},
		},
	}
}

// ServeHTTP handles the incoming HTTP request for WebSocket connection upgrade.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tokenStr := extractToken(r)
	if tokenStr == "" {
		http.Error(w, "Unauthorized: missing token", http.StatusUnauthorized)
		return
	}

	claims, err := h.jwtManager.ValidateToken(tokenStr)
	if err != nil {
		log.Warn().Err(err).Msg("WebSocket connection rejected: invalid JWT token")
		http.Error(w, "Unauthorized: invalid or expired token", http.StatusUnauthorized)
		return
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("Failed to upgrade HTTP connection to WebSocket")
		return
	}

	client := NewClient(h.hub, conn, claims.UserID)
	h.hub.register <- client

	log.Info().
		Str("user_id", claims.UserID).
		Str("remote_addr", r.RemoteAddr).
		Msg("WebSocket client connected and authenticated")

	go client.WritePump()
	go client.ReadPump()
}

func extractToken(r *http.Request) string {
	// 1. Check query parameter: /ws?token=ey...
	token := r.URL.Query().Get("token")
	if token != "" {
		return token
	}

	// 2. Check Authorization header: Authorization: Bearer ey...
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return parts[1]
		}
	}

	return ""
}
