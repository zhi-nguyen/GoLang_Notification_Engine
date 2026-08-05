package ws

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"notification-engine/internal/auth"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandler_ServeHTTP_AuthenticationFailures(t *testing.T) {
	hub := NewHub()
	jwtManager, err := auth.NewJWTManager("test-secret-key-32-bytes-length-ok!", time.Hour)
	require.NoError(t, err)

	handler := NewHandler(hub, jwtManager)

	t.Run("Missing token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/ws", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
		assert.Contains(t, rec.Body.String(), "missing token")
	})

	t.Run("Invalid token string", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/ws?token=invalid.jwt.token", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
		assert.Contains(t, rec.Body.String(), "invalid or expired token")
	})
}

func TestHandler_ServeHTTP_SuccessfulHandshake(t *testing.T) {
	hub := NewHub()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go hub.Run(ctx)

	jwtManager, err := auth.NewJWTManager("test-secret-key-32-bytes-length-ok!", time.Hour)
	require.NoError(t, err)

	handler := NewHandler(hub, jwtManager)
	server := httptest.NewServer(handler)
	defer server.Close()

	token, err := jwtManager.GenerateToken("usr_12345")
	require.NoError(t, err)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws?token=" + token

	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	require.NoError(t, err)
	defer func() {
		_ = conn.Close()
	}()

	assert.Equal(t, http.StatusSwitchingProtocols, resp.StatusCode)

	// Verify client is registered in Hub
	require.Eventually(t, func() bool {
		return hub.ClientCount() == 1 && hub.UserClientCount("usr_12345") == 1
	}, 1*time.Second, 10*time.Millisecond)

	// Send broadcast message and verify WS client receives it
	testPayload := []byte(`{"event":"test_broadcast"}`)
	hub.Broadcast(testPayload)

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	require.NoError(t, err)
	assert.Equal(t, testPayload, msg)
}
