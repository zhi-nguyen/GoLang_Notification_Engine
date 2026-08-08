package usecase

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"notification-engine/internal/domain"

	"github.com/rs/zerolog/log"
)

var (
	ErrInvalidRequest       = errors.New("invalid notification send request")
	ErrNotificationNotFound = errors.New("notification not found")
)

type NotificationUsecase interface {
	SendNotification(ctx context.Context, req *domain.SendRequest) (*domain.Notification, error)
	GetByID(ctx context.Context, id string) (*domain.Notification, error)
	List(ctx context.Context, limit, offset int) ([]*domain.Notification, error)
	ListSince(ctx context.Context, sinceTime string, limit int) ([]*domain.Notification, error)
	GetStats(ctx context.Context) (map[string]int, error)
}

type notificationUsecase struct {
	repo domain.NotificationRepository
	pub  domain.MessagePublisher
}

func NewNotificationUsecase(repo domain.NotificationRepository, pub domain.MessagePublisher) NotificationUsecase {
	return &notificationUsecase{
		repo: repo,
		pub:  pub,
	}
}

func generateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func (uc *notificationUsecase) SendNotification(ctx context.Context, req *domain.SendRequest) (*domain.Notification, error) {
	if req == nil || req.Title == "" || req.Body == "" {
		return nil, fmt.Errorf("%w: title and body are required", ErrInvalidRequest)
	}

	if req.Type == "" {
		req.Type = domain.TypeAppAlert
	}

	if req.Target.Type == "" {
		req.Target.Type = domain.TargetAll
	}

	now := time.Now()
	notifID := generateUUID()

	notif := &domain.Notification{
		ID:        notifID,
		Title:     req.Title,
		Body:      req.Body,
		Type:      req.Type,
		Channels:  req.Channels,
		Target:    req.Target,
		Status:    domain.StatusPending,
		SentCount: 0,
		FailCount: 0,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// 1. Save to Database
	if uc.repo != nil {
		if err := uc.repo.Create(ctx, notif); err != nil {
			return nil, fmt.Errorf("failed to store notification: %w", err)
		}
	}

	// 2. Publish to NATS / WebSocket Real-time delivery
	if uc.pub != nil {
		if req.Target.Type == domain.TargetAll {
			if err := uc.pub.PublishBroadcast(ctx, notif); err != nil {
				log.Error().Err(err).Str("id", notif.ID).Msg("Failed to publish WS broadcast")
			}
		} else if len(req.Target.IDs) > 0 {
			for _, targetID := range req.Target.IDs {
				if err := uc.pub.PublishToUser(ctx, targetID, notif); err != nil {
					log.Error().Err(err).Str("id", notif.ID).Str("user_id", targetID).Msg("Failed to publish WS to user")
				}
			}
		}

		// 3. Publish to async worker channels (email, sms, push)
		for _, channel := range req.Channels {
			if err := uc.pub.PublishWorkerTask(ctx, channel, notif); err != nil {
				log.Error().Err(err).Str("id", notif.ID).Str("channel", channel).Msg("Failed to publish worker task")
			}
		}
	}

	log.Info().Str("id", notif.ID).Str("type", string(notif.Type)).Msg("Notification dispatched successfully")
	return notif, nil
}

func (uc *notificationUsecase) GetByID(ctx context.Context, id string) (*domain.Notification, error) {
	if id == "" {
		return nil, fmt.Errorf("%w: empty id", ErrInvalidRequest)
	}

	if uc.repo == nil {
		return nil, ErrNotificationNotFound
	}

	notif, err := uc.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if notif == nil {
		return nil, ErrNotificationNotFound
	}

	return notif, nil
}

func (uc *notificationUsecase) List(ctx context.Context, limit, offset int) ([]*domain.Notification, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	if uc.repo == nil {
		return []*domain.Notification{}, nil
	}

	return uc.repo.List(ctx, limit, offset)
}

func (uc *notificationUsecase) ListSince(ctx context.Context, sinceTime string, limit int) ([]*domain.Notification, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	if uc.repo == nil {
		return []*domain.Notification{}, nil
	}

	return uc.repo.ListSince(ctx, sinceTime, limit)
}

func (uc *notificationUsecase) GetStats(ctx context.Context) (map[string]int, error) {
	if uc.repo == nil {
		return map[string]int{
			"pending":   0,
			"sending":   0,
			"completed": 0,
			"failed":    0,
		}, nil
	}

	return uc.repo.GetStats(ctx)
}
