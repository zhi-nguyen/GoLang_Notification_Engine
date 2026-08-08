import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNotificationContext } from '../context/NotificationContext';
import {
  Play,
  Square,
  Send,
  Zap,
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Trash2,
} from 'lucide-react';
import type { SendNotificationRequest } from '../types';

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
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <XCircle className="w-3.5 h-3.5" />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-indigo-500/30 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
              <h2 className="text-lg font-bold text-slate-100">
                WebSocket Multi-Client Real-Time Sandbox
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
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
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors"
            >
              Test: Chỉ Client A mở
            </button>
            <button
              onClick={() => {
                clientA.connect();
                clientB.connect();
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-xs font-medium text-white border border-indigo-400/30 transition-colors"
            >
              Test: Cả 2 cùng mở
            </button>
          </div>
        </div>
      </div>

      {/* Dispatch Control Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-lg">
        <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Bắn Gói Tin Notification từ Server REST API
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            value={apiTitle}
            onChange={(e) => setApiTitle(e.target.value)}
            placeholder="Notification Title"
            className="px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            value={apiBody}
            onChange={(e) => setApiBody(e.target.value)}
            placeholder="Notification Body Payload"
            className="px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 md:col-span-2 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleDispatchAPI('all', [])}
            disabled={isSending}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5" />
            Broadcast to ALL Clients
          </button>

          <button
            onClick={() => handleDispatchAPI('user', [idClientA])}
            disabled={isSending}
            className="px-4 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Target Only Client A ({idClientA})
          </button>

          <button
            onClick={() => handleDispatchAPI('user', [idClientB])}
            disabled={isSending}
            className="px-4 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Target Only Client B ({idClientB})
          </button>
        </div>
      </div>

      {/* Side-by-Side Dual Client Sandbox Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ================= CLIENT A PANEL ================= */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-blue-500/30 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            {/* Top Bar */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                <h3 className="font-bold text-sm text-slate-100">CLIENT A (Node 1)</h3>
              </div>
              {getStatusBadge(clientA.status)}
            </div>

            {/* Config & Connection Actions */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold">User ID:</label>
                <input
                  type="text"
                  value={idClientA}
                  onChange={(e) => setIdClientA(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex gap-2">
                {clientA.isConnected ? (
                  <button
                    onClick={clientA.disconnect}
                    className="flex-1 px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Đóng Kết Nối Client A
                  </button>
                ) : (
                  <button
                    onClick={clientA.connect}
                    className="flex-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Mở Kết Nối Client A
                  </button>
                )}
                <button
                  onClick={clientA.clearLogs}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Clear Console Logs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Direct WS Send Frame */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 mb-4">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Gửi Gói Tin Ping/Message qua WebSocket Client A:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageA}
                  onChange={(e) => setMessageA(e.target.value)}
                  placeholder="Gói tin client A..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none"
                />
                <button
                  onClick={() => clientA.sendMessage({ action: 'ping', payload: messageA })}
                  disabled={!clientA.isConnected}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium disabled:opacity-40"
                >
                  Gửi
                </button>
              </div>
            </div>

            {/* Live Message Log Console */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  Received Messages Log ({clientA.messageLogs.length})
                </span>
              </div>

              <div className="h-48 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300 space-y-2 border border-slate-800/80 custom-scrollbar">
                {clientA.messageLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                    Chưa nhận gói tin nào...
                  </div>
                ) : (
                  clientA.messageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded bg-slate-900 border border-slate-800/60 animate-in fade-in duration-200"
                    >
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>[{log.timestamp}]</span>
                        <span className="text-blue-400">INBOUND</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-emerald-400 text-[10px]">
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
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            {/* Top Bar */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <h3 className="font-bold text-sm text-slate-100">CLIENT B (Node 2)</h3>
              </div>
              {getStatusBadge(clientB.status)}
            </div>

            {/* Config & Connection Actions */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold">User ID:</label>
                <input
                  type="text"
                  value={idClientB}
                  onChange={(e) => setIdClientB(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex gap-2">
                {clientB.isConnected ? (
                  <button
                    onClick={clientB.disconnect}
                    className="flex-1 px-3 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Đóng Kết Nối Client B
                  </button>
                ) : (
                  <button
                    onClick={clientB.connect}
                    className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Mở Kết Nối Client B
                  </button>
                )}
                <button
                  onClick={clientB.clearLogs}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Clear Console Logs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Direct WS Send Frame */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 mb-4">
              <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                Gửi Gói Tin Ping/Message qua WebSocket Client B:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageB}
                  onChange={(e) => setMessageB(e.target.value)}
                  placeholder="Gói tin client B..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none"
                />
                <button
                  onClick={() => clientB.sendMessage({ action: 'ping', payload: messageB })}
                  disabled={!clientB.isConnected}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-40"
                >
                  Gửi
                </button>
              </div>
            </div>

            {/* Live Message Log Console */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Received Messages Log ({clientB.messageLogs.length})
                </span>
              </div>

              <div className="h-48 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300 space-y-2 border border-slate-800/80 custom-scrollbar">
                {clientB.messageLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                    Chưa nhận gói tin nào...
                  </div>
                ) : (
                  clientB.messageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded bg-slate-900 border border-slate-800/60 animate-in fade-in duration-200"
                    >
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>[{log.timestamp}]</span>
                        <span className="text-emerald-400">INBOUND</span>
                      </div>
                      <pre className="whitespace-pre-wrap text-blue-400 text-[10px]">
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
