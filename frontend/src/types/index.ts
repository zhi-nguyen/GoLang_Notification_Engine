export type NotificationType = 'push' | 'email' | 'sms' | 'app_alert';
export type TargetType = 'all' | 'user' | 'segment';
export type NotificationStatus = 'pending' | 'sending' | 'completed' | 'failed';

export interface TargetConfig {
  type: TargetType;
  ids?: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  channels: string[];
  target: TargetConfig;
  status: NotificationStatus;
  sent_count: number;
  fail_count: number;
  created_at: string;
  updated_at: string;
}

export interface SendNotificationRequest {
  title: string;
  body: string;
  type?: NotificationType;
  channels?: string[];
  target?: TargetConfig;
}

export interface NotificationStats {
  pending: number;
  sending: number;
  completed: number;
  failed: number;
  [key: string]: number;
}

export interface TokenResponse {
  token: string;
  user_id: string;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  count?: number;
  notification?: T;
  stats?: NotificationStats;
}
