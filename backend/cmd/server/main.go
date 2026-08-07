package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"notification-engine/internal/auth"
	"notification-engine/internal/config"
	"notification-engine/internal/domain"
	"notification-engine/internal/infrastructure/email"
	natsClient "notification-engine/internal/infrastructure/nats"
	"notification-engine/internal/infrastructure/push"
	"notification-engine/internal/infrastructure/sms"
	postgresRepo "notification-engine/internal/repository/postgres"
	httpTransport "notification-engine/internal/transport/http"
	"notification-engine/internal/transport/ws"
	"notification-engine/internal/usecase"
	"notification-engine/internal/worker"
	"notification-engine/pkg/logger"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	// 1. Load Config
	cfg, err := config.Load()
	if err != nil {
		panic("Failed to load configuration: " + err.Error())
	}

	// 2. Initialize Logger
	log := logger.Init(cfg.LogLevel)
	log.Info().Str("port", cfg.APIPort).Msg("Starting GONotification_Engine Server (Phase 3 REST API & Workers)...")

	// Root context for application lifecycle
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 3. JWT Manager
	jwtMgr, err := auth.NewJWTManager(cfg.JWTSecret, 24*time.Hour)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize JWT Manager")
	}

	// 4. PostgreSQL Connection Pool
	var repo domain.NotificationRepository
	dbPool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Warn().Err(err).Msg("Database pool creation failed; running in standalone mode without DB storage")
	} else {
		if err := dbPool.Ping(ctx); err != nil {
			log.Warn().Err(err).Msg("Database ping failed; running without DB storage")
		} else {
			log.Info().Msg("PostgreSQL database connection pool established")
			repo = postgresRepo.NewNotificationRepository(dbPool)
			defer dbPool.Close()
		}
	}

	// 5. NATS Client Connection
	var natsConn *natsClient.NATSClient
	natsConn, err = natsClient.NewClient(cfg.NATSURL)
	if err != nil {
		log.Warn().Err(err).Msg("NATS connection failed; running without real-time pubsub broker")
	} else {
		log.Info().Str("nats_url", cfg.NATSURL).Msg("NATS client & JetStream initialized")
		defer natsConn.Close()
	}

	// 6. Usecase & Senders Layer
	var msgPub domain.MessagePublisher
	if natsConn != nil {
		msgPub = natsConn
	}

	notifUsecase := usecase.NewNotificationUsecase(repo, msgPub)

	emailSender := email.NewMockEmailSender(50 * time.Millisecond)
	smsSender := sms.NewMockSMSSender(50 * time.Millisecond)
	pushSender := push.NewMockPushSender(50 * time.Millisecond)

	// 7. WebSocket Tier
	wsHub := ws.NewHub()
	go wsHub.Run(ctx)

	wsHandler := ws.NewHandler(wsHub, jwtMgr)

	// 8. HTTP API & Router
	httpHandler := httpTransport.NewHTTPHandler(notifUsecase, jwtMgr)
	router := httpTransport.NewRouter(httpHandler, jwtMgr, wsHandler)

	// 9. Workers Initialization
	if natsConn != nil {
		wsWorker := worker.NewWSDeliveryWorker(natsConn.Conn(), wsHub)
		if err := wsWorker.Start(ctx); err != nil {
			log.Error().Err(err).Msg("Failed to start WS Delivery Worker")
		}

		emailWorker := worker.NewEmailWorker(natsConn.JetStream(), emailSender, repo)
		if err := emailWorker.Start(ctx); err != nil {
			log.Error().Err(err).Msg("Failed to start Email Worker")
		}

		smsWorker := worker.NewSMSWorker(natsConn.JetStream(), smsSender, repo)
		if err := smsWorker.Start(ctx); err != nil {
			log.Error().Err(err).Msg("Failed to start SMS Worker")
		}

		pushWorker := worker.NewPushWorker(natsConn.JetStream(), pushSender, repo)
		if err := pushWorker.Start(ctx); err != nil {
			log.Error().Err(err).Msg("Failed to start Push Worker")
		}
	} else {
		log.Warn().Msg("NATS not connected; background channel workers will not consume queue messages")
	}

	// 10. HTTP Server Setup
	server := &http.Server{
		Addr:         ":" + cfg.APIPort,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Str("addr", server.Addr).Msg("GONotification_Engine Server listening")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("HTTP server crashed")
		}
	}()

	// 11. Graceful Shutdown Signal Handling
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	<-stopChan
	log.Info().Msg("Shutdown signal received, initiating graceful shutdown...")

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("HTTP server forced shutdown")
	}

	log.Info().Msg("GONotification_Engine Server stopped gracefully")
}
