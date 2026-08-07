package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"notification-engine/internal/auth"
	"notification-engine/internal/domain"
	"notification-engine/internal/usecase"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockUsecase struct {
	mock.Mock
}

func (m *mockUsecase) SendNotification(ctx context.Context, req *domain.SendRequest) (*domain.Notification, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Notification), args.Error(1)
}

func (m *mockUsecase) GetByID(ctx context.Context, id string) (*domain.Notification, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Notification), args.Error(1)
}

func (m *mockUsecase) List(ctx context.Context, limit, offset int) ([]*domain.Notification, error) {
	args := m.Called(ctx, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Notification), args.Error(1)
}

func (m *mockUsecase) ListSince(ctx context.Context, sinceTime string, limit int) ([]*domain.Notification, error) {
	args := m.Called(ctx, sinceTime, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Notification), args.Error(1)
}

func (m *mockUsecase) GetStats(ctx context.Context) (map[string]int, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]int), args.Error(1)
}

func setupTestServer(t *testing.T) (*mockUsecase, *auth.JWTManager, http.Handler, string) {
	jwtMgr, err := auth.NewJWTManager("test-secret-key-12345", 1*time.Hour)
	assert.NoError(t, err)

	token, err := jwtMgr.GenerateToken("admin")
	assert.NoError(t, err)

	uc := new(mockUsecase)
	handler := NewHTTPHandler(uc, jwtMgr)
	router := NewRouter(handler, jwtMgr, nil)

	return uc, jwtMgr, router, token
}

func TestHealthCheck(t *testing.T) {
	_, _, router, _ := setupTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "ok")
}

func TestGenerateToken(t *testing.T) {
	_, _, router, _ := setupTestServer(t)

	body := map[string]string{"user_id": "test-user-1"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/token", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "token")
	assert.Contains(t, rr.Body.String(), "test-user-1")
}

func TestSendNotificationEndpoint(t *testing.T) {
	uc, _, router, token := setupTestServer(t)

	sendReq := &domain.SendRequest{
		Title: "Test Title",
		Body:  "Test Body",
	}
	jsonBody, _ := json.Marshal(sendReq)

	expectedNotif := &domain.Notification{
		ID:    "notif_100",
		Title: "Test Title",
		Body:  "Test Body",
	}

	uc.On("SendNotification", mock.Anything, sendReq).Return(expectedNotif, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/notifications/send", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
	assert.Contains(t, rr.Body.String(), "notif_100")
	uc.AssertExpectations(t)
}

func TestListNotificationsEndpoint(t *testing.T) {
	uc, _, router, token := setupTestServer(t)

	expectedList := []*domain.Notification{{ID: "notif_1"}, {ID: "notif_2"}}
	uc.On("List", mock.Anything, 20, 0).Return(expectedList, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notifications?limit=20&offset=0", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "notif_1")
	assert.Contains(t, rr.Body.String(), "notif_2")
	uc.AssertExpectations(t)
}

func TestGetNotificationByIDEndpoint(t *testing.T) {
	uc, _, router, token := setupTestServer(t)

	expectedNotif := &domain.Notification{ID: "notif_999", Title: "Find Me"}
	uc.On("GetByID", mock.Anything, "notif_999").Return(expectedNotif, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notifications/notif_999", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "Find Me")

	// Test Not Found
	uc.On("GetByID", mock.Anything, "notif_404").Return(nil, usecase.ErrNotificationNotFound)
	req404 := httptest.NewRequest(http.MethodGet, "/api/v1/notifications/notif_404", nil)
	req404.Header.Set("Authorization", "Bearer "+token)

	rr404 := httptest.NewRecorder()
	router.ServeHTTP(rr404, req404)

	assert.Equal(t, http.StatusNotFound, rr404.Code)
	uc.AssertExpectations(t)
}

func TestGetStatsEndpoint(t *testing.T) {
	uc, _, router, token := setupTestServer(t)

	expectedStats := map[string]int{"completed": 5, "pending": 1}
	uc.On("GetStats", mock.Anything).Return(expectedStats, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notifications/stats", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "completed")
	uc.AssertExpectations(t)
}
