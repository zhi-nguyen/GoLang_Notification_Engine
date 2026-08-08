import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  NotificationItem,
  NotificationStats,
  SendNotificationRequest,
} from '../types';
import { apiService } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { ConnectionStatus } from '../hooks/useWebSocket';

export interface ToastItem {
  id: string;
  title: string;
  body: string;
  type: string;
  timestamp: string;
}

interface NotificationContextType {
  token: string | null;
  userId: string;
  setUserId: (id: string) => void;
  notifications: NotificationItem[];
  unreadCount: number;
  stats: NotificationStats;
  toasts: ToastItem[];
  wsStatus: ConnectionStatus;
  isLoading: boolean;
  error: string | null;

  connectWS: () => void;
  disconnectWS: () => void;
  sendNotification: (req: SendNotificationRequest) => Promise<NotificationItem>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissToast: (id: string) => void;
  refreshNotifications: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserIdState] = useState<string>('admin-user');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<NotificationStats>({
    pending: 0,
    sending: 0,
    completed: 0,
    failed: 0,
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Auth Token
  const initToken = useCallback(async (uid: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiService.fetchToken(uid);
      setToken(res.token);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initToken(userId);
  }, [userId, initToken]);

  const setUserId = (newId: string) => {
    setUserIdState(newId);
  };

  // Add toast alert
  const addToast = useCallback((title: string, body: string, type: string = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const toast: ToastItem = {
      id,
      title,
      body,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    setToasts((prev) => [toast, ...prev.slice(0, 4)]); // max 5 toasts

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      dismissToast(id);
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // WebSocket Hook for Main Notification Feed
  const handleWSMessage = useCallback(
    (msg: any) => {
      const notifItem: NotificationItem = msg;
      if (notifItem && notifItem.id) {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notifItem.id)) {
            return prev.map((n) => (n.id === notifItem.id ? notifItem : n));
          }
          return [notifItem, ...prev];
        });

        addToast(notifItem.title || 'New Notification', notifItem.body || '', notifItem.type || 'info');
        setUnreadCount((prev) => prev + 1);
      }
    },
    [addToast]
  );

  const {
    status: wsStatus,
    connect: connectWS,
    disconnect: disconnectWS,
  } = useWebSocket({
    token: token || undefined,
    userId,
    autoConnect: true,
    onMessage: handleWSMessage,
  });

  // Fetch Notifications List from API
  const refreshNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiService.getNotifications(token, 50, 0);
      setNotifications(res.data || []);
      const unread = (res.data || []).filter((n) => !readIds.has(n.id)).length;
      setUnreadCount(unread);
    } catch (err: any) {
      console.error('Failed to fetch notifications', err);
    }
  }, [token, readIds]);

  // Fetch Stats from API
  const refreshStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiService.getStats(token);
      if (res.stats) setStats(res.stats);
    } catch (err: any) {
      console.error('Failed to fetch stats', err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      refreshNotifications();
      refreshStats();
    }
  }, [token, refreshNotifications, refreshStats]);

  // Actions
  const handleSendNotification = async (req: SendNotificationRequest): Promise<NotificationItem> => {
    if (!token) throw new Error('Not authenticated');
    const res = await apiService.sendNotification(req, token);
    const newNotif = res.notification;

    setNotifications((prev) => [newNotif, ...prev]);
    addToast('Notification Dispatched', `${newNotif.title} -> ${newNotif.target.type}`, 'success');
    refreshStats();
    return newNotif;
  };

  const markAsRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        token,
        userId,
        setUserId,
        notifications,
        unreadCount,
        stats,
        toasts,
        wsStatus,
        isLoading,
        error,
        connectWS,
        disconnectWS,
        sendNotification: handleSendNotification,
        markAsRead,
        markAllAsRead,
        dismissToast,
        refreshNotifications,
        refreshStats,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
};
