package usecase

import (
	"context"
	"testing"
	"time"

	"notification-engine/internal/domain"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock NotificationRepository
type MockNotificationRepo struct {
	mock.Mock
}

func (m *MockNotificationRepo) Create(ctx context.Context, n *domain.Notification) error {
	args := m.Called(ctx, n)
	return args.Error(0)
}

func (m *MockNotificationRepo) GetByID(ctx context.Context, id string) (*domain.Notification, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.Notification), args.Error(1)
}

func (m *MockNotificationRepo) List(ctx context.Context, limit, offset int) ([]*domain.Notification, error) {
	args := m.Called(ctx, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Notification), args.Error(1)
}

func (m *MockNotificationRepo) ListSince(ctx context.Context, sinceTime string, limit int) ([]*domain.Notification, error) {
	args := m.Called(ctx, sinceTime, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.Notification), args.Error(1)
}

func (m *MockNotificationRepo) UpdateStatus(ctx context.Context, id string, status domain.NotificationStatus, sentCount, failCount int) error {
	args := m.Called(ctx, id, status, sentCount, failCount)
	return args.Error(0)
}

func (m *MockNotificationRepo) GetStats(ctx context.Context) (map[string]int, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]int), args.Error(1)
}

// Mock MessagePublisher
type MockMessagePublisher struct {
	mock.Mock
}

func (m *MockMessagePublisher) PublishBroadcast(ctx context.Context, n *domain.Notification) error {
	args := m.Called(ctx, n)
	return args.Error(0)
}

func (m *MockMessagePublisher) PublishToUser(ctx context.Context, userID string, n *domain.Notification) error {
	args := m.Called(ctx, userID, n)
	return args.Error(0)
}

func (m *MockMessagePublisher) PublishWorkerTask(ctx context.Context, channel string, n *domain.Notification) error {
	args := m.Called(ctx, channel, n)
	return args.Error(0)
}

func TestSendNotification_Success(t *testing.T) {
	repo := new(MockNotificationRepo)
	pub := new(MockMessagePublisher)
	uc := NewNotificationUsecase(repo, pub)

	req := &domain.SendRequest{
		Title:    "Test Title",
		Body:     "Test Body",
		Type:     domain.TypeEmail,
		Channels: []string{"email"},
		Target: domain.TargetConfig{
			Type: domain.TargetAll,
		},
	}

	repo.On("Create", mock.Anything, mock.AnythingOfType("*domain.Notification")).Return(nil)
	pub.On("PublishBroadcast", mock.Anything, mock.AnythingOfType("*domain.Notification")).Return(nil)
	pub.On("PublishWorkerTask", mock.Anything, "email", mock.AnythingOfType("*domain.Notification")).Return(nil)

	notif, err := uc.SendNotification(context.Background(), req)

	assert.NoError(t, err)
	assert.NotNil(t, notif)
	assert.Equal(t, "Test Title", notif.Title)
	assert.Equal(t, "Test Body", notif.Body)
	assert.Equal(t, domain.TypeEmail, notif.Type)
	assert.Equal(t, domain.StatusPending, notif.Status)

	repo.AssertExpectations(t)
	pub.AssertExpectations(t)
}

func TestSendNotification_UserTarget(t *testing.T) {
	repo := new(MockNotificationRepo)
	pub := new(MockMessagePublisher)
	uc := NewNotificationUsecase(repo, pub)

	req := &domain.SendRequest{
		Title: "User Alert",
		Body:  "Personal Message",
		Target: domain.TargetConfig{
			Type: domain.TargetUser,
			IDs:  []string{"user1", "user2"},
		},
	}

	repo.On("Create", mock.Anything, mock.AnythingOfType("*domain.Notification")).Return(nil)
	pub.On("PublishToUser", mock.Anything, "user1", mock.AnythingOfType("*domain.Notification")).Return(nil)
	pub.On("PublishToUser", mock.Anything, "user2", mock.AnythingOfType("*domain.Notification")).Return(nil)

	notif, err := uc.SendNotification(context.Background(), req)

	assert.NoError(t, err)
	assert.NotNil(t, notif)
	repo.AssertExpectations(t)
	pub.AssertExpectations(t)
}

func TestSendNotification_InvalidRequest(t *testing.T) {
	uc := NewNotificationUsecase(nil, nil)

	_, err := uc.SendNotification(context.Background(), &domain.SendRequest{})
	assert.ErrorIs(t, err, ErrInvalidRequest)
}

func TestGetByID_Success(t *testing.T) {
	repo := new(MockNotificationRepo)
	uc := NewNotificationUsecase(repo, nil)

	expected := &domain.Notification{ID: "notif_123", Title: "Title", Body: "Body"}
	repo.On("GetByID", mock.Anything, "notif_123").Return(expected, nil)

	notif, err := uc.GetByID(context.Background(), "notif_123")
	assert.NoError(t, err)
	assert.Equal(t, expected, notif)
}

func TestGetByID_NotFound(t *testing.T) {
	repo := new(MockNotificationRepo)
	uc := NewNotificationUsecase(repo, nil)

	repo.On("GetByID", mock.Anything, "notif_404").Return(nil, nil)

	_, err := uc.GetByID(context.Background(), "notif_404")
	assert.ErrorIs(t, err, ErrNotificationNotFound)
}

func TestListAndStats(t *testing.T) {
	repo := new(MockNotificationRepo)
	uc := NewNotificationUsecase(repo, nil)

	expectedList := []*domain.Notification{{ID: "1"}}
	expectedStats := map[string]int{"completed": 10, "pending": 2}

	repo.On("List", mock.Anything, 20, 0).Return(expectedList, nil)
	repo.On("ListSince", mock.Anything, "2026-01-01T00:00:00Z", 20).Return(expectedList, nil)
	repo.On("GetStats", mock.Anything).Return(expectedStats, nil)

	list, err := uc.List(context.Background(), 0, 0)
	assert.NoError(t, err)
	assert.Equal(t, expectedList, list)

	sinceList, err := uc.ListSince(context.Background(), "2026-01-01T00:00:00Z", 0)
	assert.NoError(t, err)
	assert.Equal(t, expectedList, sinceList)

	stats, err := uc.GetStats(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, expectedStats, stats)
}

func TestList_NilRepo(t *testing.T) {
	uc := NewNotificationUsecase(nil, nil)

	list, err := uc.List(context.Background(), 10, 0)
	assert.NoError(t, err)
	assert.Empty(t, list)

	sinceList, err := uc.ListSince(context.Background(), time.Now().Format(time.RFC3339), 10)
	assert.NoError(t, err)
	assert.Empty(t, sinceList)

	stats, err := uc.GetStats(context.Background())
	assert.NoError(t, err)
	assert.NotNil(t, stats)
}
