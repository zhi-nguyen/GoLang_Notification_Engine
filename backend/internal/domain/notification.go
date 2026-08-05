package domain

import (
	"time"
)

type NotificationType string

const (
	TypePush     NotificationType = "push"
	TypeEmail    NotificationType = "email"
	TypeSMS      NotificationType = "sms"
	TypeAppAlert NotificationType = "app_alert"
)

type TargetType string

const (
	TargetAll     TargetType = "all"
	TargetUser    TargetType = "user"
	TargetSegment TargetType = "segment"
)

type TargetConfig struct {
	Type TargetType `json:"type"`
	IDs  []string   `json:"ids,omitempty"`
}

type NotificationStatus string

const (
	StatusPending   NotificationStatus = "pending"
	StatusSending   NotificationStatus = "sending"
	StatusCompleted NotificationStatus = "completed"
	StatusFailed    NotificationStatus = "failed"
)

type Notification struct {
	ID        string             `json:"id"`
	Title     string             `json:"title"`
	Body      string             `json:"body"`
	Type      NotificationType   `json:"type"`
	Channels  []string           `json:"channels"`
	Target    TargetConfig       `json:"target"`
	Status    NotificationStatus `json:"status"`
	SentCount int                `json:"sent_count"`
	FailCount int                `json:"fail_count"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time          `json:"updated_at"`
}

type SendRequest struct {
	Title    string           `json:"title"`
	Body     string           `json:"body"`
	Type     NotificationType `json:"type"`
	Channels []string         `json:"channels"`
	Target   TargetConfig     `json:"target"`
}
