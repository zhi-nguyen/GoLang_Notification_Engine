package ws

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHub_RegisterAndUnregister(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)

	client1 := &Client{
		hub:    hub,
		send:   make(chan []byte, 10),
		userID: "user-1",
	}

	client2 := &Client{
		hub:    hub,
		send:   make(chan []byte, 10),
		userID: "user-1",
	}

	client3 := &Client{
		hub:    hub,
		send:   make(chan []byte, 10),
		userID: "user-2",
	}

	hub.register <- client1
	hub.register <- client2
	hub.register <- client3

	// Wait for async registration processing in hub.Run loop
	require.Eventually(t, func() bool {
		return hub.ClientCount() == 3
	}, 1*time.Second, 10*time.Millisecond)

	assert.Equal(t, 2, hub.UserClientCount("user-1"))
	assert.Equal(t, 1, hub.UserClientCount("user-2"))
	assert.Equal(t, 0, hub.UserClientCount("user-3"))

	// Unregister client1
	hub.unregister <- client1

	require.Eventually(t, func() bool {
		return hub.ClientCount() == 2
	}, 1*time.Second, 10*time.Millisecond)

	assert.Equal(t, 1, hub.UserClientCount("user-1"))

	// Unregister client2
	hub.unregister <- client2

	require.Eventually(t, func() bool {
		return hub.UserClientCount("user-1") == 0
	}, 1*time.Second, 10*time.Millisecond)

	assert.Equal(t, 1, hub.ClientCount())
}

func TestHub_Broadcast(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)

	client1 := &Client{
		hub:    hub,
		send:   make(chan []byte, 10),
		userID: "user-1",
	}
	client2 := &Client{
		hub:    hub,
		send:   make(chan []byte, 10),
		userID: "user-2",
	}

	hub.register <- client1
	hub.register <- client2

	require.Eventually(t, func() bool {
		return hub.ClientCount() == 2
	}, 1*time.Second, 10*time.Millisecond)

	msg := []byte(`{"title":"Hello World"}`)
	hub.Broadcast(msg)

	select {
	case received := <-client1.send:
		assert.Equal(t, msg, received)
	case <-time.After(1 * time.Second):
		t.Fatal("client1 did not receive broadcast message")
	}

	select {
	case received := <-client2.send:
		assert.Equal(t, msg, received)
	case <-time.After(1 * time.Second):
		t.Fatal("client2 did not receive broadcast message")
	}
}

func TestHub_SendToUser(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)

	client1 := &Client{
		hub:    hub,
		send:   make(chan []byte, 10),
		userID: "user-100",
	}
	client2 := &Client{
		hub:    hub,
		send:   make(chan []byte, 10),
		userID: "user-200",
	}

	hub.register <- client1
	hub.register <- client2

	require.Eventually(t, func() bool {
		return hub.ClientCount() == 2
	}, 1*time.Second, 10*time.Millisecond)

	msg := []byte(`{"title":"Private Alert"}`)
	hub.SendToUser("user-100", msg)

	select {
	case received := <-client1.send:
		assert.Equal(t, msg, received)
	case <-time.After(1 * time.Second):
		t.Fatal("user-100 client did not receive targeted message")
	}

	// client2 should not receive anything
	assert.Equal(t, 0, len(client2.send))
}

func TestHub_SlowClientDrop(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)

	// Slow client with 0 buffer capacity
	slowClient := &Client{
		hub:    hub,
		send:   make(chan []byte),
		userID: "slow-user",
	}

	hub.register <- slowClient

	require.Eventually(t, func() bool {
		return hub.ClientCount() == 1
	}, 1*time.Second, 10*time.Millisecond)

	// Broadcast should trigger dropping slow client
	hub.Broadcast([]byte("test"))

	require.Eventually(t, func() bool {
		return hub.ClientCount() == 0
	}, 1*time.Second, 10*time.Millisecond)
}
