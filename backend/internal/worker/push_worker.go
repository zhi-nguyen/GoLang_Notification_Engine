package worker

import (
	"context"
	"encoding/json"
	"fmt"

	"notification-engine/internal/domain"
	natsClient "notification-engine/internal/infrastructure/nats"

	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/zerolog/log"
)

type PushWorker struct {
	js     jetstream.JetStream
	sender domain.NotificationSender
	repo   domain.NotificationRepository
}

func NewPushWorker(js jetstream.JetStream, sender domain.NotificationSender, repo domain.NotificationRepository) *PushWorker {
	return &PushWorker{
		js:     js,
		sender: sender,
		repo:   repo,
	}
}

func (w *PushWorker) ProcessMessage(ctx context.Context, data []byte) error {
	var notif domain.Notification
	if err := json.Unmarshal(data, &notif); err != nil {
		return fmt.Errorf("failed to unmarshal notification data: %w", err)
	}

	if err := w.sender.Send(ctx, &notif); err != nil {
		log.Error().Err(err).Str("id", notif.ID).Msg("PushWorker failed to send Push notification")
		if w.repo != nil {
			_ = w.repo.UpdateStatus(ctx, notif.ID, domain.StatusFailed, 0, 1)
		}
		return err
	}

	if w.repo != nil {
		_ = w.repo.UpdateStatus(ctx, notif.ID, domain.StatusCompleted, 1, 0)
	}

	log.Info().Str("id", notif.ID).Msg("PushWorker processed notification successfully")
	return nil
}

func (w *PushWorker) Start(ctx context.Context) error {
	if w.js == nil {
		log.Warn().Msg("NATS JetStream not configured, PushWorker skipping consumer creation")
		return nil
	}

	consumer, err := w.js.CreateOrUpdateConsumer(ctx, natsClient.StreamNotifications, jetstream.ConsumerConfig{
		Durable:       "push-worker",
		FilterSubject: natsClient.SubjectPush,
		AckPolicy:     jetstream.AckExplicitPolicy,
	})
	if err != nil {
		return fmt.Errorf("failed to create/update push consumer: %w", err)
	}

	log.Info().Msg("PushWorker started, consuming on subject: " + natsClient.SubjectPush)

	cc, err := consumer.Consume(func(msg jetstream.Msg) {
		if err := w.ProcessMessage(ctx, msg.Data()); err != nil {
			log.Error().Err(err).Msg("PushWorker error processing message")
			_ = msg.Nak()
			return
		}
		_ = msg.Ack()
	})
	if err != nil {
		return fmt.Errorf("failed to start consume loop for push worker: %w", err)
	}

	go func() {
		<-ctx.Done()
		cc.Stop()
		log.Info().Msg("PushWorker consumer stopped")
	}()

	return nil
}
