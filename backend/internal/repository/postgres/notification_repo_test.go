package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"notification-engine/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
)

func TestNotificationRepo_Integration(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://user:pass@127.0.0.1:5435/notifications?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping DB integration test: pool creation failed: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		t.Skipf("Skipping DB integration test: DB ping failed: %v", err)
	}

	repo := NewNotificationRepository(pool)

	validUUID := "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

	// Test 1: Create
	testNotif := &domain.Notification{
		ID:    validUUID,
		Title: "Test Integration Title",
		Body:  "Test Integration Body",
		Type:  domain.TypeAppAlert,
		Channels: []string{"email"},
		Target: domain.TargetConfig{
			Type: domain.TargetAll,
		},
		Status: domain.StatusPending,
	}

	err = repo.Create(ctx, testNotif)
	assert.NoError(t, err)

	// Test 2: GetByID
	fetched, err := repo.GetByID(ctx, validUUID)
	assert.NoError(t, err)
	if assert.NotNil(t, fetched) {
		assert.Equal(t, testNotif.Title, fetched.Title)
	}

	// Test 3: UpdateStatus
	err = repo.UpdateStatus(ctx, validUUID, domain.StatusCompleted, 1, 0)
	assert.NoError(t, err)

	// Test 4: GetStats
	stats, err := repo.GetStats(ctx)
	assert.NoError(t, err)
	assert.NotNil(t, stats)
}
