import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationItem } from '../types';

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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManuallyClosedRef = useRef<boolean>(false);
  const reconnectCountRef = useRef<number>(0);

  // Keep refs updated for stable callbacks
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const urlRef = useRef(url);
  urlRef.current = url;

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    if (onStatusChangeRef.current) {
      onStatusChangeRef.current(newStatus);
    }
  }, []);

  const connect = useCallback(() => {
    const currentToken = tokenRef.current;
    const currentUrl = urlRef.current;

    if (!currentToken) {
      updateStatus('FAILED');
      return;
    }

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return; // Already connecting or connected
    }

    isManuallyClosedRef.current = false;
    updateStatus(reconnectCountRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');

    const wsUrl = `${currentUrl}?token=${encodeURIComponent(currentToken)}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      updateStatus('CONNECTED');
      reconnectCountRef.current = 0;
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
      setMessageLogs((prev) => [receivedMsg, ...prev.slice(0, 49)]);

      if (onMessageRef.current) {
        onMessageRef.current(parsedData);
      }
    };

    ws.onerror = () => {
      // Handled by onclose
    };

    ws.onclose = () => {
      socketRef.current = null;

      if (isManuallyClosedRef.current) {
        updateStatus('DISCONNECTED');
        return;
      }

      if (reconnectCountRef.current < maxReconnectAttempts) {
        updateStatus('RECONNECTING');
        const delay = Math.min(
          reconnectInterval * Math.pow(1.5, reconnectCountRef.current) + Math.random() * 500,
          10000
        );

        reconnectTimerRef.current = setTimeout(() => {
          reconnectCountRef.current += 1;
          setReconnectCount(reconnectCountRef.current);
          connect();
        }, delay);
      } else {
        updateStatus('FAILED');
      }
    };
  }, [updateStatus, maxReconnectAttempts, reconnectInterval]);

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
        socketRef.current = null;
      }
    };
  }, [autoConnect, token, connect]);

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
