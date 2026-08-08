package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	APIPort          string
	WSMaxConnections int
	DatabaseURL      string
	NATSURL          string
	JWTSecret        string
	LogLevel         string
	EmailProvider    string
	SMSProvider      string
	PushProvider     string
}

func Load() (*Config, error) {
	// Attempt to load .env file from root or backend directory if present
	loadDotEnv(".env")
	loadDotEnv("../.env")
	loadDotEnv("../../.env")

	cfg := &Config{
		APIPort:          getEnv("API_PORT", "8080"),
		WSMaxConnections: getEnvInt("WS_MAX_CONNECTIONS", 100000),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://user:pass@127.0.0.1:5435/notifications?sslmode=disable"),
		NATSURL:          getEnv("NATS_URL", "nats://127.0.0.1:4222"),
		JWTSecret:        getEnv("JWT_SECRET", "change-me-in-production-super-secret-key-32-bytes"),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		EmailProvider:    getEnv("EMAIL_PROVIDER", "mock"),
		SMSProvider:      getEnv("SMS_PROVIDER", "mock"),
		PushProvider:     getEnv("PUSH_PROVIDER", "mock"),
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET must not be empty")
	}
	if len(c.JWTSecret) < 16 {
		return fmt.Errorf("JWT_SECRET must be at least 16 characters long")
	}
	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL must not be empty")
	}
	if c.NATSURL == "" {
		return fmt.Errorf("NATS_URL must not be empty")
	}
	return nil
}

func loadDotEnv(filename string) {
	absPath, err := filepath.Abs(filename)
	if err != nil {
		return
	}
	file, err := os.Open(absPath)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			if os.Getenv(key) == "" {
				_ = os.Setenv(key, val)
			}
		}
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	valStr := getEnv(key, "")
	if valStr == "" {
		return fallback
	}
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return fallback
	}
	return val
}
