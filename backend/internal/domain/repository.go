package domain

import "context"

type NotificationRepository interface {
	Create(ctx context.Context, n *Notification) error
	GetByID(ctx context.Context, id string) (*Notification, error)
	List(ctx context.Context, limit, offset int) ([]*Notification, error)
	ListSince(ctx context.Context, sinceTime string, limit int) ([]*Notification, error)
	UpdateStatus(ctx context.Context, id string, status NotificationStatus, sentCount, failCount int) error
	GetStats(ctx context.Context) (map[string]int, error)
}

type MessagePublisher interface {
	PublishBroadcast(ctx context.Context, n *Notification) error
	PublishToUser(ctx context.Context, userID string, n *Notification) error
	PublishWorkerTask(ctx context.Context, channel string, n *Notification) error
}

type NotificationSender interface {
	Send(ctx context.Context, n *Notification) error
}
