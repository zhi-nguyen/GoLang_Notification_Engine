package email

import (
	"context"
	"time"

	"notification-engine/internal/domain"

	"github.com/rs/zerolog/log"
)

type MockEmailSender struct {
	Delay time.Duration
}

func NewMockEmailSender(delay time.Duration) domain.NotificationSender {
	if delay <= 0 {
		delay = 50 * time.Millisecond
	}
	return &MockEmailSender{
		Delay: delay,
	}
}

func (s *MockEmailSender) Send(ctx context.Context, n *domain.Notification) error {
	log.Info().
		Str("id", n.ID).
		Str("title", n.Title).
		Str("channel", "email").
		Msg("[MockEmailSender] Sending email notification...")

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(s.Delay):
	}

	log.Info().
		Str("id", n.ID).
		Str("title", n.Title).
		Str("channel", "email").
		Msg("[MockEmailSender] Email sent successfully!")

	return nil
}
