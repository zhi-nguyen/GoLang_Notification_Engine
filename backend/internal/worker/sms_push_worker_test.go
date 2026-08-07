package worker

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"notification-engine/internal/domain"
	"notification-engine/internal/infrastructure/push"
	"notification-engine/internal/infrastructure/sms"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestMockSMSSender(t *testing.T) {
	sender := sms.NewMockSMSSender(5 * time.Millisecond)
	notif := &domain.Notification{
		ID:    "notif_sms_1",
		Title: "OTP Code",
		Body:  "Your code is 123456",
	}

	err := sender.Send(context.Background(), notif)
	assert.NoError(t, err)
}

func TestMockPushSender(t *testing.T) {
	sender := push.NewMockPushSender(5 * time.Millisecond)
	notif := &domain.Notification{
		ID:    "notif_push_1",
		Title: "New Message",
		Body:  "You have a new message",
	}

	err := sender.Send(context.Background(), notif)
	assert.NoError(t, err)
}

func TestSMSWorker_ProcessMessage_Success(t *testing.T) {
	sender := sms.NewMockSMSSender(5 * time.Millisecond)
	repo := new(mockRepo)
	worker := NewSMSWorker(nil, sender, repo)

	notif := domain.Notification{
		ID:    "notif_sms_100",
		Title: "Security Alert",
		Body:  "New login detected",
	}
	data, _ := json.Marshal(notif)

	repo.On("UpdateStatus", mock.Anything, "notif_sms_100", domain.StatusCompleted, 1, 0).Return(nil)

	err := worker.ProcessMessage(context.Background(), data)
	assert.NoError(t, err)

	repo.AssertExpectations(t)
}

func TestPushWorker_ProcessMessage_Success(t *testing.T) {
	sender := push.NewMockPushSender(5 * time.Millisecond)
	repo := new(mockRepo)
	worker := NewPushWorker(nil, sender, repo)

	notif := domain.Notification{
		ID:    "notif_push_100",
		Title: "App Update",
		Body:  "Version 2.0 released",
	}
	data, _ := json.Marshal(notif)

	repo.On("UpdateStatus", mock.Anything, "notif_push_100", domain.StatusCompleted, 1, 0).Return(nil)

	err := worker.ProcessMessage(context.Background(), data)
	assert.NoError(t, err)

	repo.AssertExpectations(t)
}
