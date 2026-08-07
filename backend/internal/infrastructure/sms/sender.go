package sms

import (
	"context"
	"time"

	"notification-engine/internal/domain"

	"github.com/rs/zerolog/log"
)

type MockSMSSender struct {
	Delay time.Duration
}

func NewMockSMSSender(delay time.Duration) domain.NotificationSender {
	if delay <= 0 {
		delay = 50 * time.Millisecond
	}
	return &MockSMSSender{
		Delay: delay,
	}
}

func (s *MockSMSSender) Send(ctx context.Context, n *domain.Notification) error {
	log.Info().
		Str("id", n.ID).
		Str("title", n.Title).
		Str("channel", "sms").
		Msg("[MockSMSSender] Sending SMS notification...")

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(s.Delay):
	}

	log.Info().
		Str("id", n.ID).
		Str("title", n.Title).
		Str("channel", "sms").
		Msg("[MockSMSSender] SMS sent successfully!")

	return nil
}
