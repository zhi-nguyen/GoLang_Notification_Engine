import React, { useState } from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import { Bell, CheckCheck, Mail, MessageSquare, Smartphone, Zap } from 'lucide-react';
import type { NotificationType } from '../types';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAllAsRead, markAsRead, wsStatus } =
    useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);

  const getTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-400" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case 'push':
        return <Smartphone className="w-4 h-4 text-purple-400" />;
      default:
        return <Zap className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg group"
        title="Real-Time Notifications"
      >
        <Bell className="w-5 h-5 group-hover:scale-110 transition-transform duration-200 text-slate-300 group-hover:text-indigo-400" />
        
        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-[10px] font-bold text-white shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* WS Connection Indicator dot */}
        <span
          className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
            wsStatus === 'CONNECTED'
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
              : wsStatus === 'CONNECTING' || wsStatus === 'RECONNECTING'
              ? 'bg-amber-400 animate-ping'
              : 'bg-rose-500'
          }`}
          title={`WebSocket Status: ${wsStatus}`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl z-50 overflow-hidden text-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-400 font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No notifications received yet
              </div>
            ) : (
              notifications.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className="p-3.5 hover:bg-slate-800/40 transition-colors cursor-pointer flex gap-3 items-start group"
                >
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 shrink-0">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                        {new Date(item.created_at || Date.now()).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{item.body}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50 font-mono">
                        Target: {item.target?.type || 'all'}
                      </span>
                      <span className="text-[9px] capitalize text-emerald-400 flex items-center gap-1">
                        ● {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
