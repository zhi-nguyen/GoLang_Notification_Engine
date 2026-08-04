package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestJWTManager_GenerateAndValidate(t *testing.T) {
	secret := "super-secret-key-that-is-long-enough-32bytes"
	mgr, err := NewJWTManager(secret, 15*time.Minute)
	assert.NoError(t, err)

	token, err := mgr.GenerateToken("user-123")
	assert.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := mgr.ValidateToken(token)
	assert.NoError(t, err)
	assert.Equal(t, "user-123", claims.UserID)
}

func TestJWTManager_ExpiredToken(t *testing.T) {
	secret := "super-secret-key-that-is-long-enough-32bytes"
	mgr, err := NewJWTManager(secret, -1*time.Minute) // Expired
	assert.NoError(t, err)

	token, err := mgr.GenerateToken("user-123")
	assert.NoError(t, err)

	_, err = mgr.ValidateToken(token)
	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrInvalidToken)
}

func TestJWTManager_EmptySecret(t *testing.T) {
	_, err := NewJWTManager("", 15*time.Minute)
	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrMissingKey)
}
