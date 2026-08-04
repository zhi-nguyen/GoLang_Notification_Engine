package nats

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"notification-engine/internal/domain"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/zerolog/log"
)

const (
	StreamNotifications = "NOTIFICATIONS"
	SubjectNotificationsAll = "notifications.>"
	SubjectEmail = "notifications.email"
	SubjectSMS = "notifications.sms"
	SubjectPush = "notifications.push"

	SubjectWSBroadcast = "ws.broadcast"
	SubjectWSUserPrefix = "ws.user."
)

type NATSClient struct {
	nc *nats.Conn
	js jetstream.JetStream
}

func NewClient(url string) (*NATSClient, error) {
	nc, err := nats.Connect(url,
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
		nats.DisconnectErrHandler(func(c *nats.Conn, err error) {
			log.Warn().Err(err).Msg("NATS disconnected")
		}),
		nats.ReconnectHandler(func(c *nats.Conn) {
			log.Info().Str("url", c.ConnectedUrl()).Msg("NATS reconnected")
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS at %s: %w", url, err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to create JetStream context: %w", err)
	}

	client := &NATSClient{nc: nc, js: js}

	if err := client.initStreams(context.Background()); err != nil {
		nc.Close()
		return nil, fmt.Errorf("failed to initialize NATS streams: %w", err)
	}

	return client, nil
}

func (c *NATSClient) initStreams(ctx context.Context) error {
	streamConfig := jetstream.StreamConfig{
		Name:      StreamNotifications,
		Subjects:  []string{SubjectNotificationsAll},
		Retention: jetstream.WorkQueuePolicy,
		Storage:   jetstream.FileStorage,
	}

	_, err := c.js.CreateOrUpdateStream(ctx, streamConfig)
	if err != nil {
		return fmt.Errorf("failed to create/update stream %s: %w", StreamNotifications, err)
	}

	log.Info().Str("stream", StreamNotifications).Msg("NATS JetStream initialized successfully")
	return nil
}

func (c *NATSClient) Conn() *nats.Conn {
	return c.nc
}

func (c *NATSClient) JetStream() jetstream.JetStream {
	return c.js
}

func (c *NATSClient) PublishBroadcast(ctx context.Context, n *domain.Notification) error {
	data, err := json.Marshal(n)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}
	return c.nc.Publish(SubjectWSBroadcast, data)
}

func (c *NATSClient) PublishToUser(ctx context.Context, userID string, n *domain.Notification) error {
	data, err := json.Marshal(n)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}
	subject := SubjectWSUserPrefix + userID
	return c.nc.Publish(subject, data)
}

func (c *NATSClient) PublishWorkerTask(ctx context.Context, channel string, n *domain.Notification) error {
	data, err := json.Marshal(n)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}
	subject := fmt.Sprintf("notifications.%s", channel)
	_, err = c.js.Publish(ctx, subject, data)
	if err != nil {
		return fmt.Errorf("failed to publish worker task to JetStream subject %s: %w", subject, err)
	}
	return nil
}

func (c *NATSClient) Close() {
	if c.nc != nil {
		c.nc.Close()
	}
}
