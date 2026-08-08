import { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationItem } from '../types';

export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

export interface ReceivedMessage {
  id: string;
  timestamp: string;
  data: NotificationItem | any;
  raw: string;
}

export interface UseWebSocketOptions {
  url?: string;
  token?: string;
  userId?: string;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  onMessage?: (message: NotificationItem | any) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
    token,
    userId,
    autoConnect = false,
    maxReconnectAttempts = 5,
    reconnectInterval = 2000,
    onMessage,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [lastMessage, setLastMessage] = useState<ReceivedMessage | null>(null);
  const [messageLogs, setMessageLogs] = useState<ReceivedMessage[]>([]);
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyClosedRef = useRef<boolean>(false);

  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      if (onStatusChange) onStatusChange(newStatus);
    },
    [onStatusChange]
  );

  const connect = useCallback(() => {
    if (!token) {
      updateStatus('FAILED');
      return;
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    isManuallyClosedRef.current = false;
    updateStatus(reconnectCount > 0 ? 'RECONNECTING' : 'CONNECTING');

    const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      updateStatus('CONNECTED');
      setReconnectCount(0);
    };

    ws.onmessage = (event) => {
      const raw = event.data;
      let parsedData: NotificationItem | any = raw;
      try {
        parsedData = JSON.parse(raw);
      } catch {
        // Raw string message
      }

      const receivedMsg: ReceivedMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        data: parsedData,
        raw,
      };

      setLastMessage(receivedMsg);
      setMessageLogs((prev) => [receivedMsg, ...prev.slice(0, 49)]); // Keep last 50 logs

      if (onMessage) {
        onMessage(parsedData);
      }
    };

    ws.onerror = () => {
      // Handled by onclose
    };

    ws.onclose = (event) => {
      socketRef.current = null;

      if (isManuallyClosedRef.current) {
        updateStatus('DISCONNECTED');
        return;
      }

      if (reconnectCount < maxReconnectAttempts) {
        updateStatus('RECONNECTING');
        // Exponential backoff with jitter
        const delay = Math.min(
          reconnectInterval * Math.pow(1.5, reconnectCount) + Math.random() * 500,
          10000
        );

        reconnectTimerRef.current = setTimeout(() => {
          setReconnectCount((prev) => prev + 1);
          connect();
        }, delay);
      } else {
        updateStatus('FAILED');
      }
    };
  }, [
    token,
    url,
    reconnectCount,
    maxReconnectAttempts,
    reconnectInterval,
    onMessage,
    updateStatus,
  ]);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      socketRef.current.send(payload);
      return true;
    }
    return false;
  }, []);

  const clearLogs = useCallback(() => {
    setMessageLogs([]);
    setLastMessage(null);
  }, []);

  useEffect(() => {
    if (autoConnect && token) {
      connect();
    }
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        isManuallyClosedRef.current = true;
        socketRef.current.close();
      }
    };
  }, [autoConnect, token]);

  return {
    status,
    lastMessage,
    messageLogs,
    reconnectCount,
    userId,
    connect,
    disconnect,
    sendMessage,
    clearLogs,
    isConnected: status === 'CONNECTED',
  };
}
