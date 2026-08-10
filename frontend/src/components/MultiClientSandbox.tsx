import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNotificationContext } from '../context/NotificationContext';
import { PaperAirplaneSolid, TrashSolid, PlaySolid, StopSolid, MegaphoneSolid } from './Icons';
import type { SendNotificationRequest } from '../types';

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  CONNECTED: { bg: 'bg-[#49cc90] text-white', label: 'Connected' },
  CONNECTING: { bg: 'bg-[#fca130] text-white animate-pulse', label: 'Connecting' },
  RECONNECTING: { bg: 'bg-[#fca130] text-white animate-pulse', label: 'Reconnecting' },
  DISCONNECTED: { bg: 'bg-[#6b7280] text-white', label: 'Disconnected' },
  FAILED: { bg: 'bg-[#f93e3e] text-white', label: 'Failed' },
};

const getStatusBadge = (status: string) => {
  const config = STATUS_BADGE[status] || STATUS_BADGE.DISCONNECTED;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${config.bg}`}>
      {config.label}
    </span>
  );
};

export const MultiClientSandbox: React.FC = () => {
  const { token, sendNotification } = useNotificationContext();

  const [idClientA, setIdClientA] = useState('client_A');
  const [idClientB, setIdClientB] = useState('client_B');

  const [messageA, setMessageA] = useState('Hello from Client A');
  const [messageB, setMessageB] = useState('Hello from Client B');

  const [apiTitle, setApiTitle] = useState('System Alert');
  const [apiBody, setApiBody] = useState('Test notification payload from Admin API');
  const [isSending, setIsSending] = useState(false);

  // Client A WebSocket hook instance
  const clientA = useWebSocket({
    token: token || undefined,
    userId: idClientA,
    autoConnect: false,
  });

  // Client B WebSocket hook instance
  const clientB = useWebSocket({
    token: token || undefined,
    userId: idClientB,
    autoConnect: false,
  });

  // Handle Dispatch from REST API with targeted options
  const handleDispatchAPI = async (targetType: 'all' | 'user', targetIds: string[]) => {
    if (!token) return;
    try {
      setIsSending(true);
      const req: SendNotificationRequest = {
        title: apiTitle,
        body: `${apiBody} [Target: ${targetType}${targetIds.length ? ' - ' + targetIds.join(',') : ''}]`,
        type: 'app_alert',
        channels: ['email', 'sms'],
        target: {
          type: targetType,
          ids: targetIds,
        },
      };
      await sendNotification(req);
    } catch (err) {
      console.error('Dispatch API error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Send from Client A Frame
  const handleSendA = async () => {
    if (!messageA.trim()) return;

    if (!clientA.isConnected) {
      clientA.connect();
    }

    clientA.sendMessage({
      action: 'ping',
      sender: idClientA,
      payload: messageA,
      timestamp: new Date().toLocaleTimeString(),
    });

    await handleDispatchAPI('user', [idClientA]);
  };

  // Handle Send from Client B Frame
  const handleSendB = async () => {
    if (!messageB.trim()) return;

    if (!clientB.isConnected) {
      clientB.connect();
    }

    clientB.sendMessage({
      action: 'ping',
      sender: idClientB,
      payload: messageB,
      timestamp: new Date().toLocaleTimeString(),
    });

    await handleDispatchAPI('user', [idClientB]);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="p-5 rounded-lg bg-[#fafafa] border border-[#e0e0e0]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-[#1b1b1b] mb-1">
              WebSocket Multi-Client Real-Time Sandbox
            </h2>
            <p className="text-xs text-[#6b7280] max-w-2xl">
              Môi trường thử nghiệm trực tiếp 2 kết nối WebSocket song song. Kiểm thử truyền nhận gói tin
              khi 1 bên mở / 1 bên đóng, hoặc cả 2 bên cùng kết nối thực tế với NATS PubSub Broker.
            </p>
          </div>

          {/* Preset Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                clientA.connect();
                clientB.disconnect();
              }}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-[#f7f7f7] text-xs font-medium text-[#3b4151] border border-[#d1d5db] transition-colors"
            >
              Test: Chỉ Client A mở
            </button>
            <button
              onClick={() => {
                clientA.connect();
                clientB.connect();
              }}
              className="px-3 py-1.5 rounded-md bg-[#4990e2] hover:bg-[#3d7bc7] text-xs font-medium text-white transition-colors"
            >
              Test: Cả 2 cùng mở
            </button>
          </div>
        </div>
      </div>

      {/* Dispatch Control Bar */}
      <div className="p-5 rounded-lg bg-white border border-[#e0e0e0]">
        <h3 className="text-xs font-bold text-[#3b4151] mb-3 uppercase tracking-wide">
          Bắn Gói Tin Notification từ Server REST API
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            value={apiTitle}
            onChange={(e) => setApiTitle(e.target.value)}
            placeholder="Notification Title"
            className="px-3 py-2 text-xs rounded-md bg-white border border-[#d1d5db] text-[#3b4151] focus:outline-none focus:border-[#4990e2]"
          />
          <input
            type="text"
            value={apiBody}
            onChange={(e) => setApiBody(e.target.value)}
            placeholder="Notification Body Payload"
            className="px-3 py-2 text-xs rounded-md bg-white border border-[#d1d5db] text-[#3b4151] md:col-span-2 focus:outline-none focus:border-[#4990e2]"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleDispatchAPI('all', [])}
            disabled={isSending}
            className="px-4 py-2 rounded-md bg-[#49cc90] hover:bg-[#3ebb7f] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <MegaphoneSolid className="w-3.5 h-3.5" />
            Broadcast ALL
          </button>

          <button
            onClick={() => handleDispatchAPI('user', [idClientA])}
            disabled={isSending}
            className="px-4 py-2 rounded-md bg-[#61affe] hover:bg-[#4f9fe8] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <PaperAirplaneSolid className="w-3 h-3" />
            Target Client A ({idClientA})
          </button>

          <button
            onClick={() => handleDispatchAPI('user', [idClientB])}
            disabled={isSending}
            className="px-4 py-2 rounded-md bg-[#fca130] hover:bg-[#e8922a] text-xs font-semibold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <PaperAirplaneSolid className="w-3 h-3" />
            Target Client B ({idClientB})
          </button>
        </div>
      </div>

      {/* Side-by-Side Dual Client Sandbox Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ================= CLIENT A PANEL ================= */}
        <div className="rounded-lg bg-white border border-[#e0e0e0] flex flex-col">
          {/* Panel Header */}
          <div className="flex justify-between items-center p-4 border-b border-[#e8e8e8]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#61affe]" />
              <h3 className="font-bold text-sm text-[#1b1b1b]">CLIENT A (Node 1)</h3>
            </div>
            {getStatusBadge(clientA.status)}
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {/* Config & Connection Actions */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] text-[#8a8a8a] uppercase font-bold block mb-1">User ID:</label>
                <input
                  type="text"
                  value={idClientA}
                  onChange={(e) => setIdClientA(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-white border border-[#d1d5db] text-[#3b4151] focus:outline-none focus:border-[#61affe] font-mono"
                />
              </div>

              <div className="flex gap-2">
                {clientA.isConnected ? (
                  <button
                    onClick={clientA.disconnect}
                    className="flex-1 px-3 py-2 rounded-md bg-[#f93e3e] hover:bg-[#e03535] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <StopSolid className="w-3 h-3" />
                    Đóng Kết Nối
                  </button>
                ) : (
                  <button
                    onClick={clientA.connect}
                    className="flex-1 px-3 py-2 rounded-md bg-[#61affe] hover:bg-[#4f9fe8] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlaySolid className="w-3 h-3" />
                    Mở Kết Nối
                  </button>
                )}
                <button
                  onClick={clientA.clearLogs}
                  className="p-2 rounded-md bg-[#f7f7f7] hover:bg-[#eeeeee] border border-[#e0e0e0] text-[#6b7280] hover:text-[#3b4151] transition-colors cursor-pointer"
                  title="Clear Console Logs"
                >
                  <TrashSolid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Direct WS Send Frame */}
            <div className="p-3 rounded-md bg-[#fafafa] border border-[#e8e8e8] mb-4">
              <label className="text-[10px] text-[#8a8a8a] uppercase font-bold block mb-1.5">
                Gửi Gói Tin Ping/Message qua WebSocket Client A:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageA}
                  onChange={(e) => setMessageA(e.target.value)}
                  placeholder="Gói tin client A..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-md bg-white border border-[#d1d5db] text-[#3b4151] focus:outline-none"
                />
                <button
                  onClick={handleSendA}
                  disabled={isSending}
                  className="px-3.5 py-1.5 rounded-md bg-[#61affe] hover:bg-[#4f9fe8] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <PaperAirplaneSolid className="w-3 h-3" />
                  Gửi
                </button>
              </div>
            </div>

            {/* Live Message Log Console */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase font-bold text-[#8a8a8a]">
                  Received Messages Log ({clientA.messageLogs.length})
                </span>
              </div>

              <div className="h-48 overflow-y-auto rounded-md bg-[#1b1b1b] p-3 font-mono text-[11px] text-[#d4d4d4] space-y-2 border border-[#333] console-scrollbar">
                {clientA.messageLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[#555] text-xs">
                    Chưa nhận gói tin nào...
                  </div>
                ) : (
                  clientA.messageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded bg-[#252525] border border-[#333]"
                    >
                      <div className="flex justify-between text-[10px] text-[#777] mb-1">
                        <span>[{log.timestamp}]</span>
                        <span className="text-[#61affe] font-semibold">INBOUND</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-[#49cc90] text-[10px]">
                        {typeof log.data === 'object'
                          ? JSON.stringify(log.data, null, 2)
                          : log.raw}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= CLIENT B PANEL ================= */}
        <div className="rounded-lg bg-white border border-[#e0e0e0] flex flex-col">
          {/* Panel Header */}
          <div className="flex justify-between items-center p-4 border-b border-[#e8e8e8]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#49cc90]" />
              <h3 className="font-bold text-sm text-[#1b1b1b]">CLIENT B (Node 2)</h3>
            </div>
            {getStatusBadge(clientB.status)}
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {/* Config & Connection Actions */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] text-[#8a8a8a] uppercase font-bold block mb-1">User ID:</label>
                <input
                  type="text"
                  value={idClientB}
                  onChange={(e) => setIdClientB(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-white border border-[#d1d5db] text-[#3b4151] focus:outline-none focus:border-[#49cc90] font-mono"
                />
              </div>

              <div className="flex gap-2">
                {clientB.isConnected ? (
                  <button
                    onClick={clientB.disconnect}
                    className="flex-1 px-3 py-2 rounded-md bg-[#f93e3e] hover:bg-[#e03535] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <StopSolid className="w-3 h-3" />
                    Đóng Kết Nối
                  </button>
                ) : (
                  <button
                    onClick={clientB.connect}
                    className="flex-1 px-3 py-2 rounded-md bg-[#49cc90] hover:bg-[#3ebb7f] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlaySolid className="w-3 h-3" />
                    Mở Kết Nối
                  </button>
                )}
                <button
                  onClick={clientB.clearLogs}
                  className="p-2 rounded-md bg-[#f7f7f7] hover:bg-[#eeeeee] border border-[#e0e0e0] text-[#6b7280] hover:text-[#3b4151] transition-colors cursor-pointer"
                  title="Clear Console Logs"
                >
                  <TrashSolid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Direct WS Send Frame */}
            <div className="p-3 rounded-md bg-[#fafafa] border border-[#e8e8e8] mb-4">
              <label className="text-[10px] text-[#8a8a8a] uppercase font-bold block mb-1.5">
                Gửi Gói Tin Ping/Message qua WebSocket Client B:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageB}
                  onChange={(e) => setMessageB(e.target.value)}
                  placeholder="Gói tin client B..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-md bg-white border border-[#d1d5db] text-[#3b4151] focus:outline-none"
                />
                <button
                  onClick={handleSendB}
                  disabled={isSending}
                  className="px-3.5 py-1.5 rounded-md bg-[#49cc90] hover:bg-[#3ebb7f] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <PaperAirplaneSolid className="w-3 h-3" />
                  Gửi
                </button>
              </div>
            </div>

            {/* Live Message Log Console */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase font-bold text-[#8a8a8a]">
                  Received Messages Log ({clientB.messageLogs.length})
                </span>
              </div>

              <div className="h-48 overflow-y-auto rounded-md bg-[#1b1b1b] p-3 font-mono text-[11px] text-[#d4d4d4] space-y-2 border border-[#333] console-scrollbar">
                {clientB.messageLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[#555] text-xs">
                    Chưa nhận gói tin nào...
                  </div>
                ) : (
                  clientB.messageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded bg-[#252525] border border-[#333]"
                    >
                      <div className="flex justify-between text-[10px] text-[#777] mb-1">
                        <span>[{log.timestamp}]</span>
                        <span className="text-[#49cc90] font-semibold">INBOUND</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-[#61affe] text-[10px]">
                        {typeof log.data === 'object'
                          ? JSON.stringify(log.data, null, 2)
                          : log.raw}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
