package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"notification-engine/internal/auth"

	"github.com/stretchr/testify/assert"
)

func TestCORSMiddleware(t *testing.T) {
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	handler := CORSMiddleware(nextHandler)

	// Test OPTIONS preflight
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusNoContent, rr.Code)
	assert.Equal(t, "*", rr.Header().Get("Access-Control-Allow-Origin"))

	// Test GET request
	reqGET := httptest.NewRequest(http.MethodGet, "/test", nil)
	rrGET := httptest.NewRecorder()
	handler.ServeHTTP(rrGET, reqGET)

	assert.Equal(t, http.StatusOK, rrGET.Code)
	assert.Equal(t, "OK", rrGET.Body.String())
}

func TestRecovererMiddleware(t *testing.T) {
	panicHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("something went wrong")
	})

	handler := RecovererMiddleware(panicHandler)
	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	rr := httptest.NewRecorder()

	assert.NotPanics(t, func() {
		handler.ServeHTTP(rr, req)
	})

	assert.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.Contains(t, rr.Body.String(), "Internal Server Error")
}

func TestJWTAuthMiddleware(t *testing.T) {
	jwtMgr, err := auth.NewJWTManager("test-secret-key-12345", 1*time.Hour)
	assert.NoError(t, err)

	protectedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := r.Context().Value(UserIDKey).(string)
		if !ok {
			http.Error(w, "no user in context", http.StatusInternalServerError)
			return
		}
		JSONResponse(w, http.StatusOK, map[string]string{"user": userID})
	})

	authMiddleware := JWTAuthMiddleware(jwtMgr)
	handler := authMiddleware(protectedHandler)

	// Case 1: Missing header
	req1 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)
	assert.Equal(t, http.StatusUnauthorized, rr1.Code)

	// Case 2: Invalid header format
	req2 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req2.Header.Set("Authorization", "InvalidFormat token")
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2)
	assert.Equal(t, http.StatusUnauthorized, rr2.Code)

	// Case 3: Invalid token
	req3 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req3.Header.Set("Authorization", "Bearer invalidtoken")
	rr3 := httptest.NewRecorder()
	handler.ServeHTTP(rr3, req3)
	assert.Equal(t, http.StatusUnauthorized, rr3.Code)

	// Case 4: Valid token
	validToken, err := jwtMgr.GenerateToken("user-123")
	assert.NoError(t, err)

	req4 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req4.Header.Set("Authorization", "Bearer "+validToken)
	rr4 := httptest.NewRecorder()
	handler.ServeHTTP(rr4, req4)

	assert.Equal(t, http.StatusOK, rr4.Code)
	assert.Contains(t, rr4.Body.String(), "user-123")
}
