package http

import (
	"net/http"

	"notification-engine/internal/auth"
)

// NewRouter sets up all HTTP routes and middleware.
func NewRouter(h *HTTPHandler, jwtMgr *auth.JWTManager, wsHandler http.Handler) http.Handler {
	mux := http.NewServeMux()

	// Public Endpoints
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("POST /api/v1/auth/token", h.GenerateToken)

	// WebSocket Endpoint (token checked internally by wsHandler)
	if wsHandler != nil {
		mux.Handle("GET /ws", wsHandler)
	}

	// Protected Endpoints
	authMiddleware := JWTAuthMiddleware(jwtMgr)

	mux.Handle("POST /api/v1/notifications/send", authMiddleware(http.HandlerFunc(h.SendNotification)))
	mux.Handle("GET /api/v1/notifications", authMiddleware(http.HandlerFunc(h.ListNotifications)))
	mux.Handle("GET /api/v1/notifications/stats", authMiddleware(http.HandlerFunc(h.GetStats)))
	mux.Handle("GET /api/v1/notifications/{id}", authMiddleware(http.HandlerFunc(h.GetNotificationByID)))

	// Global middleware stack: Recoverer -> Logger -> CORS -> Mux
	var handler http.Handler = mux
	handler = CORSMiddleware(handler)
	handler = LoggerMiddleware(handler)
	handler = RecovererMiddleware(handler)

	return handler
}
