package ws

import (
	"context"
	"sync"

	"github.com/rs/zerolog/log"
)

// UserMessage represents a message intended for a specific user ID.
type UserMessage struct {
	UserID string
	Data   []byte
}

// Hub maintains the set of active WebSocket clients and broadcasts messages to them.
type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Clients mapped by UserID for targeted delivery.
	userClients map[string]map[*Client]bool

	// Inbound messages to broadcast to all connected clients.
	broadcast chan []byte

	// Inbound messages targeted to a specific user.
	userMessage chan UserMessage

	// Register requests from clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// RWMutex protecting client maps and counts.
	mu sync.RWMutex
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clients:     make(map[*Client]bool),
		userClients: make(map[string]map[*Client]bool),
		broadcast:   make(chan []byte, 256),
		userMessage: make(chan UserMessage, 256),
		register:    make(chan *Client, 64),
		unregister:  make(chan *Client, 64),
	}
}

// Run executes the main Hub event loop handling client registration, unregistration,
// and message broadcasting.
func (h *Hub) Run(ctx context.Context) {
	log.Info().Msg("WebSocket Hub event loop started")
	defer log.Info().Msg("WebSocket Hub event loop stopped")

	for {
		select {
		case <-ctx.Done():
			h.cleanupAll()
			return

		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if client.userID != "" {
				if h.userClients[client.userID] == nil {
					h.userClients[client.userID] = make(map[*Client]bool)
				}
				h.userClients[client.userID][client] = true
			}
			h.mu.Unlock()
			log.Debug().
				Str("user_id", client.userID).
				Int("total_clients", len(h.clients)).
				Msg("Client registered to Hub")

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				if client.userID != "" && h.userClients[client.userID] != nil {
					delete(h.userClients[client.userID], client)
					if len(h.userClients[client.userID]) == 0 {
						delete(h.userClients, client.userID)
					}
				}
				close(client.send)
			}
			h.mu.Unlock()
			log.Debug().
				Str("user_id", client.userID).
				Int("total_clients", len(h.clients)).
				Msg("Client unregistered from Hub")

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Send buffer is full. Unregister slow client to prevent blocking.
					log.Warn().
						Str("user_id", client.userID).
						Msg("Client send buffer full during broadcast; dropping connection")
					go func(c *Client) {
						h.unregister <- c
					}(client)
				}
			}
			h.mu.RUnlock()

		case msg := <-h.userMessage:
			h.mu.RLock()
			if clients, ok := h.userClients[msg.UserID]; ok {
				for client := range clients {
					select {
					case client.send <- msg.Data:
					default:
						log.Warn().
							Str("user_id", client.userID).
							Msg("Client send buffer full during targeted send; dropping connection")
						go func(c *Client) {
							h.unregister <- c
						}(client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a message to all connected clients non-blockingly.
func (h *Hub) Broadcast(msg []byte) {
	select {
	case h.broadcast <- msg:
	default:
		log.Warn().Msg("Hub broadcast channel full; dropping message")
	}
}

// SendToUser sends a message to all connected client sessions for a specific user ID.
func (h *Hub) SendToUser(userID string, msg []byte) {
	select {
	case h.userMessage <- UserMessage{UserID: userID, Data: msg}:
	default:
		log.Warn().Str("user_id", userID).Msg("Hub userMessage channel full; dropping message")
	}
}

// ClientCount returns the total number of currently registered active connections.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// UserClientCount returns the number of active connection sessions for a specific user.
func (h *Hub) UserClientCount(userID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if clients, ok := h.userClients[userID]; ok {
		return len(clients)
	}
	return 0
}

func (h *Hub) cleanupAll() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for client := range h.clients {
		delete(h.clients, client)
		close(client.send)
	}
	h.userClients = make(map[string]map[*Client]bool)
}
