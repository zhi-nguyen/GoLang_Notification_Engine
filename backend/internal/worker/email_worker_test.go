package worker

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"notification-engine/internal/domain"
	"notification-engine/internal/infrastructure/email"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockRepo struct {
	mock.Mock
}

func (m *mockRepo) Create(ctx context.Context, n *domain.Notification) error {
	return m.Called(ctx, n).Error(0)
}
func (m *mockRepo) GetByID(ctx context.Context, id string) (*domain.Notification, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Notification), args.Error(1)
}
func (m *mockRepo) List(ctx context.Context, limit, offset int) ([]*domain.Notification, error) {
	args := m.Called(ctx, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Notification), args.Error(1)
}
func (m *mockRepo) ListSince(ctx context.Context, sinceTime string, limit int) ([]*domain.Notification, error) {
	args := m.Called(ctx, sinceTime, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Notification), args.Error(1)
}
func (m *mockRepo) UpdateStatus(ctx context.Context, id string, status domain.NotificationStatus, sentCount, failCount int) error {
	return m.Called(ctx, id, status, sentCount, failCount).Error(0)
}
func (m *mockRepo) GetStats(ctx context.Context) (map[string]int, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]int), args.Error(1)
}

func TestMockEmailSender(t *testing.T) {
	sender := email.NewMockEmailSender(10 * time.Millisecond)
	notif := &domain.Notification{
		ID:    "notif_email_1",
		Title: "Welcome Email",
		Body:  "Hello user!",
	}

	err := sender.Send(context.Background(), notif)
	assert.NoError(t, err)
}

func TestEmailWorker_ProcessMessage_Success(t *testing.T) {
	sender := email.NewMockEmailSender(5 * time.Millisecond)
	repo := new(mockRepo)
	worker := NewEmailWorker(nil, sender, repo)

	notif := domain.Notification{
		ID:    "notif_email_100",
		Title: "Weekly Digest",
		Body:  "Here is your update",
	}
	data, _ := json.Marshal(notif)

	repo.On("UpdateStatus", mock.Anything, "notif_email_100", domain.StatusCompleted, 1, 0).Return(nil)

	err := worker.ProcessMessage(context.Background(), data)
	assert.NoError(t, err)

	repo.AssertExpectations(t)
}

func TestEmailWorker_ProcessMessage_InvalidJSON(t *testing.T) {
	sender := email.NewMockEmailSender(5 * time.Millisecond)
	worker := NewEmailWorker(nil, sender, nil)

	err := worker.ProcessMessage(context.Background(), []byte("invalid-json"))
	assert.Error(t, err)
}
