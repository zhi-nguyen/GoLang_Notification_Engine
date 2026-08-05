package worker

import (
	"context"
	"fmt"
	"strings"
	"sync"

	natsinfra "notification-engine/internal/infrastructure/nats"
	"notification-engine/internal/transport/ws"

	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"
)

// WSDeliveryWorker listens to NATS Core PubSub subjects and forwards real-time messages to the WebSocket Hub.
type WSDeliveryWorker struct {
	nc           *nats.Conn
	hub          *ws.Hub
	subBroadcast *nats.Subscription
	subUser      *nats.Subscription
	mu           sync.Mutex
}

// NewWSDeliveryWorker creates a new WSDeliveryWorker instance.
func NewWSDeliveryWorker(nc *nats.Conn, hub *ws.Hub) *WSDeliveryWorker {
	return &WSDeliveryWorker{
		nc:  nc,
		hub: hub,
	}
}

// Start subscribes to NATS subjects and dispatches incoming messages to the WebSocket Hub.
func (w *WSDeliveryWorker) Start(ctx context.Context) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.nc == nil {
		return fmt.Errorf("NATS connection is nil")
	}

	// 1. Subscribe to broadcast messages (Subject: ws.broadcast)
	subBroadcast, err := w.nc.Subscribe(natsinfra.SubjectWSBroadcast, func(msg *nats.Msg) {
		log.Debug().Int("len", len(msg.Data)).Msg("WSDeliveryWorker received broadcast message from NATS")
		w.hub.Broadcast(msg.Data)
	})
	if err != nil {
		return fmt.Errorf("failed to subscribe to NATS broadcast subject %s: %w", natsinfra.SubjectWSBroadcast, err)
	}
	w.subBroadcast = subBroadcast

	// 2. Subscribe to user-targeted messages (Subject: ws.user.*)
	userSubjectPattern := natsinfra.SubjectWSUserPrefix + "*"
	subUser, err := w.nc.Subscribe(userSubjectPattern, func(msg *nats.Msg) {
		userID := strings.TrimPrefix(msg.Subject, natsinfra.SubjectWSUserPrefix)
		log.Debug().
			Str("user_id", userID).
			Int("len", len(msg.Data)).
			Msg("WSDeliveryWorker received user message from NATS")

		w.hub.SendToUser(userID, msg.Data)
	})
	if err != nil {
		_ = subBroadcast.Unsubscribe()
		return fmt.Errorf("failed to subscribe to NATS user subject %s: %w", userSubjectPattern, err)
	}
	w.subUser = subUser

	log.Info().
		Str("broadcast_subject", natsinfra.SubjectWSBroadcast).
		Str("user_subject", userSubjectPattern).
		Msg("WSDeliveryWorker started successfully")

	go func() {
		<-ctx.Done()
		_ = w.Stop()
	}()

	return nil
}

// Stop gracefully unsubscribes from NATS subjects.
func (w *WSDeliveryWorker) Stop() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	var errs []string

	if w.subBroadcast != nil {
		if err := w.subBroadcast.Unsubscribe(); err != nil {
			errs = append(errs, fmt.Sprintf("broadcast unsubscribe error: %v", err))
		}
		w.subBroadcast = nil
	}

	if w.subUser != nil {
		if err := w.subUser.Unsubscribe(); err != nil {
			errs = append(errs, fmt.Sprintf("user unsubscribe error: %v", err))
		}
		w.subUser = nil
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors stopping WSDeliveryWorker: %s", strings.Join(errs, "; "))
	}

	log.Info().Msg("WSDeliveryWorker stopped")
	return nil
}
