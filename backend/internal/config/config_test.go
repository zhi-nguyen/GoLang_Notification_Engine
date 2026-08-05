package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadConfig(t *testing.T) {
	os.Setenv("API_PORT", "9090")
	os.Setenv("JWT_SECRET", "super-secret-key-that-is-long-enough")
	defer func() {
		os.Unsetenv("API_PORT")
		os.Unsetenv("JWT_SECRET")
	}()

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, "9090", cfg.APIPort)
	assert.Equal(t, "super-secret-key-that-is-long-enough", cfg.JWTSecret)
	assert.Equal(t, 100000, cfg.WSMaxConnections)
}

func TestConfigValidate_ShortSecret(t *testing.T) {
	cfg := &Config{
		JWTSecret:   "short",
		DatabaseURL: "postgres://localhost",
		NATSURL:     "nats://localhost",
	}

	err := cfg.Validate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET must be at least 16 characters")
}
