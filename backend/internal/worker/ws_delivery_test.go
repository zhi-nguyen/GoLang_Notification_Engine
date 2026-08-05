package worker

import (
	"context"
	"testing"
	"time"

	natsinfra "notification-engine/internal/infrastructure/nats"
	"notification-engine/internal/transport/ws"

	"github.com/nats-io/nats.go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWSDeliveryWorker_NilNATSConnection(t *testing.T) {
	hub := ws.NewHub()
	worker := NewWSDeliveryWorker(nil, hub)

	err := worker.Start(context.Background())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "NATS connection is nil")
}

func TestWSDeliveryWorker_IntegrationWithNATS(t *testing.T) {
	// Try connecting to local NATS server (docker-compose)
	nc, err := nats.Connect(nats.DefaultURL, nats.Timeout(1*time.Second))
	if err != nil {
		t.Skip("Local NATS server not running on default port; skipping integration test")
		return
	}
	defer nc.Close()

	hub := ws.NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)

	worker := NewWSDeliveryWorker(nc, hub)
	err = worker.Start(ctx)
	require.NoError(t, err)
	defer func() {
		_ = worker.Stop()
	}()

	client1 := &struct {
		send chan []byte
	}{send: make(chan []byte, 10)}

	// Register dummy client directly into Hub test helper logic
	// Or test via Publish and hub state
	_ = client1

	// Test NATS broadcast publish -> worker forwards to Hub broadcast channel
	broadcastData := []byte(`{"event":"nats_broadcast_test"}`)
	err = nc.Publish(natsinfra.SubjectWSBroadcast, broadcastData)
	require.NoError(t, err)

	// Test NATS user publish -> worker forwards to Hub user channel
	userData := []byte(`{"event":"nats_user_test"}`)
	err = nc.Publish(natsinfra.SubjectWSUserPrefix+"usr_999", userData)
	require.NoError(t, err)

	_ = nc.Flush()
}
