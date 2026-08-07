package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"notification-engine/internal/auth"
	"notification-engine/internal/domain"
	"notification-engine/internal/usecase"
)

type HTTPHandler struct {
	uc     usecase.NotificationUsecase
	jwtMgr *auth.JWTManager
}

func NewHTTPHandler(uc usecase.NotificationUsecase, jwtMgr *auth.JWTManager) *HTTPHandler {
	return &HTTPHandler{
		uc:     uc,
		jwtMgr: jwtMgr,
	}
}

// HealthCheck returns server health status.
func (h *HTTPHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	JSONResponse(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// GenerateToken creates a JWT token for testing/clients.
func (h *HTTPHandler) GenerateToken(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
		body.UserID = "guest-user"
	}

	token, err := h.jwtMgr.GenerateToken(body.UserID)
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{
		"token":   token,
		"user_id": body.UserID,
	})
}

// SendNotification handles POST /api/v1/notifications/send
func (h *HTTPHandler) SendNotification(w http.ResponseWriter, r *http.Request) {
	var req domain.SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	notif, err := h.uc.SendNotification(r.Context(), &req)
	if err != nil {
		if errors.Is(err, usecase.ErrInvalidRequest) {
			JSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		JSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSONResponse(w, http.StatusCreated, map[string]interface{}{
		"message":      "Notification sent successfully",
		"notification": notif,
	})
}

// ListNotifications handles GET /api/v1/notifications
func (h *HTTPHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()

	since := query.Get("since")
	limitStr := query.Get("limit")
	offsetStr := query.Get("offset")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	var list []*domain.Notification
	var err error

	if since != "" {
		list, err = h.uc.ListSince(r.Context(), since, limit)
	} else {
		list, err = h.uc.List(r.Context(), limit, offset)
	}

	if err != nil {
		JSONError(w, http.StatusInternalServerError, "Failed to fetch notifications")
		return
	}

	if list == nil {
		list = []*domain.Notification{}
	}

	JSONResponse(w, http.StatusOK, map[string]interface{}{
		"data":  list,
		"count": len(list),
	})
}

// GetNotificationByID handles GET /api/v1/notifications/{id}
func (h *HTTPHandler) GetNotificationByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		id = r.URL.Query().Get("id")
	}

	if id == "" {
		JSONError(w, http.StatusBadRequest, "Missing notification ID")
		return
	}

	notif, err := h.uc.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, usecase.ErrNotificationNotFound) {
			JSONError(w, http.StatusNotFound, "Notification not found")
			return
		}
		JSONError(w, http.StatusInternalServerError, "Failed to get notification")
		return
	}

	JSONResponse(w, http.StatusOK, map[string]interface{}{
		"notification": notif,
	})
}

// GetStats handles GET /api/v1/notifications/stats
func (h *HTTPHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.uc.GetStats(r.Context())
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "Failed to fetch statistics")
		return
	}

	JSONResponse(w, http.StatusOK, map[string]interface{}{
		"stats": stats,
	})
}
