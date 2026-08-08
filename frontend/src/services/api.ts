import type {
  NotificationItem,
  NotificationStats,
  SendNotificationRequest,
  TokenResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch {
      // json parse failed
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const apiService = {
  // 1. Fetch JWT token
  async fetchToken(userId: string = 'guest-admin'): Promise<TokenResponse> {
    const res = await fetch(`${API_BASE}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    return handleResponse<TokenResponse>(res);
  },

  // 2. Dispatch Notification (Send)
  async sendNotification(
    req: SendNotificationRequest,
    token: string
  ): Promise<{ message: string; notification: NotificationItem }> {
    const res = await fetch(`${API_BASE}/api/v1/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req),
    });
    return handleResponse<{ message: string; notification: NotificationItem }>(res);
  },

  // 3. List Notifications
  async getNotifications(
    token: string,
    limit: number = 20,
    offset: number = 0,
    since?: string
  ): Promise<{ data: NotificationItem[]; count: number }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (since) params.append('since', since);

    const res = await fetch(`${API_BASE}/api/v1/notifications?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ data: NotificationItem[]; count: number }>(res);
  },

  // 4. Get Notification Statistics
  async getStats(token: string): Promise<{ stats: NotificationStats }> {
    const res = await fetch(`${API_BASE}/api/v1/notifications/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ stats: NotificationStats }>(res);
  },

  // 5. Get Notification by ID
  async getNotificationById(
    token: string,
    id: string
  ): Promise<{ notification: NotificationItem }> {
    const res = await fetch(`${API_BASE}/api/v1/notifications/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ notification: NotificationItem }>(res);
  },

  // 6. Health Check
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<{ status: string; timestamp: string }>(res);
  },
};
