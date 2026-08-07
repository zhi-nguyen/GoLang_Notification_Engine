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

type SMSWorker struct {
	js     jetstream.JetStream
	sender domain.NotificationSender
	repo   domain.NotificationRepository
}

func NewSMSWorker(js jetstream.JetStream, sender domain.NotificationSender, repo domain.NotificationRepository) *SMSWorker {
	return &SMSWorker{
		js:     js,
		sender: sender,
		repo:   repo,
	}
}

func (w *SMSWorker) ProcessMessage(ctx context.Context, data []byte) error {
	var notif domain.Notification
	if err := json.Unmarshal(data, &notif); err != nil {
		return fmt.Errorf("failed to unmarshal notification data: %w", err)
	}

	if err := w.sender.Send(ctx, &notif); err != nil {
		log.Error().Err(err).Str("id", notif.ID).Msg("SMSWorker failed to send SMS")
		if w.repo != nil {
			_ = w.repo.UpdateStatus(ctx, notif.ID, domain.StatusFailed, 0, 1)
		}
		return err
	}

	if w.repo != nil {
		_ = w.repo.UpdateStatus(ctx, notif.ID, domain.StatusCompleted, 1, 0)
	}

	log.Info().Str("id", notif.ID).Msg("SMSWorker processed notification successfully")
	return nil
}

func (w *SMSWorker) Start(ctx context.Context) error {
	if w.js == nil {
		log.Warn().Msg("NATS JetStream not configured, SMSWorker skipping consumer creation")
		return nil
	}

	consumer, err := w.js.CreateOrUpdateConsumer(ctx, natsClient.StreamNotifications, jetstream.ConsumerConfig{
		Durable:       "sms-worker",
		FilterSubject: natsClient.SubjectSMS,
		AckPolicy:     jetstream.AckExplicitPolicy,
	})
	if err != nil {
		return fmt.Errorf("failed to create/update sms consumer: %w", err)
	}

	log.Info().Msg("SMSWorker started, consuming on subject: " + natsClient.SubjectSMS)

	cc, err := consumer.Consume(func(msg jetstream.Msg) {
		if err := w.ProcessMessage(ctx, msg.Data()); err != nil {
			log.Error().Err(err).Msg("SMSWorker error processing message")
			_ = msg.Nak()
			return
		}
		_ = msg.Ack()
	})
	if err != nil {
		return fmt.Errorf("failed to start consume loop for sms worker: %w", err)
	}

	go func() {
		<-ctx.Done()
		cc.Stop()
		log.Info().Msg("SMSWorker consumer stopped")
	}()

	return nil
}
