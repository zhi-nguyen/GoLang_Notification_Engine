package main

import (
	"notification-engine/internal/auth"
	"notification-engine/internal/config"
	"notification-engine/pkg/logger"
	"time"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log := logger.Init(cfg.LogLevel)
	log.Info().Str("port", cfg.APIPort).Msg("Starting GONotification_Engine Server (Phase 1 Foundation)...")

	jwtMgr, err := auth.NewJWTManager(cfg.JWTSecret, 24*time.Hour)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize JWT Manager")
	}

	token, _ := jwtMgr.GenerateToken("admin-init")
	log.Info().Str("init_token", token).Msg("Phase 1 initialization complete")
}
