package push

import (
	"context"
	"time"

	"notification-engine/internal/domain"

	"github.com/rs/zerolog/log"
)

type MockPushSender struct {
	Delay time.Duration
}

func NewMockPushSender(delay time.Duration) domain.NotificationSender {
	if delay <= 0 {
		delay = 50 * time.Millisecond
	}
	return &MockPushSender{
		Delay: delay,
	}
}

func (s *MockPushSender) Send(ctx context.Context, n *domain.Notification) error {
	log.Info().
		Str("id", n.ID).
		Str("title", n.Title).
		Str("channel", "push").
		Msg("[MockPushSender] Sending Push notification...")

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(s.Delay):
	}

	log.Info().
		Str("id", n.ID).
		Str("title", n.Title).
		Str("channel", "push").
		Msg("[MockPushSender] Push notification sent successfully!")

	return nil
}
