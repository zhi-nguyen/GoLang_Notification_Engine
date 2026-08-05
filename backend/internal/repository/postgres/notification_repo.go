package postgres

import (
	"context"
	"fmt"
	"time"

	"notification-engine/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotificationRepo struct {
	pool *pgxpool.Pool
}

func NewNotificationRepository(pool *pgxpool.Pool) domain.NotificationRepository {
	return &NotificationRepo{pool: pool}
}

func (r *NotificationRepo) Create(ctx context.Context, n *domain.Notification) error {
	query := `
		INSERT INTO notifications (id, title, body, type, channels, target_type, target_ids, status, sent_count, fail_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	now := time.Now()
	if n.CreatedAt.IsZero() {
		n.CreatedAt = now
	}
	n.UpdatedAt = now
	if n.Status == "" {
		n.Status = domain.StatusPending
	}

	_, err := r.pool.Exec(ctx, query,
		n.ID, n.Title, n.Body, n.Type, n.Channels,
		n.Target.Type, n.Target.IDs, n.Status, n.SentCount, n.FailCount,
		n.CreatedAt, n.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert notification: %w", err)
	}
	return nil
}

func (r *NotificationRepo) GetByID(ctx context.Context, id string) (*domain.Notification, error) {
	query := `
		SELECT id, title, body, type, channels, target_type, target_ids, status, sent_count, fail_count, created_at, updated_at
		FROM notifications WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)

	var n domain.Notification
	var targetType string
	var targetIDs []string

	err := row.Scan(
		&n.ID, &n.Title, &n.Body, &n.Type, &n.Channels,
		&targetType, &targetIDs, &n.Status, &n.SentCount, &n.FailCount,
		&n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get notification by id: %w", err)
	}

	n.Target = domain.TargetConfig{
		Type: domain.TargetType(targetType),
		IDs:  targetIDs,
	}
	return &n, nil
}

func (r *NotificationRepo) List(ctx context.Context, limit, offset int) ([]*domain.Notification, error) {
	query := `
		SELECT id, title, body, type, channels, target_type, target_ids, status, sent_count, fail_count, created_at, updated_at
		FROM notifications
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list notifications: %w", err)
	}
	defer rows.Close()

	var result []*domain.Notification
	for rows.Next() {
		var n domain.Notification
		var targetType string
		var targetIDs []string

		if err := rows.Scan(
			&n.ID, &n.Title, &n.Body, &n.Type, &n.Channels,
			&targetType, &targetIDs, &n.Status, &n.SentCount, &n.FailCount,
			&n.CreatedAt, &n.UpdatedAt,
		); err != nil {
			return nil, err
		}
		n.Target = domain.TargetConfig{
			Type: domain.TargetType(targetType),
			IDs:  targetIDs,
		}
		result = append(result, &n)
	}
	return result, nil
}

func (r *NotificationRepo) ListSince(ctx context.Context, sinceTime string, limit int) ([]*domain.Notification, error) {
	t, err := time.Parse(time.RFC3339, sinceTime)
	if err != nil {
		t = time.Unix(0, 0)
	}

	query := `
		SELECT id, title, body, type, channels, target_type, target_ids, status, sent_count, fail_count, created_at, updated_at
		FROM notifications
		WHERE created_at > $1
		ORDER BY created_at ASC
		LIMIT $2
	`
	rows, err := r.pool.Query(ctx, query, t, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list notifications since timestamp: %w", err)
	}
	defer rows.Close()

	var result []*domain.Notification
	for rows.Next() {
		var n domain.Notification
		var targetType string
		var targetIDs []string

		if err := rows.Scan(
			&n.ID, &n.Title, &n.Body, &n.Type, &n.Channels,
			&targetType, &targetIDs, &n.Status, &n.SentCount, &n.FailCount,
			&n.CreatedAt, &n.UpdatedAt,
		); err != nil {
			return nil, err
		}
		n.Target = domain.TargetConfig{
			Type: domain.TargetType(targetType),
			IDs:  targetIDs,
		}
		result = append(result, &n)
	}
	return result, nil
}

func (r *NotificationRepo) UpdateStatus(ctx context.Context, id string, status domain.NotificationStatus, sentCount, failCount int) error {
	query := `
		UPDATE notifications
		SET status = $1, sent_count = $2, fail_count = $3, updated_at = NOW()
		WHERE id = $4
	`
	_, err := r.pool.Exec(ctx, query, status, sentCount, failCount, id)
	if err != nil {
		return fmt.Errorf("failed to update notification status: %w", err)
	}
	return nil
}

func (r *NotificationRepo) GetStats(ctx context.Context) (map[string]int, error) {
	query := `
		SELECT status, COUNT(*)
		FROM notifications
		GROUP BY status
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}
	defer rows.Close()

	stats := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats[status] = count
	}
	return stats, nil
}
