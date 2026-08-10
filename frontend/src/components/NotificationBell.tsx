import React, { useState } from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import type { NotificationType } from '../types';
import { BellSolid, CheckDoubleSolid, XMarkSolid } from './Icons';

const TYPE_BADGE_STYLES: Record<string, string> = {
  email: 'bg-[#61affe]/15 text-[#3b82c4] border-[#61affe]/30',
  sms: 'bg-[#49cc90]/15 text-[#2d8a5e] border-[#49cc90]/30',
  push: 'bg-[#9b59b6]/15 text-[#7c3aad] border-[#9b59b6]/30',
  app_alert: 'bg-[#fca130]/15 text-[#b5741f] border-[#fca130]/30',
};

const TYPE_LABELS: Record<string, string> = {
  email: 'EMAIL',
  sms: 'SMS',
  push: 'PUSH',
  app_alert: 'ALERT',
};

const getTypeBadge = (type: NotificationType) => {
  const style = TYPE_BADGE_STYLES[type] || TYPE_BADGE_STYLES.app_alert;
  const label = TYPE_LABELS[type] || 'ALERT';
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${style}`}>
      {label}
    </span>
  );
};

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAllAsRead, markAsRead, wsStatus } =
    useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md bg-[#f7f7f7] hover:bg-[#eeeeee] border border-[#e0e0e0] text-[#3b4151] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4990e2]/30"
        title="Real-Time Notifications"
      >
        <BellSolid className="w-4.5 h-4.5" />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#f93e3e] text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* WS Connection Indicator dot */}
        <span
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-[#f7f7f7] ${
            wsStatus === 'CONNECTED'
              ? 'bg-[#49cc90]'
              : wsStatus === 'CONNECTING' || wsStatus === 'RECONNECTING'
              ? 'bg-[#fca130]'
              : 'bg-[#f93e3e]'
          }`}
          title={`WebSocket Status: ${wsStatus}`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg bg-white border border-[#e0e0e0] shadow-lg z-50 overflow-hidden text-[#3b4151]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#fafafa] border-b border-[#e0e0e0]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[#1b1b1b]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#4990e2]/15 text-[#4990e2] font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-[#6b7280] hover:text-[#4990e2] flex items-center gap-1 transition-colors font-medium"
              >
                <CheckDoubleSolid className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#f0f0f0] custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-[#8a8a8a] text-sm">
                No notifications received yet
              </div>
            ) : (
              notifications.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className="p-3 hover:bg-[#f7f7f7] transition-colors cursor-pointer flex gap-3 items-start"
                >
                  <div className="shrink-0 mt-0.5">
                    {getTypeBadge(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="text-xs font-semibold text-[#1b1b1b] truncate">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-[#8a8a8a] shrink-0 ml-2 font-mono">
                        {new Date(item.created_at || Date.now()).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-[#6b7280] line-clamp-2">{item.body}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#f7f7f7] text-[#6b7280] border border-[#e0e0e0] font-mono">
                        Target: {item.target?.type || 'all'}
                      </span>
                      <span className="text-[9px] font-semibold text-[#49cc90]">
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

      {/* Click-away overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
